import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// GET — active queue
export async function GET() {
  const { data, error } = await supabase
    .from("waitlist")
    .select("*, customers(name, phone, allergies, visit_count, trust_level)")
    .in("status", ["waiting", "notified", "extended"])
    .order("joined_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — join queue
export async function POST(request) {
  const body = await request.json();
  const { guest_name, party_size, allergies, phone, notes, source } = body;

  // Upsert customer
  let customer_id = null;
  if (guest_name) {
    const { data: existing } = await supabase
      .from("customers").select("id, visit_count")
      .ilike("name", guest_name).limit(1).single();

    if (existing) {
      customer_id = existing.id;
      await supabase.from("customers").update({
        visit_count: existing.visit_count + 1,
        last_visit: new Date().toISOString(),
        ...(allergies?.length ? { allergies } : {}),
        ...(phone ? { phone } : {}),
      }).eq("id", existing.id);
    } else {
      const { data: newC } = await supabase.from("customers").insert({
        name: guest_name, phone: phone || null,
        allergies: allergies || [], visit_count: 1,
        last_visit: new Date().toISOString(),
      }).select("id").single();
      if (newC) customer_id = newC.id;
    }
  }

  const { data, error } = await supabase.from("waitlist").insert({
    customer_id, guest_name, party_size: party_size || 2,
    source: source || "qr", notes: notes || null,
    status: "waiting",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — update status (seat, notify, cancel, extend)
export async function PATCH(request) {
  const body = await request.json();
  const { id, status, extra_minutes } = body;

  const updates = { status };
  if (status === "notified") updates.notified_at = new Date().toISOString();
  if (status === "seated") updates.seated_at = new Date().toISOString();
  if (status === "cancelled") updates.cancelled_at = new Date().toISOString();
  if (status === "extended") {
    updates.extensions_used = 1; // simplified; could increment
    updates.extra_minutes = extra_minutes || 10;
  }

  const { data, error } = await supabase
    .from("waitlist").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
