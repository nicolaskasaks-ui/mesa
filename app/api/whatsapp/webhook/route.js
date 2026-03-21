import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";
import { sendWhatsApp } from "../../../../lib/twilio";

// POST — Twilio webhook for incoming WhatsApp messages
export async function POST(request) {
  const formData = await request.formData();
  const body = formData.get("Body")?.toString().trim() || "";
  const from = formData.get("From")?.toString().replace("whatsapp:", "") || "";

  if (!body || !from) {
    return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  // Clean phone: remove + and spaces
  const cleanPhone = from.replace(/\D/g, "");

  // Find the customer's active waitlist entry by phone
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone")
    .or(`phone.ilike.%${cleanPhone.slice(-8)}%`)
    .limit(1)
    .single();

  if (!customer) {
    return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  const { data: entry } = await supabase
    .from("waitlist")
    .select("id, guest_name, status")
    .eq("customer_id", customer.id)
    .in("status", ["notified", "waiting", "extended"])
    .order("joined_at", { ascending: false })
    .limit(1)
    .single();

  if (!entry) {
    return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  const reply = body.toLowerCase();
  let responseMsg = "";

  // 1 = confirm / ya voy / sigo esperando
  if (reply === "1" || reply.includes("voy") || reply.includes("confirm") || reply.includes("si") || reply.includes("espero") || reply.includes("quedo")) {
    await supabase.from("waitlist").update({ activity: "confirmado", extensions_used: 1 }).eq("id", entry.id);
    responseMsg = entry.status === "notified"
      ? `Genial ${entry.guest_name}! Te esperamos en Chuí. Loyola 1250.`
      : `Perfecto ${entry.guest_name}, te mantenemos en la fila! Te avisamos apenas se libere tu mesa.`;
  }
  // 2 = cancel
  else if (reply === "2" || reply.includes("cancel") || reply.includes("no")) {
    await supabase.from("waitlist").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    }).eq("id", entry.id);
    responseMsg = `Listo ${entry.guest_name}, cancelamos tu lugar. Esperamos verte pronto en Chuí!`;
  }
  // 3 = skip / pass
  else if (reply === "3" || reply.includes("paso") || reply.includes("siguiente") || reply.includes("skip")) {
    await supabase.from("waitlist").update({
      status: "extended",
      extensions_used: 1,
      extra_minutes: 10,
    }).eq("id", entry.id);
    responseMsg = `Ok ${entry.guest_name}, te pasamos al siguiente turno. Te avisamos cuando haya otra mesa!`;
  }
  // Unknown
  else {
    responseMsg = `${entry.guest_name}, responde con:\n1 - Ya voy\n2 - Cancelar\n3 - Paso, dame la siguiente`;
  }

  // Send reply
  if (responseMsg) {
    await sendWhatsApp({ to: cleanPhone, guestName: entry.guest_name, message: responseMsg });
  }

  // Return empty TwiML (we reply via API, not TwiML)
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
