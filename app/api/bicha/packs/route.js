import { supabaseServer } from "@/lib/supabase-server";
import { sendWhatsApp } from "@/lib/twilio";
import { NextResponse } from "next/server";

// GET — fetch packs (available packs or customer's purchased packs)
export async function GET(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const type = searchParams.get("type"); // "available" or "purchased"

  if (type === "available") {
    // Return pack definitions
    const { data, error } = await supabaseServer
      .from("bicha_packs")
      .select("*")
      .eq("active", true)
      .order("price");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (phone) {
    // Return customer's purchased packs with remaining units
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .select("*, bicha_packs(name, description, units, includes_pingpong)")
      .eq("phone", phone)
      .gt("remaining", 0)
      .order("purchased_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // All purchases (for admin)
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseServer
    .from("bicha_pack_purchases")
    .select("*, bicha_packs(name, description, units, includes_pingpong)")
    .gte("purchased_at", today + "T00:00:00")
    .order("purchased_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — purchase a pack
export async function POST(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { pack_id, guest_name, phone, payment_method } = body;

  if (!pack_id || !guest_name || !phone || !payment_method) {
    return NextResponse.json({ error: "pack_id, guest_name, phone, payment_method required" }, { status: 400 });
  }

  // Fetch pack details
  const { data: pack, error: packErr } = await supabaseServer
    .from("bicha_packs")
    .select("*")
    .eq("id", pack_id)
    .single();
  if (packErr || !pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  // Create purchase record (pending payment confirmation)
  const { data, error } = await supabaseServer.from("bicha_pack_purchases").insert({
    pack_id,
    guest_name,
    phone,
    payment_method,
    payment_status: "pending",
    remaining: pack.units,
    pingpong_available: pack.includes_pingpong,
  }).select("*, bicha_packs(name, description, units, includes_pingpong)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0], { status: 201 });
}

// PATCH — confirm payment or redeem unit from pack
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, action } = body;
  if (!id || !action) return NextResponse.json({ error: "id, action required" }, { status: 400 });

  if (action === "confirm_payment") {
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .update({ payment_status: "confirmed" })
      .eq("id", id)
      .select("*, bicha_packs(name, includes_pingpong)");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const purchase = data[0];
    if (purchase.phone) {
      const pingpongMsg = purchase.bicha_packs?.includes_pingpong
        ? "\n🏓 ¡Incluye 1 hora de ping pong gratis!"
        : "";
      const msg = `¡${purchase.guest_name}! Tu pack "${purchase.bicha_packs?.name}" está confirmado. Mostrá este mensaje para canjear.${pingpongMsg}`;
      await sendWhatsApp({ to: purchase.phone, guestName: purchase.guest_name, message: msg });
    }
    return NextResponse.json(purchase);
  }

  if (action === "redeem") {
    const { data: current } = await supabaseServer
      .from("bicha_pack_purchases")
      .select("remaining, payment_status")
      .eq("id", id)
      .single();

    if (!current || current.payment_status !== "confirmed") {
      return NextResponse.json({ error: "Pack not confirmed" }, { status: 400 });
    }
    if (current.remaining <= 0) {
      return NextResponse.json({ error: "No units remaining" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .update({ remaining: current.remaining - 1 })
      .eq("id", id)
      .select("*, bicha_packs(name)");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data[0]);
  }

  if (action === "redeem_pingpong") {
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .update({ pingpong_available: false })
      .eq("id", id)
      .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data[0]);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
