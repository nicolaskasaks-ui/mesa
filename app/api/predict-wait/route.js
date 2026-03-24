import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

const FALLBACK_MINUTES_PER_POSITION = 12;
const MIN_SAMPLES = 5;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const partySize = parseInt(searchParams.get("party_size") || "2", 10);

  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  // Get current day of week (0=Sun) and hour
  const now = new Date();
  const currentDow = now.getDay();
  const currentHour = now.getHours();

  // Query historical waitlist data from last 30 days: seated entries with both timestamps
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: historical, error } = await supabase
    .from("waitlist")
    .select("joined_at, seated_at, party_size")
    .eq("status", "seated")
    .not("joined_at", "is", null)
    .not("seated_at", "is", null)
    .gte("joined_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by day_of_week, hour_of_day, party_size and find matches
  const exactMatches = [];   // same dow + hour + party_size
  const similarMatches = []; // same dow + hour (any party_size)
  const broadMatches = [];   // same hour (any day, any party_size)

  for (const entry of (historical || [])) {
    const joinedAt = new Date(entry.joined_at);
    const seatedAt = new Date(entry.seated_at);
    const waitMinutes = (seatedAt - joinedAt) / 60000;

    // Skip outliers (negative or extremely long waits)
    if (waitMinutes < 0 || waitMinutes > 300) continue;

    const dow = joinedAt.getDay();
    const hour = joinedAt.getHours();

    if (dow === currentDow && hour === currentHour && entry.party_size === partySize) {
      exactMatches.push(waitMinutes);
    }
    if (dow === currentDow && hour === currentHour) {
      similarMatches.push(waitMinutes);
    }
    if (hour === currentHour) {
      broadMatches.push(waitMinutes);
    }
  }

  // Pick the best dataset: exact > similar > broad
  let samples, confidence;
  if (exactMatches.length >= MIN_SAMPLES) {
    samples = exactMatches;
    confidence = "high";
  } else if (similarMatches.length >= MIN_SAMPLES) {
    samples = similarMatches;
    confidence = "medium";
  } else if (broadMatches.length >= MIN_SAMPLES) {
    samples = broadMatches;
    confidence = "low";
  } else {
    // Not enough historical data — fall back to position-based estimate
    const { count } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .in("status", ["waiting", "notified", "extended"]);

    const position = (count || 0) + 1;
    return NextResponse.json({
      estimated_minutes: position * FALLBACK_MINUTES_PER_POSITION,
      confidence: "fallback",
      based_on_samples: broadMatches.length + similarMatches.length + exactMatches.length,
      method: "position_based",
    });
  }

  // Calculate average wait time
  const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const estimatedMinutes = Math.round(avg);

  return NextResponse.json({
    estimated_minutes: estimatedMinutes,
    confidence,
    based_on_samples: samples.length,
    method: "historical_average",
  });
}
