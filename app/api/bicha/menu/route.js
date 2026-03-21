import { supabaseServer } from "../../../../lib/supabase-server";
import { NextResponse } from "next/server";

// GET — fetch menu items (optionally filter by category or available)
export async function GET(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const available = searchParams.get("available");

  let q = supabaseServer.from("bicha_menu_items").select("*").order("category").order("name");
  if (category) q = q.eq("category", category);
  if (available === "true") q = q.eq("available", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create menu item
export async function POST(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { name, price, category, description } = body;
  if (!name || price == null || !category) {
    return NextResponse.json({ error: "name, price, category required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer.from("bicha_menu_items").insert({
    name, price, category, description: description || null, available: true,
  }).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0], { status: 201 });
}

// PATCH — update menu item
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabaseServer.from("bicha_menu_items").update(updates).eq("id", id).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}

// DELETE — remove menu item
export async function DELETE(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseServer.from("bicha_menu_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
