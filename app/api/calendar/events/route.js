import { NextResponse } from "next/server";
import { getCalendarEvents } from "../../../../lib/google-calendar";

// GET /api/calendar/events
// Returns upcoming Google Calendar events
// Query params: ?days=7&max=20
export async function GET(request) {
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!refreshToken) {
    return NextResponse.json(
      {
        error: "Google Calendar not authorized yet",
        action: "Visit /api/calendar/auth to authorize",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const maxResults = parseInt(searchParams.get("max") || "20", 10);

  const now = new Date();
  const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  try {
    const events = await getCalendarEvents(
      { refresh_token: refreshToken },
      { timeMin: now.toISOString(), timeMax: timeMax.toISOString(), maxResults }
    );

    return NextResponse.json({
      ok: true,
      account: "chuibandejas@gmail.com",
      period: `Next ${days} days`,
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        title: e.summary,
        description: e.description || null,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location || null,
        status: e.status,
        link: e.htmlLink,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
