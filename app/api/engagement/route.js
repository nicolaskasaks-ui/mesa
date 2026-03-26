import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { sendWhatsApp, msgBirthday, msgBounceBack, tenantToMsgContext } from "../../../lib/twilio";
import { resolveTenantFromRequest } from "../../../lib/api-tenant";

// GET /api/engagement?action=birthdays — Send birthday wishes
// GET /api/engagement?action=bounceback — Re-engage lapsed regulars
// Can be called daily via cron (Vercel cron or external)
export async function GET(request) {
  const { tenant, tenantId } = await resolveTenantFromRequest(request);
  const tenantContext = tenantToMsgContext(tenant);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "birthdays";

  if (action === "birthdays") {
    return handleBirthdays(tenantId, tenantContext);
  }
  if (action === "bounceback") {
    return handleBounceBack(tenantId, tenantContext);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handleBirthdays(tenantId, tenantContext) {
  if (!supabase) return NextResponse.json({ error: "No supabase" }, { status: 500 });

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  let query = supabase
    .from("customers")
    .select("id, name, phone, birthday")
    .not("birthday", "is", null)
    .not("phone", "is", null);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: customers } = await query;

  if (!customers) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const c of customers) {
    if (!c.birthday || !c.phone) continue;
    const bday = c.birthday.slice(5); // MM-DD
    if (bday === `${mm}-${dd}`) {
      const result = await sendWhatsApp({
        to: c.phone.replace(/\D/g, ""),
        guestName: c.name,
        message: msgBirthday({ guestName: c.name, tenantContext }),
      });
      if (result.ok) sent++;
    }
  }

  return NextResponse.json({ sent, checked: customers.length });
}

async function handleBounceBack(tenantId, tenantContext) {
  if (!supabase) return NextResponse.json({ error: "No supabase" }, { status: 500 });

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("customers")
    .select("id, name, phone, last_visit, trust_level")
    .gte("trust_level", 1)
    .not("phone", "is", null)
    .lt("last_visit", cutoff)
    .order("last_visit", { ascending: true })
    .limit(20);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: lapsed } = await query;

  if (!lapsed) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const c of lapsed) {
    const result = await sendWhatsApp({
      to: c.phone.replace(/\D/g, ""),
      guestName: c.name,
      message: msgBounceBack({ guestName: c.name, tenantContext }),
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ sent, lapsed: lapsed.length });
}
