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

// ═══════════════════════════════════════════════════
// MESSAGE TEMPLATES — parameterized with tenant info
// All templates accept { guestName, ...tenantContext }
// tenantContext: { restaurantName, address, reviewUrl }
// Falls back to "Meantime" / empty if no tenant provided
// ═══════════════════════════════════════════════════

// Default context if none provided
const DEFAULT_CTX = { restaurantName: "el local", address: "", reviewUrl: "" };

function ctx(tenantCtx) { return { ...DEFAULT_CTX, ...tenantCtx }; }

const readyVariants = [
  (n, m, c) => `Hola ${n}! Tu mesa en ${c.restaurantName} esta lista. Te la guardamos ${m} minutitos.${c.address ? `\nTe esperamos en ${c.address}.` : ""}\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m, c) => `${n}! Buenas noticias, tu mesa esta lista en ${c.restaurantName}. Veni tranqui, te esperamos ${m} min.${c.address ? `\n${c.address}.` : ""}\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m, c) => `Hola ${n}, te preparamos la mesa en ${c.restaurantName}! Te la guardamos por ${m} min.${c.address ? `\n${c.address}.` : ""}\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m, c) => `${n}, ya tenes mesa en ${c.restaurantName}! Acercate cuando puedas, te la guardamos ${m} min.${c.address ? `\nEstamos en ${c.address}.` : ""}\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
  (n, m, c) => `Hola ${n}! Todo listo en ${c.restaurantName}, tu mesa te espera. Tenes ${m} min para venir.${c.address ? `\n${c.address}.` : ""}\n\nResponde:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`,
];

const positionVariants = [
  (n, p, t, c) => `Hola ${n}, vas #${p} de ${t} en la fila de ${c.restaurantName}. Ya falta poco!`,
  (n, p, t, c) => `${n}, update de ${c.restaurantName}: estas #${p} de ${t}. Te avisamos apenas se libere tu mesa!`,
  (n, p, t, c) => `Hola ${n}! Vas #${p} de ${t} en ${c.restaurantName}. Gracias por la paciencia, ya casi!`,
];

const nextVariants = [
  (n, c) => `${n}, sos el siguiente en ${c.restaurantName}! Quedate cerca que ya te llamamos.`,
  (n, c) => `Hola ${n}! Ya casi, sos el proximo. Estate atento!`,
  (n, c) => `${n}, falta muy poco! Sos el que sigue en la fila de ${c.restaurantName}.`,
];

const postVisitVariants = [
  (n, c) => `Hola ${n}! Gracias por venir a ${c.restaurantName}. Esperamos que la hayas pasado genial.${c.reviewUrl ? `\n\nTe gustaria dejarnos una reseña? Nos ayuda mucho:\n${c.reviewUrl}` : ""}\n\nTe esperamos pronto!`,
  (n, c) => `${n}, fue un placer tenerte en ${c.restaurantName}! Ojala hayas disfrutado.${c.reviewUrl ? `\n\nSi tenes un minuto, nos encantaria tu opinion:\n${c.reviewUrl}` : ""}\n\nHasta la proxima!`,
  (n, c) => `Hola ${n}! Gracias por elegir ${c.restaurantName}. Esperamos verte de nuevo pronto.${c.reviewUrl ? `\n\nSi queres, contanos como la pasaste:\n${c.reviewUrl}` : ""}`,
];

const levelUpVariants = [
  (n, l, c) => `${n}, felicitaciones! Subiste a nivel "${l}" en ${c.restaurantName}. Gracias por ser parte, te esperamos siempre!`,
  (n, l, c) => `Hola ${n}! Ahora sos "${l}" en ${c.restaurantName}. Como regular, tenes beneficios exclusivos. Gracias por acompañarnos!`,
  (n, l, c) => `${n}, ya sos "${l}" en ${c.restaurantName}! Cada visita cuenta, y la tuya nos alegra. Hasta pronto!`,
];

const birthdayVariants = [
  (n, c) => `Feliz cumple ${n}! En ${c.restaurantName} te esperamos con un postre de cortesia para festejar.${c.address ? ` Reserva tu mesa hoy!\n${c.address}.` : ""}`,
  (n, c) => `${n}, feliz cumpleaños! Veni a festejar a ${c.restaurantName} y te regalamos el postre. Te esperamos!${c.address ? `\n${c.address}.` : ""}`,
];

const stillWaitingVariants = [
  (n, c) => `Hola ${n}! Ya llevas un buen rato en la fila de ${c.restaurantName}. Queres seguir esperando?\n\nResponde:\n1 - Si, sigo esperando\n2 - No, cancelar`,
  (n, c) => `${n}, vemos que llevas bastante esperando en ${c.restaurantName}. Seguimos contando con vos?\n\nResponde:\n1 - Si, me quedo\n2 - Cancelar`,
  (n, c) => `Hola ${n}! Sabemos que la espera es larga. Queres que te mantengamos en la fila de ${c.restaurantName}?\n\nResponde:\n1 - Si, espero\n2 - No, cancelo`,
];

const bounceBackVariants = [
  (n, c) => `Hola ${n}! Te extrañamos en ${c.restaurantName}. Veni esta semana y el postre va por nuestra cuenta.${c.address ? ` Te esperamos!\n${c.address}.` : ""}`,
  (n, c) => `${n}, hace rato que no te vemos por ${c.restaurantName}! Tu mesa te extraña.${c.address ? ` Veni y te invitamos un postre.\n${c.address}.` : ""}`,
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// All message functions accept optional tenantContext:
// { restaurantName: "Chuí", address: "Loyola 1250", reviewUrl: "https://..." }
export function msgTableReady({ guestName, arrivalMinutes, tenantContext }) {
  return pick(readyVariants)(guestName, arrivalMinutes || 10, ctx(tenantContext));
}

export function msgPositionUpdate({ guestName, position, total, tenantContext }) {
  const c = ctx(tenantContext);
  if (position === 1) return pick(nextVariants)(guestName, c);
  return pick(positionVariants)(guestName, position, total, c);
}

export function msgPostVisit({ guestName, tenantContext }) {
  return pick(postVisitVariants)(guestName, ctx(tenantContext));
}

export function msgLevelUp({ guestName, level, tenantContext }) {
  return pick(levelUpVariants)(guestName, level, ctx(tenantContext));
}

export function msgBirthday({ guestName, tenantContext }) {
  return pick(birthdayVariants)(guestName, ctx(tenantContext));
}

export function msgStillWaiting({ guestName, tenantContext }) {
  return pick(stillWaitingVariants)(guestName, ctx(tenantContext));
}

export function msgBounceBack({ guestName, tenantContext }) {
  return pick(bounceBackVariants)(guestName, ctx(tenantContext));
}

// Helper: create tenantContext from a tenant object (from DB)
export function tenantToMsgContext(tenant) {
  if (!tenant) return DEFAULT_CTX;
  return {
    restaurantName: tenant.name || tenant.restaurantName || DEFAULT_CTX.restaurantName,
    address: tenant.address || "",
    reviewUrl: tenant.googleReviewUrl || tenant.google_review_url || "",
  };
}

// ═══ Text-to-join & two-way messaging templates ═══

const textToJoinVariants = [
  (n, p) => `${n}, te anotamos en la fila! Posicion #${p}. Te avisamos cuando tu mesa este lista.\n\nEnvia "cuanto falta" para ver tu posicion o "menu" para ver la carta.`,
  (n, p) => `Hola ${n}! Ya estas en la fila, posicion #${p}. Te avisamos apenas haya mesa.\n\nPodes escribir "cuanto falta" o "menu" cuando quieras.`,
  (n, p) => `Listo ${n}! Estas #${p} en la fila. Te mandamos mensaje cuando este tu mesa.\n\nEscribi "cuanto falta" para ver tu estado.`,
];

const alreadyInLineVariants = [
  (n, p) => `${n}, ya estas en la fila! Posicion #${p}. Te avisamos cuando tu mesa este lista.`,
  (n, p) => `Hola ${n}! Ya te tenemos anotado, vas #${p}. Quedate tranqui que te avisamos!`,
];

const positionEstimateVariants = [
  (n, p, t, m) => `${n}, estas #${p} de ${t}. Estimamos ~${m}min de espera. Ya falta poco!`,
  (n, p, t, m) => `Hola ${n}! Vas #${p} de ${t} en la fila. Calulamos unos ${m} minutos. Te avisamos!`,
  (n, p, t, m) => `${n}, posicion #${p} de ${t}. Espera estimada: ~${m}min. Gracias por la paciencia!`,
];

const arrivingConfirmVariants = [
  (n, m) => `Perfecto ${n}, te esperamos en ~${m}min!`,
  (n, m) => `Genial ${n}! Te guardamos la mesa. Nos vemos en ${m}min.`,
  (n, m) => `Dale ${n}, te esperamos!`,
];

const runningLateVariants = [
  (n, m) => `No hay problema ${n}, te guardamos la mesa ${m}min mas. Veni tranqui!`,
  (n, m) => `Tranqui ${n}! Te esperamos ${m}min extra.`,
  (n, m) => `Dale ${n}, no te preocupes. Te guardamos la mesa ${m} minutitos mas.`,
];

const menuLinkVariants = [
  (n) => `${n}, aca tenes nuestra carta!\nTe esperamos!`,
  (n) => `Hola ${n}! Mira nuestro menu aca.`,
  (n) => `${n}, podes ver la carta.\nBuen provecho!`,
];

const thanksVariants = [
  (n) => `Buen provecho! Gracias por elegirnos, ${n}!`,
  (n) => `Gracias a vos ${n}! Esperamos verte pronto.`,
  (n) => `Un placer ${n}! Nos vemos en la proxima.`,
];

export function msgTextToJoinConfirm({ guestName, position }) {
  return pick(textToJoinVariants)(guestName, position);
}

export function msgAlreadyInLine({ guestName, position }) {
  return pick(alreadyInLineVariants)(guestName, position);
}

export function msgPositionEstimate({ guestName, position, total, estimatedMinutes }) {
  return pick(positionEstimateVariants)(guestName, position, total, estimatedMinutes);
}

export function msgArrivingConfirm({ guestName, minutes }) {
  return pick(arrivingConfirmVariants)(guestName, minutes);
}

export function msgRunningLate({ guestName, extraMinutes }) {
  return pick(runningLateVariants)(guestName, extraMinutes);
}

export function msgMenuLink({ guestName }) {
  return pick(menuLinkVariants)(guestName);
}

export function msgThanks({ guestName }) {
  return pick(thanksVariants)(guestName);
}

// ═══ LA BICHA — Templates ═══

const bichaOrderConfirmedVariants = [
  (n, num, table) => `¡${n}! Tu pedido #${num} está en camino. Lo preparamos para ${table}. 🍺`,
  (n, num, table) => `${n}, recibimos tu pedido #${num}. Ya lo estamos preparando para ${table}. 🔥`,
  (n, num, table) => `¡Pedido #${num} confirmado, ${n}! Te lo llevamos a ${table} en unos minutos. 🍻`,
];

const bichaOrderReadyVariants = [
  (n, num, table) => `¡${n}! Tu pedido #${num} está listo. Ya te lo llevamos a ${table}. 🍺🔥`,
  (n, num, table) => `${n}, pedido #${num} ready! Va para ${table}. 🔥`,
  (n, num, table) => `¡Listo tu pedido #${num}, ${n}! Sale para ${table}. 🍻`,
];

const bichaOrderDeliveredVariants = [
  (n, num) => `¡${n}! Tu pedido #${num} fue entregado. Que lo disfrutes! 🍻`,
  (n, num) => `Pedido #${num} entregado, ${n}. Buen provecho! 🔥`,
  (n, num) => `¡Ahí te dejamos el pedido #${num}, ${n}! A disfrutar. 🍺`,
];

const bichaPackConfirmedVariants = [
  (n, pack, code, gameMsg) => `¡${n}! Tu pack "${pack}" está confirmado.\n\nTu código de canje: ${code}\nMostrá el QR en la app para canjear.${gameMsg}`,
  (n, pack, code, gameMsg) => `${n}, tu pack "${pack}" ya está pago y listo.\n\nCódigo: ${code}\nCanjeá desde la app con tu QR.${gameMsg}`,
];

export function msgBichaOrderConfirmed({ guestName, ticketNumber, tableSector }) {
  const num = String(ticketNumber).padStart(3, "0");
  return pick(bichaOrderConfirmedVariants)(guestName, num, tableSector);
}

export function msgBichaOrderReady({ guestName, ticketNumber, tableSector }) {
  const num = String(ticketNumber).padStart(3, "0");
  return pick(bichaOrderReadyVariants)(guestName, num, tableSector);
}

export function msgBichaOrderDelivered({ guestName, ticketNumber }) {
  const num = String(ticketNumber).padStart(3, "0");
  return pick(bichaOrderDeliveredVariants)(guestName, num);
}

export function msgBichaPackConfirmed({ guestName, packName, redeemCode, gameLabel }) {
  const gameMsg = gameLabel ? `\n🎮 ¡Incluye 1 hora de ${gameLabel} gratis!` : "";
  return pick(bichaPackConfirmedVariants)(guestName, packName, redeemCode, gameMsg);
}
