import { NextResponse } from "next/server";
import { sendWhatsApp, msgTableReady, msgPositionUpdate } from "../../../lib/twilio";

export async function POST(request) {
  const body = await request.json();
  const { to, guestName, type, position, total, arrivalMinutes } = body;

  let message;
  if (type === "position") {
    message = msgPositionUpdate({ guestName, position, total });
  } else {
    message = msgTableReady({ guestName, arrivalMinutes: arrivalMinutes || 10 });
  }

  const result = await sendWhatsApp({ to, guestName, message });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code, fallback: true }, { status: 400 });
  }
  return NextResponse.json({ success: true, sid: result.sid });
}
