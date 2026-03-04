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

      // Auto-send WhatsApp via Twilio
      const phone = nextInLine.customers?.phone;
      let whatsappSent = false;
      if (phone) {
        try {
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
          const waRes = await fetch(`${baseUrl}/api/whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: phone.replace(/\D/g, ""),
              guestName: nextInLine.guest_name,
              waitMinutes: 0,
            }),
          });
          const waData = await waRes.json();
          whatsappSent = waData.success === true;
        } catch (e) {
          console.error("Auto WhatsApp failed:", e);
        }
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
