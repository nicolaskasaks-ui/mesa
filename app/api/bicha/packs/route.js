import { supabaseServer } from "@/lib/supabase-server";
import { sendWhatsApp } from "@/lib/twilio";
import { NextResponse } from "next/server";

// Generate a short unique redeem code (6 alphanumeric chars)
function generateRedeemCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const GAME_LABELS = {
  pingpong: "Ping Pong",
  pool: "Pool",
  metegol: "Metegol",
};

// GET — fetch packs (available packs, customer's purchased packs, or lookup by redeem code)
export async function GET(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const type = searchParams.get("type");
  const code = searchParams.get("code"); // QR redeem code lookup

  // Staff scans QR → lookup by redeem code
  if (code) {
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .select("*, bicha_packs(name, description, units, includes_game, game_type)")
      .eq("redeem_code", code.toUpperCase())
      .single();
    if (error || !data) return NextResponse.json({ error: "Code not found" }, { status: 404 });
    return NextResponse.json(data);
  }

  if (type === "available") {
    const { data, error } = await supabaseServer
      .from("bicha_packs")
      .select("*")
      .eq("active", true)
      .order("price");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (phone) {
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .select("*, bicha_packs(name, description, units, includes_game, game_type)")
      .eq("phone", phone)
      .gt("remaining", 0)
      .order("purchased_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // All purchases today (for staff dashboard)
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseServer
    .from("bicha_pack_purchases")
    .select("*, bicha_packs(name, description, units, includes_game, game_type)")
    .gte("purchased_at", today + "T00:00:00")
    .order("purchased_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — purchase a pack
export async function POST(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { pack_id, guest_name, phone, payment_method, game_type } = body;

  if (!pack_id || !guest_name || !phone || !payment_method) {
    return NextResponse.json({ error: "pack_id, guest_name, phone, payment_method required" }, { status: 400 });
  }

  const { data: pack, error: packErr } = await supabaseServer
    .from("bicha_packs")
    .select("*")
    .eq("id", pack_id)
    .single();
  if (packErr || !pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  const redeem_code = generateRedeemCode();

  const { data, error } = await supabaseServer.from("bicha_pack_purchases").insert({
    pack_id,
    redeem_code,
    guest_name,
    phone,
    payment_method,
    payment_status: payment_method === "mercadopago" ? "pending" : "pending",
    remaining: pack.units,
    game_available: pack.includes_game,
    game_type: game_type || pack.game_type || null,
  }).select("*, bicha_packs(name, description, units, includes_game, game_type)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0], { status: 201 });
}

// PATCH — confirm payment, redeem unit, redeem game
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, code, action } = body;

  // Allow lookup by id or redeem_code
  const lookupId = id;
  const lookupCode = code?.toUpperCase();

  if (!lookupId && !lookupCode) return NextResponse.json({ error: "id or code required" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  // Build the query filter
  const filter = lookupId ? { id: lookupId } : { redeem_code: lookupCode };
  const filterKey = lookupId ? "id" : "redeem_code";
  const filterVal = lookupId || lookupCode;

  if (action === "confirm_payment") {
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .update({ payment_status: "confirmed" })
      .eq(filterKey, filterVal)
      .select("*, bicha_packs(name, includes_game, game_type)");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const purchase = data[0];
    if (purchase?.phone) {
      const gameLabel = GAME_LABELS[purchase.game_type] || "juego";
      const gameMsg = purchase.game_available
        ? `\n🎮 ¡Incluye 1 hora de ${gameLabel} gratis!`
        : "";
      const msg = `¡${purchase.guest_name}! Tu pack "${purchase.bicha_packs?.name}" está confirmado.\n\nTu código de canje: ${purchase.redeem_code}\nMostrá el QR en la app para canjear.${gameMsg}`;
      await sendWhatsApp({ to: purchase.phone, guestName: purchase.guest_name, message: msg });
    }
    return NextResponse.json(purchase);
  }

  if (action === "redeem") {
    const { data: current } = await supabaseServer
      .from("bicha_pack_purchases")
      .select("id, remaining, payment_status")
      .eq(filterKey, filterVal)
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
      .eq("id", current.id)
      .select("*, bicha_packs(name)");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data[0]);
  }

  if (action === "redeem_game") {
    const { data, error } = await supabaseServer
      .from("bicha_pack_purchases")
      .update({ game_available: false })
      .eq(filterKey, filterVal)
      .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data[0]);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
