import { supabaseServer } from "../../../../lib/supabase-server";
import { NextResponse } from "next/server";

// GET — all packs (including inactive) for admin
export async function GET() {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { data, error } = await supabaseServer
    .from("bicha_packs")
    .select("*")
    .order("category")
    .order("price");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create a new pack definition
export async function POST(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { name, description, category, units, price, includes_game, game_type } = body;

  if (!name || !category || !units || !price) {
    return NextResponse.json({ error: "name, category, units, price required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer.from("bicha_packs").insert({
    name,
    description: description || null,
    category,
    units,
    price: parseFloat(price),
    includes_game: includes_game || false,
    game_type: game_type || null,
    active: true,
  }).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0], { status: 201 });
}

// PATCH — update pack (edit or toggle active)
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (updates.price) updates.price = parseFloat(updates.price);

  const { data, error } = await supabaseServer
    .from("bicha_packs")
    .update(updates)
    .eq("id", id)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}

// DELETE — remove a pack
export async function DELETE(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseServer.from("bicha_packs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
