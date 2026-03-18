import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// POST — register a 2x1 bar redemption
export async function POST(request) {
  const { waitlist_id, customer_id, guest_name, item } = await request.json();

  const { data, error } = await supabase.from("bar_redemptions").insert({
    waitlist_id, customer_id, guest_name,
    item: item || "2x1",
    redeemed_at: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET — list redemptions (for host/analytics)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bar_redemptions")
    .select("*")
    .gte("redeemed_at", `${date}T00:00:00`)
    .lte("redeemed_at", `${date}T23:59:59`)
    .order("redeemed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
