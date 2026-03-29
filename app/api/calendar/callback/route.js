import { NextResponse } from "next/server";
import { getOAuth2Client } from "../../../../lib/google-calendar";

// GET /api/calendar/callback
// Handles Google OAuth callback, exchanges code for tokens
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code received" }, { status: 400 });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Return tokens to be stored securely (e.g., in .env or database)
    // In production, store these tokens in your database
    return NextResponse.json({
      ok: true,
      message: "Google Calendar authorized successfully! Save these tokens in your .env.local file.",
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
      env_format: `GOOGLE_CALENDAR_ACCESS_TOKEN=${tokens.access_token}\nGOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
