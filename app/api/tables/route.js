import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// GET — all tables with current status
export async function GET() {
  const { data, error } = await supabase
    .from("tables")
    .select("*, waitlist(guest_name, party_size)")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — change table status
export async function PATCH(request) {
  const { id, status, waitlist_id } = await request.json();

  const updates = { status, updated_at: new Date().toISOString() };

  if (status === "sentado") {
    updates.seated_at = new Date().toISOString();
    if (waitlist_id) updates.waitlist_id = waitlist_id;
  }

  if (status === "libre") {
    updates.seated_at = null;
    updates.waitlist_id = null;

    // Auto-notify: find next waiting person and mark as notified
    const { data: nextInLine } = await supabase
      .from("waitlist")
      .select("id, guest_name, customers(phone)")
      .eq("status", "waiting")
      .order("joined_at", { ascending: true })
      .limit(1)
      .single();

    if (nextInLine) {
      await supabase
        .from("waitlist")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", nextInLine.id);

      // Return the notified person so the hostess can WhatsApp them
      const { data: table, error } = await supabase
        .from("tables").update(updates).eq("id", id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ table, notified: nextInLine });
    }
  }

  const { data, error } = await supabase
    .from("tables").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
