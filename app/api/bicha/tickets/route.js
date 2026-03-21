import { supabaseServer } from "../../../../lib/supabase-server";
import { sendWhatsApp } from "../../../../lib/twilio";
import { NextResponse } from "next/server";

// Generate daily ticket number (resets each day)
async function nextTicketNumber() {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabaseServer
    .from("bicha_tickets")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lte("created_at", today + "T23:59:59");
  return (count || 0) + 1;
}

// GET — fetch tickets (today by default, or filter by status)
export async function GET(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabaseServer.from("bicha_tickets").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const today = new Date().toISOString().slice(0, 10);
  let q = supabaseServer
    .from("bicha_tickets")
    .select("*")
    .gte("created_at", today + "T00:00:00")
    .order("created_at", { ascending: true });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create a new ticket
export async function POST(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { guest_name, phone, table_sector, items, estimated_minutes } = body;

  if (!guest_name || !table_sector || !items || !items.length) {
    return NextResponse.json({ error: "guest_name, table_sector, items required" }, { status: 400 });
  }

  const ticket_number = await nextTicketNumber();
  const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);

  // Upsert customer for loyalty
  if (phone) {
    const { data: existing } = await supabaseServer
      .from("bicha_customers")
      .select("id, stamps_count, total_orders")
      .eq("phone", phone)
      .single();

    if (existing) {
      await supabaseServer.from("bicha_customers").update({
        name: guest_name,
        total_orders: existing.total_orders + 1,
        stamps_count: existing.stamps_count + 1,
        last_visit: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabaseServer.from("bicha_customers").insert({
        name: guest_name, phone, stamps_count: 1, total_orders: 1,
        last_visit: new Date().toISOString(),
      });
    }
  }

  const { data, error } = await supabaseServer.from("bicha_tickets").insert({
    ticket_number,
    guest_name,
    phone: phone || null,
    table_sector,
    items_json: items,
    total,
    status: "pending",
    estimated_minutes: estimated_minutes || 15,
  }).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0], { status: 201 });
}

// PATCH — update ticket status (pending → preparing → ready → delivered)
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, status, estimated_minutes } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates = {};
  if (status) updates.status = status;
  if (estimated_minutes != null) updates.estimated_minutes = estimated_minutes;
  if (status === "ready") updates.ready_at = new Date().toISOString();
  if (status === "delivered") updates.delivered_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("bicha_tickets")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ticket = data[0];

  // Send WhatsApp when marked as ready
  if (status === "ready" && ticket.phone) {
    const msg = `¡${ticket.guest_name}! Tu pedido #${String(ticket.ticket_number).padStart(3, "0")} está listo. Ya te lo llevamos a ${ticket.table_sector}. 🍺🔥`;
    await sendWhatsApp({ to: ticket.phone, guestName: ticket.guest_name, message: msg });
  }

  return NextResponse.json(ticket);
}
