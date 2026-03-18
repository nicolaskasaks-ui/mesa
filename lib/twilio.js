// Shared Twilio WhatsApp sender

export async function sendWhatsApp({ to, guestName, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio not configured" };
  }

  let cleanPhone = to.replace(/\D/g, "");
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

// Variaciones naturales
const readyVariants = [
  (n, m) => `Hola ${n}! Tu mesa en Chuí esta lista. Te la guardamos ${m} minutitos.\nTe esperamos en Loyola 1250, Villa Crespo.\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m) => `${n}! Buenas noticias, tu mesa esta lista en Chuí. Veni tranqui, te esperamos ${m} min.\nLoyola 1250, Villa Crespo.\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m) => `Hola ${n}, te preparamos la mesa en Chuí! Te la guardamos por ${m} min.\nLoyola 1250, Villa Crespo.\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m) => `${n}, ya tenes mesa en Chuí! Acercate cuando puedas, te la guardamos ${m} min.\nEstamos en Loyola 1250, Villa Crespo.\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m) => `Hola ${n}! Todo listo en Chuí, tu mesa te espera. Tenes ${m} min para venir.\nLoyola 1250, Villa Crespo.\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
];

const positionVariants = [
  (n, p, t) => `Hola ${n}, vas #${p} de ${t} en la fila de Chuí. Ya falta poco!`,
  (n, p, t) => `${n}, update de Chuí: estas #${p} de ${t}. Te avisamos apenas se libere tu mesa!`,
  (n, p, t) => `Hola ${n}! Vas #${p} de ${t} en Chuí. Gracias por la paciencia, ya casi!`,
];

const nextVariants = [
  (n) => `${n}, sos el siguiente en Chuí! Quedate cerca que ya te llamamos.`,
  (n) => `Hola ${n}! Ya casi, sos el proximo. Estate atento!`,
  (n) => `${n}, falta muy poco! Sos el que sigue en la fila de Chuí.`,
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function msgTableReady({ guestName, arrivalMinutes }) {
  return pick(readyVariants)(guestName, arrivalMinutes || 10);
}

export function msgPositionUpdate({ guestName, position, total }) {
  if (position === 1) return pick(nextVariants)(guestName);
  return pick(positionVariants)(guestName, position, total);
}
