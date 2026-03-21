import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// POST /api/preorder — Register a pre-order for a waiting guest
export async function POST(request) {
  const { waitlist_id, customer_id, guest_name, items } = await request.json();
  // items is an array of { name, price, quantity }

  if (!waitlist_id || !items?.length) {
    return NextResponse.json({ error: "waitlist_id and items required" }, { status: 400 });
  }

  const records = items.map(item => ({
    waitlist_id,
    customer_id: customer_id || null,
    guest_name: guest_name || null,
    item_name: item.name,
    price: item.price || 0,
    quantity: item.quantity || 1,
    status: "pending",
  }));

  const { data, error } = await supabase.from("preorders").insert(records).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET /api/preorder?waitlist_id=X — Get pre-orders for a waitlist entry
// GET /api/preorder?status=pending — Get all pending pre-orders (for kitchen/bar)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const waitlistId = searchParams.get("waitlist_id");
  const status = searchParams.get("status");

  let query = supabase.from("preorders").select("*").order("created_at", { ascending: true });

  if (waitlistId) {
    query = query.eq("waitlist_id", waitlistId);
  } else if (status) {
    query = query.eq("status", status);
  } else {
    // Default: today's preorders
    const today = new Date().toISOString().slice(0, 10);
    query = query.gte("created_at", `${today}T00:00:00`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/preorder — Update preorder status (pending → preparing → ready → delivered)
export async function PATCH(request) {
  const { id, status } = await request.json();
  const { data, error } = await supabase
    .from("preorders").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
