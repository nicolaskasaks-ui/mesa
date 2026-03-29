import { NextResponse } from "next/server";
import { getAuthUrl } from "../../../../lib/google-calendar";

// GET /api/calendar/auth
// Redirects to Google OAuth consent screen
export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth credentials not configured" },
      { status: 500 }
    );
  }

  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
