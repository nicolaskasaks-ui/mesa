import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

export async function GET() {
  const { data, error } = await supabase
    .from("waitlist")
    .select("*, customers(name, phone, allergies, visit_count, trust_level)")
    .in("status", ["waiting", "notified", "extended"])
    .order("joined_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const { guest_name, party_size, allergies, phone, notes, source } = body;
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
    source: source || "qr", notes: notes || null, status: "waiting",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — cancel all or old entries
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "old"; // "all" or "old"

  let query = supabase.from("waitlist")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .in("status", ["waiting", "notified", "extended"]);

  if (mode === "old") {
    const cutoff = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    query = query.lt("joined_at", cutoff);
  }

  const { data, error } = await query.select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cancelled: data?.length || 0 });
}

export async function PATCH(request) {
  const body = await request.json();
  const { id, status, extra_minutes, activity, distance_m } = body;
  const updates = {};
  if (status) {
    updates.status = status;
    if (status === "notified") updates.notified_at = new Date().toISOString();
    if (status === "seated") updates.seated_at = new Date().toISOString();
    if (status === "cancelled") updates.cancelled_at = new Date().toISOString();
    if (status === "extended") { updates.extensions_used = 1; updates.extra_minutes = extra_minutes || 10; }
  }
  if (activity !== undefined) updates.activity = activity;
  if (distance_m !== undefined) updates.distance_m = distance_m;
  const { data, error } = await supabase
    .from("waitlist").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
