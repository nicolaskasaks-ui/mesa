import { NextResponse } from "next/server";
import { getCalendarEvents, getTodayEvents, isCalendarConfigured } from "../../../../lib/google-calendar";

// GET /api/calendar/events
// Returns Google Calendar events
// Query params: ?range=today|upcoming|week&days=7&max=50&hours=4
export async function GET(request) {
  if (!isCalendarConfigured()) {
    return NextResponse.json(
      {
        error: "Google Calendar not configured",
        action: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN in .env.local, then visit /api/calendar/auth to authorize",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "today";
  const maxResults = parseInt(searchParams.get("max") || "50", 10);

  try {
    let events;
    const now = new Date();

    if (range === "today") {
      events = await getTodayEvents();
    } else if (range === "upcoming") {
      const hours = parseInt(searchParams.get("hours") || "4", 10);
      const until = new Date(now.getTime() + hours * 60 * 60 * 1000);
      events = await getCalendarEvents({ timeMin: now.toISOString(), timeMax: until.toISOString(), maxResults });
    } else {
      const days = parseInt(searchParams.get("days") || "7", 10);
      const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      events = await getCalendarEvents({ timeMin: now.toISOString(), timeMax: until.toISOString(), maxResults });
    }

    return NextResponse.json({
      ok: true,
      account: "chuibandejas@gmail.com",
      range,
      count: events.length,
      events,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
