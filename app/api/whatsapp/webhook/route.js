import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import {
  sendWhatsApp,
  msgTextToJoinConfirm,
  msgAlreadyInLine,
  msgPositionEstimate,
  msgArrivingConfirm,
  msgRunningLate,
  msgMenuLink,
  msgThanks,
} from "../../../../lib/twilio";

const XML_EMPTY = new NextResponse("<Response></Response>", {
  headers: { "Content-Type": "text/xml" },
});

// ── helpers ──────────────────────────────────────────────────

async function findCustomerByPhone(cleanPhone) {
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone")
    .or(`phone.ilike.%${cleanPhone.slice(-8)}%`)
    .limit(1)
    .single();
  return data;
}

async function findActiveEntry(customerId) {
  const { data } = await supabase
    .from("waitlist")
    .select("id, guest_name, status, joined_at")
    .eq("customer_id", customerId)
    .in("status", ["notified", "waiting", "extended"])
    .order("joined_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getPositionAndTotal(entryId) {
  const { data: allActive } = await supabase
    .from("waitlist")
    .select("id")
    .in("status", ["waiting", "extended"])
    .order("joined_at", { ascending: true });
  if (!allActive) return { position: 0, total: 0 };
  const idx = allActive.findIndex((e) => e.id === entryId);
  return { position: idx === -1 ? 0 : idx + 1, total: allActive.length };
}

async function estimateWaitMinutes(position) {
  // Try to compute from recent seated entries
  const { data: recent } = await supabase
    .from("waitlist")
    .select("joined_at, seated_at")
    .eq("status", "seated")
    .not("seated_at", "is", null)
    .order("seated_at", { ascending: false })
    .limit(20);

  if (recent?.length >= 3) {
    const waits = recent
      .map((r) => {
        const joined = new Date(r.joined_at).getTime();
        const seated = new Date(r.seated_at).getTime();
        return (seated - joined) / 60000; // minutes
      })
      .filter((m) => m > 0 && m < 300); // sanity cap at 5h

    if (waits.length >= 3) {
      const avg = waits.reduce((a, b) => a + b, 0) / waits.length;
      // avg is total wait; scale by position ratio
      const avgPerSlot = avg / Math.max(waits.length / 2, 1);
      return Math.round(position * Math.min(avgPerSlot, 30));
    }
  }

  // Fallback: 15 min per position
  return position * 15;
}

// ── POST — Twilio webhook for incoming WhatsApp messages ────

export async function POST(request) {
  const formData = await request.formData();
  const body = formData.get("Body")?.toString().trim() || "";
  const from = formData.get("From")?.toString().replace("whatsapp:", "") || "";

  if (!body || !from) return XML_EMPTY;

  const cleanPhone = from.replace(/\D/g, "");
  const reply = body.toLowerCase().trim();

  // ── 1. Look up customer ──
  let customer = await findCustomerByPhone(cleanPhone);

  // ── 2. Text-to-join: "mesa", "fila", "esperar" ──
  const joinKeywords = ["mesa", "fila", "esperar"];
  if (joinKeywords.some((kw) => reply === kw)) {
    // If no customer record, create one
    if (!customer) {
      const { data: newC } = await supabase
        .from("customers")
        .insert({
          name: `WhatsApp ${cleanPhone.slice(-4)}`,
          phone: cleanPhone,
          allergies: [],
          visit_count: 1,
          trust_level: 0,
          no_show_count: 0,
          last_visit: new Date().toISOString(),
        })
        .select("id, name, phone")
        .single();
      customer = newC;
    }

    if (!customer) return XML_EMPTY;

    // Check if already in line
    const existing = await findActiveEntry(customer.id);
    if (existing) {
      const { position, total } = await getPositionAndTotal(existing.id);
      await sendWhatsApp({
        to: cleanPhone,
        guestName: existing.guest_name || customer.name,
        message: msgAlreadyInLine({
          guestName: existing.guest_name || customer.name,
          position,
        }),
      });
      return XML_EMPTY;
    }

    // Create new waitlist entry
    const { data: newEntry } = await supabase
      .from("waitlist")
      .insert({
        customer_id: customer.id,
        guest_name: customer.name,
        party_size: 2,
        source: "whatsapp",
        status: "waiting",
      })
      .select("id")
      .single();

    if (newEntry) {
      const { position } = await getPositionAndTotal(newEntry.id);
      await sendWhatsApp({
        to: cleanPhone,
        guestName: customer.name,
        message: msgTextToJoinConfirm({
          guestName: customer.name,
          position,
        }),
      });
    }
    return XML_EMPTY;
  }

  // ── For all other commands, we need a customer + active entry ──
  if (!customer) return XML_EMPTY;

  const entry = await findActiveEntry(customer.id);

  // ── 3. Position / "cuanto falta" query (works even without active entry for error msg) ──
  if (
    reply.includes("cuanto falta") ||
    reply.includes("cuanto tiempo") ||
    reply === "cuanto" ||
    reply === "posicion" ||
    reply === "posición"
  ) {
    if (!entry) {
      await sendWhatsApp({
        to: cleanPhone,
        guestName: customer.name,
        message: `${customer.name}, no tenes un lugar activo en la fila. Envia "MESA" para anotarte!`,
      });
      return XML_EMPTY;
    }
    const { position, total } = await getPositionAndTotal(entry.id);
    const estMin = await estimateWaitMinutes(position);
    await sendWhatsApp({
      to: cleanPhone,
      guestName: entry.guest_name,
      message: msgPositionEstimate({
        guestName: entry.guest_name,
        position,
        total,
        estimatedMinutes: estMin,
      }),
    });
    return XML_EMPTY;
  }

  // ── 4. Menu request ──
  if (reply === "menu" || reply === "carta" || reply === "menú") {
    await sendWhatsApp({
      to: cleanPhone,
      guestName: customer.name,
      message: msgMenuLink({ guestName: customer.name }),
    });
    return XML_EMPTY;
  }

  // ── 5. Thanks ──
  if (reply.includes("gracias") || reply.includes("thanks") || reply === "grax" || reply === "thx") {
    await sendWhatsApp({
      to: cleanPhone,
      guestName: customer.name,
      message: msgThanks({ guestName: customer.name }),
    });
    return XML_EMPTY;
  }

  // ── Everything below requires an active entry ──
  if (!entry) return XML_EMPTY;

  let responseMsg = "";

  // ── 6. "llego en X" / "arriving in X" ──
  const arrivingMatch = reply.match(
    /(?:llego en|arriving in|llego en unos|estoy a)\s*(\d+)/
  );
  if (arrivingMatch) {
    const mins = parseInt(arrivingMatch[1], 10);
    await supabase
      .from("waitlist")
      .update({ activity: "confirmado" })
      .eq("id", entry.id);
    responseMsg = msgArrivingConfirm({
      guestName: entry.guest_name,
      minutes: mins,
    });
  }
  // ── 7. "tarde" / "late" / "demoro" ──
  else if (
    reply === "tarde" ||
    reply === "late" ||
    reply.includes("demoro") ||
    reply.includes("voy tarde") ||
    reply.includes("running late")
  ) {
    const extraMin = 10;
    await supabase
      .from("waitlist")
      .update({ extra_minutes: extraMin, extensions_used: 1 })
      .eq("id", entry.id);
    responseMsg = msgRunningLate({
      guestName: entry.guest_name,
      extraMinutes: extraMin,
    });
  }
  // ── 8. Confirm: 1 / voy / confirm / si / espero / quedo ──
  else if (
    reply === "1" ||
    reply.includes("voy") ||
    reply.includes("confirm") ||
    reply.includes("si") ||
    reply.includes("espero") ||
    reply.includes("quedo")
  ) {
    await supabase
      .from("waitlist")
      .update({ activity: "confirmado", extensions_used: 1 })
      .eq("id", entry.id);
    responseMsg =
      entry.status === "notified"
        ? `Genial ${entry.guest_name}! Te esperamos en Chui. Loyola 1250.`
        : `Perfecto ${entry.guest_name}, te mantenemos en la fila! Te avisamos apenas se libere tu mesa.`;
  }
  // ── 9. Cancel: 2 / cancel / no ──
  else if (reply === "2" || reply.includes("cancel") || reply === "no") {
    await supabase
      .from("waitlist")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", entry.id);
    responseMsg = `Listo ${entry.guest_name}, cancelamos tu lugar. Esperamos verte pronto en Chui!`;
  }
  // ── 10. Skip / pass: 3 / paso / skip ──
  else if (
    reply === "3" ||
    reply.includes("paso") ||
    reply.includes("siguiente") ||
    reply.includes("skip")
  ) {
    await supabase
      .from("waitlist")
      .update({ status: "extended", extensions_used: 1, extra_minutes: 10 })
      .eq("id", entry.id);
    responseMsg = `Ok ${entry.guest_name}, te pasamos al siguiente turno. Te avisamos cuando haya otra mesa!`;
  }
  // ── Unknown ──
  else {
    responseMsg = `${entry.guest_name}, responde con:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente\n\nO envia "menu", "cuanto falta", o "gracias".`;
  }

  if (responseMsg) {
    await sendWhatsApp({
      to: cleanPhone,
      guestName: entry.guest_name,
      message: responseMsg,
    });
  }

  return XML_EMPTY;
}
