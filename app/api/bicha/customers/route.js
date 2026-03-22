import { supabaseServer } from "../../../../lib/supabase-server";
import { NextResponse } from "next/server";

// GET — fetch customer by phone or all customers
export async function GET(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (phone) {
    const { data, error } = await supabaseServer
      .from("bicha_customers")
      .select("*")
      .eq("phone", phone)
      .single();
    if (error) return NextResponse.json(null);
    return NextResponse.json(data);
  }

  const { data, error } = await supabaseServer
    .from("bicha_customers")
    .select("*")
    .order("last_visit", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — update customer (e.g., redeem stamps)
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("bicha_customers")
    .update(updates)
    .eq("id", id)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}
