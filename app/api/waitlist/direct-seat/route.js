import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../../lib/supabase-server";

// Direct seat: creates a waitlist entry already as "seated" (skips queue)
// Used for Walk-in and OpenTable entries that don't go through the Meantime queue
export async function POST(request) {
  const { guest_name, party_size, source, table_id } = await request.json();

  // Create waitlist entry directly as seated
  const now = new Date().toISOString();
  const { data: entry, error } = await supabase.from("waitlist").insert({
    guest_name: guest_name || (source === "opentable" ? "Reserva OT" : "Mesa directa"),
    party_size: party_size || 2,
    source: source || "walkin",
    status: "seated",
    joined_at: now,
    seated_at: now,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update table to sentado with the waitlist entry linked
  if (table_id && entry) {
    await supabase.from("tables").update({
      status: "sentado",
      seated_at: now,
      waitlist_id: entry.id,
      updated_at: now,
    }).eq("id", table_id);
  }

  return NextResponse.json(entry);
}
