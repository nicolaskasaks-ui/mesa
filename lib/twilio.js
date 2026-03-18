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

// Variaciones naturales para que cada mensaje se sienta unico
const readyVariants = [
  (n, m) => `${n}, ya esta tu mesa! Te la guardamos por ${m} minutos.\nLoyola 1250, Villa Crespo.`,
  (n, m) => `${n}! Tu mesa te espera en Chui. Tenes ${m} min para acercarte.\nLoyola 1250, Villa Crespo.`,
  (n, m) => `Hola ${n}, tenemos tu mesa lista. Te esperamos los proximos ${m} minutos.\nLoyola 1250, Villa Crespo.`,
  (n, m) => `${n}, todo listo! Tu mesa esta preparada. Te guardamos el lugar ${m} min.\nLoyola 1250, Villa Crespo.`,
  (n, m) => `Buenas ${n}! Mesa lista para vos. Veni en los proximos ${m} min.\nLoyola 1250, Villa Crespo.`,
];

const positionVariants = [
  (n, p, t) => `${n}, estas #${p} de ${t} en la fila de Chui. Ya falta poco!`,
  (n, p, t) => `Hola ${n}! Vas #${p} de ${t}. Te avisamos apenas este tu mesa.`,
  (n, p, t) => `${n}, update: sos el #${p} de ${t} en espera. Estamos en eso!`,
];

const nextVariants = [
  (n) => `${n}, sos el siguiente! Estate atento, ya casi te sentamos.`,
  (n) => `${n}! Ya casi. Sos el proximo en la lista de Chui.`,
  (n) => `Hola ${n}, sos el que sigue! Quedate cerca que ya te llamamos.`,
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function msgTableReady({ guestName, arrivalMinutes }) {
  return pick(readyVariants)(guestName, arrivalMinutes || 10);
}

export function msgPositionUpdate({ guestName, position, total }) {
  if (position === 1) return pick(nextVariants)(guestName);
  return pick(positionVariants)(guestName, position, total);
}
