import { NextResponse } from "next/server";
import { sendWhatsApp } from "../../../lib/twilio";

// POST — send WhatsApp via Twilio
export async function POST(request) {
  const { to, guestName, waitMinutes } = await request.json();

  const result = await sendWhatsApp({ to, guestName, waitMinutes });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, fallback: true },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, sid: result.sid });
}
