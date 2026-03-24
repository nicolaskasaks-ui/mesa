import { NextResponse } from "next/server";
import { sendWhatsApp, msgTableReady } from "../../../lib/twilio";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

export async function GET() {
  // Auto-cleanup: tables occupied for 6+ hours → reset to libre (zombie tables)
  const zombieCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  // Clean by seated_at
  await supabase.from("tables")
    .update({ status: "libre", seated_at: null, waitlist_id: null, updated_at: new Date().toISOString() })
    .in("status", ["sentado", "postre", "pidio_cuenta"])
    .not("seated_at", "is", null)
    .lt("seated_at", zombieCutoff);
  // Also clean tables stuck in postre/cuenta with no seated_at but old updated_at
  await supabase.from("tables")
    .update({ status: "libre", seated_at: null, waitlist_id: null, updated_at: new Date().toISOString() })
    .in("status", ["sentado", "postre", "pidio_cuenta"])
    .is("seated_at", null)
    .lt("updated_at", zombieCutoff);

  const { data, error } = await supabase
    .from("tables")
    .select("*, waitlist(guest_name, party_size, source, customers!waitlist_customer_id_fkey(allergies))")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

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

    const { data: nextInLine } = await supabase
      .from("waitlist")
      .select("id, guest_name, customers!waitlist_customer_id_fkey(phone)")
      .eq("status", "waiting")
      .order("joined_at", { ascending: true })
      .limit(1)
      .single();

    if (nextInLine) {
      await supabase.from("waitlist")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", nextInLine.id);

      const phone = nextInLine.customers?.phone;
      let whatsappSent = false;
      if (phone) {
        const result = await sendWhatsApp({
          to: phone,
          guestName: nextInLine.guest_name,
          message: msgTableReady({ guestName: nextInLine.guest_name, arrivalMinutes: 10 }),
        });
        whatsappSent = result.ok;
      }

      const { data: table, error } = await supabase
        .from("tables").update(updates).eq("id", id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ table, notified: nextInLine, whatsappSent });
    }
  }

  const { data, error } = await supabase
    .from("tables").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
