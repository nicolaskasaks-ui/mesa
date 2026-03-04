import { NextResponse } from "next/server";

// POST — send WhatsApp via Twilio
export async function POST(request) {
  const { to, guestName, waitMinutes } = await request.json();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  // Clean phone number — ensure it starts with +
  const cleanPhone = to.replace(/\D/g, "");
  const whatsappTo = `whatsapp:+${cleanPhone}`;
  const whatsappFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  const body = [
    `Hola ${guestName}!`,
    ``,
    `Tu mesa en *Chuí* está lista.`,
    `Acercate cuando puedas, te esperamos en Loyola 1250.`,
    waitMinutes > 5 ? `\nGracias por esperar (${waitMinutes} min)` : `\nGracias por elegirnos`,
  ].join("\n");

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: whatsappTo,
        From: whatsappFrom,
        Body: body,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", data);
      return NextResponse.json({ error: data.message || "Twilio error", fallback: true }, { status: 400 });
    }

    return NextResponse.json({ success: true, sid: data.sid });
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return NextResponse.json({ error: err.message, fallback: true }, { status: 500 });
  }
}
