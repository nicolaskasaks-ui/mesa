import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// POST — register a bar redemption (promo 2x1 or paid consumption)
export async function POST(request) {
  const { waitlist_id, customer_id, guest_name, item, is_promo, price } = await request.json();

  const row = {
    waitlist_id,
    customer_id,
    guest_name,
    item: item || "2x1",
    redeemed_at: new Date().toISOString(),
  };

  // Include is_promo and price if provided (graceful: columns may not exist yet)
  if (typeof is_promo === "boolean") row.is_promo = is_promo;
  if (typeof price === "number") row.price = price;

  const { data, error } = await supabase
    .from("bar_redemptions")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET — list today's redemptions with optional date filter
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const type = searchParams.get("type"); // "promo", "paid", or null for all

  let query = supabase
    .from("bar_redemptions")
    .select("*")
    .gte("redeemed_at", `${date}T00:00:00`)
    .lte("redeemed_at", `${date}T23:59:59`)
    .order("redeemed_at", { ascending: false });

  if (type === "promo") query = query.eq("is_promo", true);
  if (type === "paid") query = query.eq("is_promo", false);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute summary
  const promos = (data || []).filter(r => r.is_promo !== false && r.is_promo !== 0);
  const paid = (data || []).filter(r => r.is_promo === false || r.is_promo === 0);
  const paidTotal = paid.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);

  return NextResponse.json({
    redemptions: data || [],
    summary: {
      promo_count: promos.length,
      paid_count: paid.length,
      paid_total: paidTotal,
      total_revenue: paidTotal,
    },
  });
}
