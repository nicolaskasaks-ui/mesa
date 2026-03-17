// Shared Twilio WhatsApp sender — used by /api/whatsapp and /api/tables auto-notify

export async function sendWhatsApp({ to, guestName, waitMinutes }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio not configured" };
  }

  // Normalize phone: strip non-digits
  let cleanPhone = to.replace(/\D/g, "");

  // Argentine mobile fix: +54 11 → +54 9 11 (WhatsApp requires the 9)
  if (cleanPhone.startsWith("54") && !cleanPhone.startsWith("549")) {
    cleanPhone = "549" + cleanPhone.slice(2);
  }

  const whatsappTo = `whatsapp:+${cleanPhone}`;
  const whatsappFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  const body = [
    `Hola ${guestName}`,
    ``,
    `Tu mesa en Chuí está lista.`,
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
      console.error("Twilio error:", JSON.stringify(data));
      return { ok: false, error: data.message || "Twilio error", code: data.code, status: data.status };
    }

    console.log("WhatsApp sent:", data.sid, "to:", whatsappTo);
    return { ok: true, sid: data.sid };
  } catch (err) {
    console.error("WhatsApp send error:", err.message);
    return { ok: false, error: err.message };
  }
}
