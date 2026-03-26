import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { sendWhatsApp } from "../../../lib/twilio";
import { resolveTenantFromRequest } from "../../../lib/api-tenant";

// GET /api/referral?customer_id=X — Get or generate referral code
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");

  if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, referral_code, trust_level")
    .eq("id", customerId)
    .single();

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Only trust >= 1 can refer
  if ((customer.trust_level || 0) < 1) {
    return NextResponse.json({ error: "Necesitas al menos 1 visita para referir amigos" }, { status: 403 });
  }

  // Generate referral code if doesn't exist
  if (!customer.referral_code) {
    const code = customer.name.split(" ")[0].toUpperCase().slice(0, 4) + Math.random().toString(36).slice(2, 6).toUpperCase();
    await supabase.from("customers").update({ referral_code: code }).eq("id", customerId);
    return NextResponse.json({ referral_code: code, link: `https://mesa-xi.vercel.app/?ref=${code}` });
  }

  return NextResponse.json({ referral_code: customer.referral_code, link: `https://mesa-xi.vercel.app/?ref=${customer.referral_code}` });
}

// POST /api/referral — Track referral redemption when referred guest is seated
export async function POST(request) {
  const { referrer_id, referred_customer_id } = await request.json();

  if (!referrer_id || !referred_customer_id) {
    return NextResponse.json({ error: "Both IDs required" }, { status: 400 });
  }

  // Get referrer info
  const { data: referrer } = await supabase
    .from("customers")
    .select("id, name, phone, visit_count, trust_level")
    .eq("id", referrer_id)
    .single();

  if (!referrer) return NextResponse.json({ error: "Referrer not found" }, { status: 404 });

  // Notify referrer via WhatsApp
  const { tenant } = await resolveTenantFromRequest(request);
  const tName = tenant?.name || "el local";
  if (referrer.phone) {
    sendWhatsApp({
      to: referrer.phone.replace(/\D/g, ""),
      guestName: referrer.name,
      message: `${referrer.name}, tu amigo/a vino a ${tName} gracias a tu recomendacion! La proxima vez que vengas, te invitamos un postre. Gracias por difundir!`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
