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

// Parse a calendar event to extract DJ set info
export function parseDJEvent(event) {
  const title = event.title || "";
  const desc = event.description || "";

  // The event title is typically the DJ name or "DJ Name - Set info"
  let djName = title
    .replace(/^(dj|set|musica|vinyl|vinilos?)\s*[-:.]?\s*/i, "")
    .trim();

  if (!djName || djName.length < 2) {
    djName = title.trim() || "DJ invitado";
  }

  const startTime = event.start ? new Date(event.start) : null;
  const endTime = event.end ? new Date(event.end) : null;

  return {
    djName,
    startTime,
    endTime,
    description: desc,
    calendarEventId: event.id,
    rawTitle: title,
  };
}

// Format tonight's DJ lineup for WhatsApp
export function formatDJLineupForWhatsApp(events, restaurantName) {
  const name = restaurantName || "Chui";

  if (!events || events.length === 0) {
    return `Hoy no hay musica programada en ${name}. Seguinos en IG para enterarte de las proximas fechas!`;
  }

  if (events.length === 1) {
    const dj = parseDJEvent(events[0]);
    const time = dj.startTime
      ? dj.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "";
    const timeStr = time ? ` desde las ${time}` : "";
    const descStr = dj.description ? `\n${dj.description}` : "";
    return `Hoy en ${name}${timeStr} tenemos a *${dj.djName}* pasando musica en vinilos.${descStr}\n\nTe esperamos!`;
  }

  // Multiple DJs
  const lines = events.map((e) => {
    const dj = parseDJEvent(e);
    const time = dj.startTime
      ? dj.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "";
    return `${time ? time + " " : ""}*${dj.djName}*`;
  });

  return `Hoy en ${name} hay musica en vinilos toda la noche!\n\n${lines.join("\n")}\n\nTe esperamos!`;
}

// Format for host dashboard (internal view with more detail)
export function formatEventsForDashboard(events) {
  return events.map((e) => {
    const dj = parseDJEvent(e);
    return {
      ...e,
      djName: dj.djName,
      description: dj.description,
    };
  });
}
