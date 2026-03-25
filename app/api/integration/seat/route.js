import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

// POST /api/integration/seat
// External webhook to seat someone directly (from n8n, OpenTable email parser, etc.)
// Body: { guest_name, party_size, source, table_id?, phone?, allergies? }
// Auth: Bearer token check (simple shared secret)
export async function POST(request) {
  // Simple auth via shared secret
  const auth = request.headers.get("authorization");
  const token = process.env.INTEGRATION_SECRET || "meantime-2025";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { guest_name, party_size = 2, source = "opentable", table_id, phone, allergies } = body;

  if (!guest_name) {
    return NextResponse.json({ error: "guest_name is required" }, { status: 400 });
  }

  // Upsert customer
  let customer_id = null;
  const { data: existing } = await supabase
    .from("customers").select("id, visit_count")
    .ilike("name", guest_name).limit(1).single();

  if (existing) {
    customer_id = existing.id;
    await supabase.from("customers").update({
      visit_count: existing.visit_count + 1,
      last_visit: new Date().toISOString(),
      ...(phone ? { phone } : {}),
      ...(allergies?.length ? { allergies } : {}),
    }).eq("id", existing.id);
  } else {
    const { data: newC } = await supabase.from("customers").insert({
      name: guest_name, phone: phone || null,
      allergies: allergies || [], visit_count: 1,
      last_visit: new Date().toISOString(),
    }).select("id").single();
    if (newC) customer_id = newC.id;
  }

  // Create waitlist entry as seated directly
  const { data: entry, error: wErr } = await supabase.from("waitlist").insert({
    customer_id, guest_name, party_size,
    source, status: "seated",
    seated_at: new Date().toISOString(),
  }).select().single();

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

  // If table_id provided, assign to that table
  if (table_id) {
    await supabase.from("tables").update({
      status: "sentado",
      seated_at: new Date().toISOString(),
      waitlist_id: entry.id,
      updated_at: new Date().toISOString(),
    }).eq("id", table_id);
  }

  return NextResponse.json({ ok: true, entry });
}
