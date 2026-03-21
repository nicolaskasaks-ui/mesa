import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { sendWhatsApp, msgBirthday, msgBounceBack } from "../../../lib/twilio";

// GET /api/engagement?action=birthdays — Send birthday wishes
// GET /api/engagement?action=bounceback — Re-engage lapsed regulars
// Can be called daily via cron (Vercel cron or external)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "birthdays";

  if (action === "birthdays") {
    return handleBirthdays();
  }
  if (action === "bounceback") {
    return handleBounceBack();
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handleBirthdays() {
  if (!supabase) return NextResponse.json({ error: "No supabase" }, { status: 500 });

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  // Find customers whose birthday is today (match month-day)
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, birthday")
    .not("birthday", "is", null)
    .not("phone", "is", null);

  if (!customers) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const c of customers) {
    if (!c.birthday || !c.phone) continue;
    const bday = c.birthday.slice(5); // MM-DD
    if (bday === `${mm}-${dd}`) {
      const result = await sendWhatsApp({
        to: c.phone.replace(/\D/g, ""),
        guestName: c.name,
        message: msgBirthday({ guestName: c.name }),
      });
      if (result.ok) sent++;
    }
  }

  return NextResponse.json({ sent, checked: customers.length });
}

async function handleBounceBack() {
  if (!supabase) return NextResponse.json({ error: "No supabase" }, { status: 500 });

  // Find customers with trust >= 1 who haven't visited in 14+ days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: lapsed } = await supabase
    .from("customers")
    .select("id, name, phone, last_visit, trust_level")
    .gte("trust_level", 1)
    .not("phone", "is", null)
    .lt("last_visit", cutoff)
    .order("last_visit", { ascending: true })
    .limit(20); // batch of 20 per run

  if (!lapsed) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const c of lapsed) {
    const result = await sendWhatsApp({
      to: c.phone.replace(/\D/g, ""),
      guestName: c.name,
      message: msgBounceBack({ guestName: c.name }),
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ sent, lapsed: lapsed.length });
}
