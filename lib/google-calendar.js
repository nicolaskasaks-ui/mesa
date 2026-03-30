import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/calendar/callback`
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    login_hint: "chuibandejas@gmail.com",
  });
}

export function isCalendarConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALENDAR_REFRESH_TOKEN);
}

export async function getCalendarEvents({ timeMin, timeMax, maxResults = 50 } = {}) {
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("Google Calendar not authorized");

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const now = new Date();
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin || now.toISOString(),
    timeMax: timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (response.data.items || []).map((e) => ({
    id: e.id,
    title: e.summary || "Sin titulo",
    description: e.description || null,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location || null,
    status: e.status,
    link: e.htmlLink,
    attendees: (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName, status: a.responseStatus })),
  }));
}

// Get today's events (for the bot and dashboard)
export async function getTodayEvents() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return getCalendarEvents({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    maxResults: 50,
  });
}

// Get upcoming events (next N hours)
export async function getUpcomingEvents(hours = 4) {
  const now = new Date();
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return getCalendarEvents({
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    maxResults: 20,
  });
}

// Parse a calendar event to extract reservation info (name, party size, time)
export function parseReservation(event) {
  const title = event.title || "";
  const desc = event.description || "";
  const text = `${title} ${desc}`.toLowerCase();

  // Try to extract party size from title/description
  // Patterns: "2 personas", "mesa para 4", "4p", "x4", "4 pax"
  let partySize = 2; // default
  const sizeMatch = text.match(/(\d+)\s*(?:personas?|pax|comensales|p\b)|mesa\s*(?:para|x)\s*(\d+)|x(\d+)/);
  if (sizeMatch) {
    partySize = parseInt(sizeMatch[1] || sizeMatch[2] || sizeMatch[3], 10);
  }

  // Extract guest name: use event title, remove common prefixes
  let guestName = title
    .replace(/^(reserva|mesa|booking|reservation)\s*[-:.]?\s*/i, "")
    .replace(/\s*[-–]\s*\d+\s*(personas?|pax|p)\s*$/i, "")
    .replace(/\s*\(\d+\s*(personas?|pax|p)\)\s*$/i, "")
    .replace(/\s*x\d+\s*$/i, "")
    .trim();

  if (!guestName || guestName.length < 2) {
    guestName = title.trim() || "Reserva Calendar";
  }

  const startTime = event.start ? new Date(event.start) : null;

  return {
    guestName,
    partySize,
    startTime,
    source: "google_calendar",
    calendarEventId: event.id,
    rawTitle: title,
  };
}

// Format events for WhatsApp message
export function formatEventsForWhatsApp(events) {
  if (!events || events.length === 0) {
    return "No hay reservas en el calendario para hoy.";
  }

  const lines = events.map((e) => {
    const time = e.start
      ? new Date(e.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "??";
    const parsed = parseReservation(e);
    return `${time} - ${parsed.guestName} (${parsed.partySize}p)`;
  });

  return `Reservas de hoy (${events.length}):\n\n${lines.join("\n")}`;
}
