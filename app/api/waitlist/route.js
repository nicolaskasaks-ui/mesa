import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { sendWhatsApp, msgPositionUpdate, msgPostVisit, msgLevelUp, msgBirthday, msgStillWaiting } from "../../../lib/twilio";

// ── Trust level thresholds ──
const TRUST_THRESHOLDS = { 1: 1, 2: 3, 3: 5 }; // visits needed for each level

function computeTrust(visitCount, noShowCount) {
  if (noShowCount > 0 && visitCount < 3) return 0;
  if (visitCount >= TRUST_THRESHOLDS[3]) return 3;
  if (visitCount >= TRUST_THRESHOLDS[2]) return 2;
  if (visitCount >= TRUST_THRESHOLDS[1]) return 1;
  return 0;
}

export async function GET() {
  // Auto-expire: notified guests past 15 min (10 + 5 grace) → cancelled
  const expiryCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: expired } = await supabase.from("waitlist")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("status", "notified")
    .lt("notified_at", expiryCutoff)
    .select("customer_id");

  // Trust downgrade for no-shows
  if (expired?.length) {
    for (const entry of expired) {
      if (entry.customer_id) {
        const { data: cust } = await supabase.from("customers")
          .select("no_show_count").eq("id", entry.customer_id).single();
        await supabase.from("customers").update({
          trust_level: 0,
          no_show_count: (cust?.no_show_count || 0) + 1,
        }).eq("id", entry.customer_id);
      }
    }
  }

  // ── Long wait check: 3h+ waiting → send "still waiting?" WhatsApp ──
  const longWaitCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const longWaitAutoCancel = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();

  // Auto-cancel entries waiting 3.5h+ that haven't confirmed (extensions_used still 0 or null)
  await supabase.from("waitlist")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("status", "waiting")
    .eq("extensions_used", 0)
    .lt("joined_at", longWaitAutoCancel);

  // Send "still waiting?" to entries between 3h and 3.5h (only if not yet checked)
  // We use extensions_used = 0 → not yet asked, set to -1 after asking
  const { data: longWaiters } = await supabase.from("waitlist")
    .select("id, guest_name, customers(phone)")
    .eq("status", "waiting")
    .or("extensions_used.is.null,extensions_used.eq.0")
    .lt("joined_at", longWaitCutoff)
    .gte("joined_at", longWaitAutoCancel);

  if (longWaiters?.length) {
    for (const entry of longWaiters) {
      const phone = entry.customers?.phone;
      if (phone) {
        sendWhatsApp({
          to: phone.replace(/\D/g, ""),
          guestName: entry.guest_name,
          message: msgStillWaiting({ guestName: entry.guest_name }),
        }).catch(() => {});
      }
      // Mark as checked so we don't resend
      await supabase.from("waitlist")
        .update({ extensions_used: -1 })
        .eq("id", entry.id);
    }
  }

  const { data, error } = await supabase
    .from("waitlist")
    .select("*, customers(name, phone, allergies, visit_count, trust_level, birthday, tags, no_show_count)")
    .in("status", ["waiting", "notified", "extended"])
    .order("joined_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const { guest_name, party_size, allergies, phone, notes, source, birthday, referral_code } = body;
  let customer_id = null;
  let isNew = false;
  let oldTrust = 0;

  if (guest_name) {
    const { data: existing } = await supabase
      .from("customers").select("id, visit_count, trust_level, no_show_count")
      .ilike("name", guest_name).limit(1).single();
    if (existing) {
      customer_id = existing.id;
      oldTrust = existing.trust_level || 0;
      const newVisitCount = existing.visit_count + 1;
      const newTrust = computeTrust(newVisitCount, existing.no_show_count || 0);
      await supabase.from("customers").update({
        visit_count: newVisitCount,
        last_visit: new Date().toISOString(),
        trust_level: newTrust,
        ...(allergies?.length ? { allergies } : {}),
        ...(phone ? { phone } : {}),
        ...(birthday ? { birthday } : {}),
      }).eq("id", existing.id);
    } else {
      isNew = true;
      const { data: newC } = await supabase.from("customers").insert({
        name: guest_name, phone: phone || null,
        allergies: allergies || [], visit_count: 1,
        trust_level: 0, no_show_count: 0,
        last_visit: new Date().toISOString(),
        ...(birthday ? { birthday } : {}),
      }).select("id").single();
      if (newC) customer_id = newC.id;
    }
  }

  // Prevent duplicate active entries for same customer
  if (customer_id) {
    const { data: activeEntry } = await supabase
      .from("waitlist").select("id")
      .eq("customer_id", customer_id)
      .in("status", ["waiting", "notified", "extended"])
      .limit(1).single();
    if (activeEntry) {
      return NextResponse.json({ error: "Ya estas en la fila" }, { status: 409 });
    }
  }

  // Track referral
  let referred_by = null;
  if (referral_code) {
    const { data: referrer } = await supabase.from("customers")
      .select("id").eq("referral_code", referral_code).limit(1).single();
    if (referrer) referred_by = referrer.id;
  }

  const { data, error } = await supabase.from("waitlist").insert({
    customer_id, guest_name, party_size: party_size || 2,
    source: source || "qr", notes: notes || null, status: "waiting",
    ...(referred_by ? { referred_by } : {}),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, isNew });
}

// DELETE — cancel all or old entries
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "old";

  let query = supabase.from("waitlist")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .in("status", ["waiting", "notified", "extended"]);

  if (mode === "old") {
    const cutoff = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    query = query.lt("joined_at", cutoff);
  }

  const { data, error } = await query.select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cancelled: data?.length || 0 });
}

export async function PATCH(request) {
  const body = await request.json();
  const { id, status, extra_minutes, activity, distance_m } = body;
  const updates = {};
  if (status) {
    updates.status = status;
    if (status === "notified") updates.notified_at = new Date().toISOString();
    if (status === "seated") updates.seated_at = new Date().toISOString();
    if (status === "cancelled") updates.cancelled_at = new Date().toISOString();
    if (status === "extended") { updates.extensions_used = 1; updates.extra_minutes = extra_minutes || 10; }
  }
  if (activity !== undefined) updates.activity = activity;
  if (distance_m !== undefined) updates.distance_m = distance_m;

  const { data, error } = await supabase
    .from("waitlist").update(updates).eq("id", id).select("*, customers(id, name, phone, visit_count, trust_level, no_show_count)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── SEATED: trust upgrade + post-visit WhatsApp (24h later via scheduled) ──
  if (status === "seated" && data.customer_id) {
    const cust = data.customers;
    if (cust) {
      // Recalculate trust after successful seating
      const newTrust = computeTrust(cust.visit_count, cust.no_show_count || 0);
      if (newTrust !== cust.trust_level) {
        await supabase.from("customers").update({ trust_level: newTrust }).eq("id", cust.id);
        // Send level-up WhatsApp
        if (newTrust > cust.trust_level && cust.phone) {
          const levelNames = { 1: "Verificado", 2: "Confiable", 3: "Habitual" };
          sendWhatsApp({
            to: cust.phone.replace(/\D/g, ""),
            guestName: cust.name || data.guest_name,
            message: msgLevelUp({ guestName: cust.name || data.guest_name, level: levelNames[newTrust] || "VIP" }),
          }).catch(() => {});
        }
      }
      // Schedule post-visit thank you (fire immediately for now, ideally delayed 2h)
      if (cust.phone) {
        // Wait 2 hours then send thank you
        setTimeout(() => {
          sendWhatsApp({
            to: cust.phone.replace(/\D/g, ""),
            guestName: cust.name || data.guest_name,
            message: msgPostVisit({ guestName: cust.name || data.guest_name }),
          }).catch(() => {});
        }, 2 * 60 * 60 * 1000); // 2 hours
      }
    }
  }

  // ── CANCELLED (no-show from notified): trust downgrade ──
  if (status === "cancelled" && data.customer_id) {
    // Check if was notified (no-show)
    if (data.notified_at && !data.seated_at) {
      await supabase.from("customers").update({
        trust_level: 0,
        no_show_count: (data.customers?.no_show_count || 0) + 1,
      }).eq("id", data.customer_id);
    }
  }

  // When someone leaves the queue, notify #1, #2, #3 of their new position
  if (status === "seated" || status === "cancelled") {
    try {
      const { data: remaining } = await supabase.from("waitlist")
        .select("id, guest_name, customers(phone)")
        .in("status", ["waiting", "extended"])
        .order("joined_at", { ascending: true });
      if (remaining) {
        const total = remaining.length;
        for (let i = 0; i < Math.min(3, total); i++) {
          const pos = i + 1;
          const phone = remaining[i].customers?.phone;
          if (phone) {
            sendWhatsApp({
              to: phone.replace(/\D/g, ""),
              guestName: remaining[i].guest_name,
              message: msgPositionUpdate({ guestName: remaining[i].guest_name, position: pos, total }),
            }).catch(() => {});
          }
        }
      }
    } catch {}
  }

  return NextResponse.json(data);
}
