import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { resolveTenantFromRequest } from "../../../lib/api-tenant";

// POST /api/reset — End-of-shift reset
// Resets all tables to libre and cancels all active waitlist entries
// Called by Supabase cron at 4:00 AM Buenos Aires time, or manually by host
export async function POST(request) {
  const { tenantId } = await resolveTenantFromRequest(request);

  // Optional: verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reset all tables to libre
  let tQuery = supabase.from("tables")
    .update({ status: "libre", seated_at: null, waitlist_id: null, updated_at: new Date().toISOString() })
    .neq("status", "libre");
  if (tenantId) tQuery = tQuery.eq("tenant_id", tenantId);
  const { data: tables } = await tQuery.select("id");

  // Cancel all active waitlist entries
  let wQuery = supabase.from("waitlist")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .in("status", ["waiting", "notified", "extended"]);
  if (tenantId) wQuery = wQuery.eq("tenant_id", tenantId);
  const { data: waitlist } = await wQuery.select("id");

  return NextResponse.json({
    reset: true,
    tables_freed: tables?.length || 0,
    waitlist_cancelled: waitlist?.length || 0,
    timestamp: new Date().toISOString(),
  });
}
