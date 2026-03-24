import { NextResponse } from "next/server";

// Buenos Aires coordinates
const LAT = -34.5962;
const LON = -58.4353;
const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,rain,weather_code`;

// Module-level cache: { data, timestamp }
let weatherCache = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  // Return cached data if fresh
  if (weatherCache && Date.now() - weatherCache.timestamp < CACHE_TTL) {
    return NextResponse.json(weatherCache.data);
  }

  try {
    const res = await fetch(OPEN_METEO_URL, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const json = await res.json();

    const current = json.current || {};
    const data = {
      temperature: current.temperature_2m ?? null,
      isRaining: (current.rain ?? 0) > 0,
      weatherCode: current.weather_code ?? null,
    };

    weatherCache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    // If cache exists but is stale, return stale data rather than failing
    if (weatherCache) {
      return NextResponse.json(weatherCache.data);
    }
    return NextResponse.json(
      { temperature: null, isRaining: false, weatherCode: null, error: err.message },
      { status: 502 }
    );
  }
}
