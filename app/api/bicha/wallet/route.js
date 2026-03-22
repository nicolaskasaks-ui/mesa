import { supabaseServer } from "../../../../lib/supabase-server";
import { sendWhatsApp } from "../../../../lib/twilio";
import { NextResponse } from "next/server";

// GET — fetch wallet info, transactions, or pending top-ups (for staff)
export async function GET(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const pending = searchParams.get("pending"); // staff: list pending top-ups

  // Staff: list pending top-up transactions
  if (pending === "true") {
    const { data, error } = await supabaseServer
      .from("bicha_wallet_transactions")
      .select("*, bicha_wallets(name)")
      .eq("type", "topup")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Customer: get wallet + recent transactions
  if (phone) {
    const { data: wallet } = await supabaseServer
      .from("bicha_wallets")
      .select("*")
      .eq("phone", phone)
      .single();
    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    const { data: txns } = await supabaseServer
      .from("bicha_wallet_transactions")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ wallet, transactions: txns || [] });
  }

  // All wallets (for admin)
  const { data, error } = await supabaseServer
    .from("bicha_wallets")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — confirm or reject a top-up transaction
export async function PATCH(req) {
  if (!supabaseServer) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { id, action } = body; // action: "confirm" or "reject"

  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  // Get the transaction
  const { data: tx, error: txErr } = await supabaseServer
    .from("bicha_wallet_transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (txErr || !tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (tx.status !== "pending") return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });

  if (action === "confirm") {
    // Update transaction status
    await supabaseServer
      .from("bicha_wallet_transactions")
      .update({ status: "confirmed" })
      .eq("id", id);

    // Add balance to wallet
    const { data: wallet } = await supabaseServer
      .from("bicha_wallets")
      .select("balance")
      .eq("phone", tx.phone)
      .single();

    const newBalance = Number(wallet.balance) + Number(tx.amount);
    await supabaseServer
      .from("bicha_wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("phone", tx.phone);

    // Notify customer via WhatsApp
    const { data: w } = await supabaseServer.from("bicha_wallets").select("name").eq("phone", tx.phone).single();
    const msg = `${w?.name || "Hola"}! Se acreditaron $${Number(tx.amount).toLocaleString("es-AR")} a tu wallet.\n\n💰 Saldo actual: $${newBalance.toLocaleString("es-AR")}\n\nEscribi *hola* para ver el menu.`;
    await sendWhatsApp({ to: tx.phone, guestName: w?.name, message: msg });

    return NextResponse.json({ ok: true, new_balance: newBalance });
  }

  if (action === "reject") {
    await supabaseServer
      .from("bicha_wallet_transactions")
      .update({ status: "rejected" })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
