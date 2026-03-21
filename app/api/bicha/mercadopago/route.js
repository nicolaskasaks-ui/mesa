import { supabaseServer } from "../../../../lib/supabase-server";
import { NextResponse } from "next/server";

// MercadoPago Checkout Integration
// Set these env vars in Vercel:
//   MP_ACCESS_TOKEN — your MercadoPago access token
//   MP_PUBLIC_KEY — your MercadoPago public key
//   NEXT_PUBLIC_BASE_URL — your app URL (e.g., https://mesa-xi.vercel.app)

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://mesa-xi.vercel.app";

// POST — create a MercadoPago checkout preference for a pack purchase
export async function POST(req) {
  if (!MP_ACCESS_TOKEN) {
    return NextResponse.json({
      error: "MercadoPago not configured. Set MP_ACCESS_TOKEN env var.",
      fallback: "manual", // tell the client to use manual payment
    }, { status: 501 });
  }

  const body = await req.json();
  const { pack_purchase_id, pack_name, price, guest_name, phone } = body;

  if (!pack_purchase_id || !pack_name || !price) {
    return NextResponse.json({ error: "pack_purchase_id, pack_name, price required" }, { status: 400 });
  }

  try {
    const preference = {
      items: [{
        title: `La Bicha — ${pack_name}`,
        quantity: 1,
        unit_price: price,
        currency_id: "ARS",
      }],
      payer: {
        name: guest_name || "Cliente",
      },
      back_urls: {
        success: `${BASE_URL}/bicha?mp_status=approved&purchase_id=${pack_purchase_id}`,
        failure: `${BASE_URL}/bicha?mp_status=rejected&purchase_id=${pack_purchase_id}`,
        pending: `${BASE_URL}/bicha?mp_status=pending&purchase_id=${pack_purchase_id}`,
      },
      auto_return: "approved",
      external_reference: pack_purchase_id,
      notification_url: `${BASE_URL}/api/bicha/mercadopago?webhook=1`,
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("MP error:", data);
      return NextResponse.json({ error: "MercadoPago error", details: data }, { status: 500 });
    }

    return NextResponse.json({
      checkout_url: data.init_point,
      preference_id: data.id,
    });
  } catch (err) {
    console.error("MP error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — MercadoPago webhook (IPN notification)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const webhook = searchParams.get("webhook");

  if (!webhook) {
    return NextResponse.json({ configured: !!MP_ACCESS_TOKEN });
  }

  // Handle webhook notification
  const topic = searchParams.get("topic");
  const id = searchParams.get("id");

  if (topic === "payment" && id && MP_ACCESS_TOKEN) {
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
      });
      const payment = await res.json();

      if (payment.status === "approved" && payment.external_reference) {
        // Auto-confirm the pack purchase
        if (supabaseServer) {
          await supabaseServer
            .from("bicha_pack_purchases")
            .update({ payment_status: "confirmed" })
            .eq("id", payment.external_reference);
        }
      }
    } catch (err) {
      console.error("MP webhook error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
