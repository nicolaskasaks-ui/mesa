// Shared Twilio WhatsApp sender

export async function sendWhatsApp({ to, guestName, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio not configured" };
  }

  let cleanPhone = to.replace(/\D/g, "");

  // Argentine mobile fix: +54 11 → +54 9 11
  if (cleanPhone.startsWith("54") && !cleanPhone.startsWith("549")) {
    cleanPhone = "549" + cleanPhone.slice(2);
  }

  const whatsappTo = `whatsapp:+${cleanPhone}`;
  const whatsappFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: whatsappTo, From: whatsappFrom, Body: message }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Twilio error:", JSON.stringify(data));
      return { ok: false, error: data.message || "Twilio error", code: data.code };
    }
    console.log("WhatsApp sent:", data.sid, "to:", whatsappTo);
    return { ok: true, sid: data.sid };
  } catch (err) {
    console.error("WhatsApp send error:", err.message);
    return { ok: false, error: err.message };
  }
}

// Message templates
export function msgTableReady({ guestName, arrivalMinutes }) {
  return [
    `${guestName}, tu mesa en Chui esta lista.`,
    ``,
    `Tenes ${arrivalMinutes || 10} minutos para llegar.`,
    `Loyola 1250, Villa Crespo.`,
  ].join("\n");
}

export function msgPositionUpdate({ guestName, position, total }) {
  if (position === 1) {
    return `${guestName}, sos el siguiente en la fila de Chui. Estate atento.`;
  }
  return `${guestName}, estas #${position} de ${total} en la fila de Chui.`;
}
