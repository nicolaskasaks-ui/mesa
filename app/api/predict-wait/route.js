import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// ── Constants ──
const FALLBACK_MINUTES_PER_POSITION = 12;
const MIN_HISTORICAL = 5;
const K = 15;
const HISTORICAL_DAYS = 90;
const HISTORICAL_CACHE_TTL = 5 * 60 * 1000; // 5 min
const WEATHER_CACHE_TTL = 30 * 60 * 1000;   // 30 min

// ── Feature weights for KNN distance ──
const WEIGHTS = {
  day_of_week: 3,
  hour:        4,
  month:       2,
  party_size:  3,
  is_weekend:  2,
  temperature: 1,
  is_raining:  1.5,
};

// ── Module-level caches ──
let historicalCache = null; // { data, timestamp }
let weatherCache = null;    // { data, timestamp }

// ── Helpers ──

/** Circular distance for cyclical features (hour, day_of_week) */
function circularDist(a, b, period) {
  const diff = Math.abs(a - b);
  return Math.min(diff, period - diff);
}

/** Normalize a value to 0-1 given the range */
function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/** Buenos Aires holidays / tourist season:
 *  Dec-Feb = summer/tourist season, Jul = winter vacation */
function isTouristSeason(month) {
  return month === 12 || month === 1 || month === 2 || month === 7;
}

/** Fetch weather from our internal endpoint (cached) */
async function getWeather(origin) {
  if (weatherCache && Date.now() - weatherCache.timestamp < WEATHER_CACHE_TTL) {
    return weatherCache.data;
  }
  try {
    const url = `${origin}/api/weather`;
    const res = await fetch(url);
    const data = await res.json();
    weatherCache = { data, timestamp: Date.now() };
    return data;
  } catch {
    return { temperature: 20, isRaining: false, weatherCode: null };
  }
}

/** Fetch historical completed entries from last N days (cached) */
async function getHistorical() {
  if (historicalCache && Date.now() - historicalCache.timestamp < HISTORICAL_CACHE_TTL) {
    return historicalCache.data;
  }

  const cutoff = new Date(Date.now() - HISTORICAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("waitlist")
    .select("joined_at, seated_at, party_size")
    .eq("status", "seated")
    .not("joined_at", "is", null)
    .not("seated_at", "is", null)
    .gte("joined_at", cutoff);

  if (error) throw error;

  // Pre-compute features for each historical entry
  const entries = [];
  for (const row of data || []) {
    const joined = new Date(row.joined_at);
    const seated = new Date(row.seated_at);
    const waitMinutes = (seated - joined) / 60000;

    // Skip outliers
    if (waitMinutes < 0 || waitMinutes > 180) continue;

    const dow = joined.getDay();
    entries.push({
      waitMinutes,
      features: {
        day_of_week: dow,
        hour: joined.getHours() + joined.getMinutes() / 60, // fractional hour
        month: joined.getMonth() + 1,
        party_size: row.party_size,
        is_weekend: dow === 0 || dow === 5 || dow === 6 ? 1 : 0,
        // We don't have historical weather; use seasonal proxy
        temperature: isTouristSeason(joined.getMonth() + 1) ? 28 : 15,
        is_raining: 0, // unknown for historical, use 0
      },
    });
  }

  historicalCache = { data: entries, timestamp: Date.now() };
  return entries;
}

/** Compute current queue metrics from Supabase */
async function getQueueMetrics() {
  // Current queue count
  const { count: queueLength } = await supabase
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .in("status", ["waiting", "notified", "extended"]);

  // Tables: total and occupied
  const { data: tables } = await supabase
    .from("tables")
    .select("id, status");

  const totalTables = (tables || []).length;
  const occupiedTables = (tables || []).filter(t => t.status === "sentado" || t.status === "postre").length;
  const occupancyRate = totalTables > 0 ? occupiedTables / totalTables : 1;

  // Velocity: tables freed in last 60 minutes
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentlySeated } = await supabase
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("status", "seated")
    .gte("seated_at", oneHourAgo);

  const velocity = recentlySeated || 0; // tables/hour

  return {
    queueLength: queueLength || 0,
    occupancyRate,
    velocity,
    totalTables,
  };
}

/** Weighted KNN prediction */
function predictKNN(currentFeatures, historical) {
  if (historical.length < MIN_HISTORICAL) return null;

  // Calculate distance from current to each historical entry
  const distances = historical.map((entry) => {
    const h = entry.features;
    const c = currentFeatures;

    // Circular distance for hour (period=24) and day_of_week (period=7)
    const hourDist = circularDist(c.hour, h.hour, 24) / 12; // max circular dist=12, normalize to 0-1
    const dowDist = circularDist(c.day_of_week, h.day_of_week, 7) / 3.5; // max=3.5

    // Linear distances (normalized)
    const monthDist = circularDist(c.month, h.month, 12) / 6;
    const partyDist = Math.abs(c.party_size - h.party_size) / 5; // max diff ~5
    const weekendDist = Math.abs(c.is_weekend - h.is_weekend); // 0 or 1
    const tempDist = Math.abs(c.temperature - h.temperature) / 30; // temp range ~30
    const rainDist = Math.abs(c.is_raining - h.is_raining); // 0 or 1

    // Weighted Euclidean distance
    const dist = Math.sqrt(
      WEIGHTS.hour * hourDist ** 2 +
      WEIGHTS.day_of_week * dowDist ** 2 +
      WEIGHTS.month * monthDist ** 2 +
      WEIGHTS.party_size * partyDist ** 2 +
      WEIGHTS.is_weekend * weekendDist ** 2 +
      WEIGHTS.temperature * tempDist ** 2 +
      WEIGHTS.is_raining * rainDist ** 2
    );

    return { dist, waitMinutes: entry.waitMinutes };
  });

  // Sort by distance
  distances.sort((a, b) => a.dist - b.dist);

  // Take K nearest neighbors
  const neighbors = distances.slice(0, K);
  const totalSimilar = distances.filter(d => d.dist < 2.0).length; // "similar" threshold

  // Weighted average: weight = 1 / (dist + epsilon)
  const epsilon = 0.001;
  let weightedSum = 0;
  let weightTotal = 0;
  const waitTimes = [];

  for (const n of neighbors) {
    const w = 1 / (n.dist + epsilon);
    weightedSum += w * n.waitMinutes;
    weightTotal += w;
    waitTimes.push(n.waitMinutes);
  }

  const estimatedMinutes = weightTotal > 0 ? weightedSum / weightTotal : null;
  if (estimatedMinutes === null) return null;

  // Calculate range (P25-P75)
  waitTimes.sort((a, b) => a - b);
  const p25 = waitTimes[Math.floor(waitTimes.length * 0.25)];
  const p75 = waitTimes[Math.floor(waitTimes.length * 0.75)];

  // Confidence based on total similar entries
  let confidence;
  if (totalSimilar >= 20) confidence = "high";
  else if (totalSimilar >= 10) confidence = "medium";
  else confidence = "low";

  return {
    estimatedMinutes: Math.round(estimatedMinutes),
    confidence,
    basedOnSamples: neighbors.length,
    totalSimilar,
    range: {
      min: Math.round(p25),
      max: Math.round(p75),
    },
    waitTimes, // for factor analysis
  };
}

// ── Main handler ──
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const partySize = parseInt(searchParams.get("party_size") || "2", 10);
  const queuePosition = parseInt(searchParams.get("queue_position") || "0", 10);

  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Gather all current conditions in parallel
    const [weather, historical, metrics] = await Promise.all([
      getWeather(origin),
      getHistorical(),
      getQueueMetrics(),
    ]);

    const now = new Date();
    const dow = now.getDay();
    const month = now.getMonth() + 1;

    // Build current feature vector
    const currentFeatures = {
      day_of_week: dow,
      hour: now.getHours() + now.getMinutes() / 60,
      month,
      party_size: partySize,
      is_weekend: dow === 0 || dow === 5 || dow === 6 ? 1 : 0,
      temperature: weather.temperature ?? 20,
      is_raining: weather.isRaining ? 1 : 0,
    };

    // Run KNN prediction
    const prediction = predictKNN(currentFeatures, historical);

    // Fallback if not enough data
    if (!prediction) {
      const position = queuePosition > 0 ? queuePosition : metrics.queueLength + 1;
      return NextResponse.json({
        estimated_minutes: position * FALLBACK_MINUTES_PER_POSITION,
        confidence: "fallback",
        based_on_samples: historical.length,
        factors: {
          day_effect: null,
          weather_effect: null,
          velocity: `${metrics.velocity} mesas/hora`,
          similar_situations: 0,
        },
        range: null,
        method: "position_based",
      });
    }

    // Adjust prediction based on current queue position
    // If queue is longer/shorter than average, adjust proportionally
    let adjusted = prediction.estimatedMinutes;

    // Velocity adjustment: if restaurant is turning tables fast, reduce estimate
    if (metrics.velocity > 0 && queuePosition > 0) {
      const positionBasedEstimate = (queuePosition / metrics.velocity) * 60;
      // Blend KNN with velocity-based (70% KNN, 30% velocity)
      adjusted = Math.round(adjusted * 0.7 + positionBasedEstimate * 0.3);
    }

    // Calculate factor effects for explainability
    const isWeekend = currentFeatures.is_weekend === 1;
    const dayEffect = isWeekend ? "+3min" : "0min";
    const weatherEffect = currentFeatures.is_raining ? "-2min" : "0min";

    return NextResponse.json({
      estimated_minutes: Math.max(1, adjusted),
      confidence: prediction.confidence,
      based_on_samples: prediction.basedOnSamples,
      factors: {
        day_effect: dayEffect,
        weather_effect: weatherEffect,
        velocity: `${metrics.velocity} mesas/hora`,
        similar_situations: prediction.totalSimilar,
      },
      range: prediction.range
        ? { min: Math.max(1, prediction.range.min), max: prediction.range.max }
        : null,
      method: "weighted_knn",
    });
  } catch (err) {
    console.error("predict-wait error:", err);
    // Graceful fallback
    const position = queuePosition > 0 ? queuePosition : 1;
    return NextResponse.json({
      estimated_minutes: position * FALLBACK_MINUTES_PER_POSITION,
      confidence: "fallback",
      based_on_samples: 0,
      factors: null,
      range: null,
      method: "position_based",
      error: err.message,
    });
  }
}
