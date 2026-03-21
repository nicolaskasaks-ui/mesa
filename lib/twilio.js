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

// Post-visit thank you
const postVisitVariants = [
  (n) => `Hola ${n}! Gracias por venir a Chuí. Esperamos que la hayas pasado genial.\n\nTe gustaria dejarnos una reseña? Nos ayuda mucho:\nhttps://g.page/r/chui-villa-crespo/review\n\nTe esperamos pronto!`,
  (n) => `${n}, fue un placer tenerte en Chuí! Ojala hayas disfrutado.\n\nSi tenes un minuto, nos encantaria tu opinion:\nhttps://g.page/r/chui-villa-crespo/review\n\nHasta la proxima!`,
  (n) => `Hola ${n}! Gracias por elegir Chuí. Esperamos verte de nuevo pronto.\n\nSi queres, contanos como la pasaste:\nhttps://g.page/r/chui-villa-crespo/review`,
];

// Level up notification
const levelUpVariants = [
  (n, l) => `${n}, felicitaciones! Subiste a nivel "${l}" en Chuí. Gracias por ser parte, te esperamos siempre!`,
  (n, l) => `Hola ${n}! Ahora sos "${l}" en Chuí. Como regular, tenes beneficios exclusivos. Gracias por acompañarnos!`,
  (n, l) => `${n}, ya sos "${l}" en Chuí! Cada visita cuenta, y la tuya nos alegra. Hasta pronto!`,
];

// Birthday
const birthdayVariants = [
  (n) => `Feliz cumple ${n}! 🎂 En Chuí te esperamos con un postre de cortesia para festejar. Reserva tu mesa hoy!\nLoyola 1250, Villa Crespo.`,
  (n) => `${n}, feliz cumpleaños! 🎂 Veni a festejar a Chuí y te regalamos el postre. Te esperamos!\nLoyola 1250.`,
];

// Bounce-back (re-engagement)
const bounceBackVariants = [
  (n) => `Hola ${n}! Te extrañamos en Chuí. Veni esta semana y el postre va por nuestra cuenta. Te esperamos!\nLoyola 1250.`,
  (n) => `${n}, hace rato que no te vemos por Chuí! Tu mesa te extraña. Veni y te invitamos un postre.\nLoyola 1250, Villa Crespo.`,
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function msgTableReady({ guestName, arrivalMinutes }) {
  return pick(readyVariants)(guestName, arrivalMinutes || 10);
}

export function msgPositionUpdate({ guestName, position, total }) {
  if (position === 1) return pick(nextVariants)(guestName);
  return pick(positionVariants)(guestName, position, total);
}

export function msgPostVisit({ guestName }) {
  return pick(postVisitVariants)(guestName);
}

export function msgLevelUp({ guestName, level }) {
  return pick(levelUpVariants)(guestName, level);
}

export function msgBirthday({ guestName }) {
  return pick(birthdayVariants)(guestName);
}

export function msgBounceBack({ guestName }) {
  return pick(bounceBackVariants)(guestName);
}
