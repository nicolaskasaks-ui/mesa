import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// GET /api/tenants?slug=chui — Public: get tenant config for client-side
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, vertical, address, city, country, lat, lng, timezone, locale, logo_url, favicon_url, accent_color, secondary_color, font_display, font_body, custom_css, walk_around_radius_m, walk_around_minutes, arrival_minutes, grace_minutes, features, opentable_url, instagram_handle, instagram_url, google_review_url, plan")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// POST /api/tenants — Onboarding: create new tenant
export async function POST(request) {
  const body = await request.json();
  const { name, slug, vertical, address, city, country, lat, lng, pin, email, phone } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }

  // Check slug availability
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: "slug already taken" }, { status: 409 });
  }

  // Create tenant
  const { data: tenant, error } = await supabase.from("tenants").insert({
    name,
    slug,
    vertical: vertical || "restaurant",
    address: address || null,
    city: city || null,
    country: country || "AR",
    lat: lat || null,
    lng: lng || null,
    pin: pin || "0000",
    email: email || null,
    phone: phone || null,
    status: "onboarding",
    features: getDefaultFeatures(vertical || "restaurant"),
  }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create default tables/service points for the tenant
  if (tenant) {
    await createDefaultServicePoints(tenant.id, vertical || "restaurant");
  }

  return NextResponse.json(tenant, { status: 201 });
}

function getDefaultFeatures(vertical) {
  const base = {
    whatsapp_bot: true,
    analytics: true,
    crm: true,
  };

  switch (vertical) {
    case "restaurant":
      return { ...base, bar_promo: true, walk_around: true, referral: true, pre_order: true, gps_tracking: true };
    case "healthcare":
      return { ...base, priority_queue: true, multi_queue: true };
    case "salon":
      return { ...base, walk_around: false, gps_tracking: false };
    default:
      return base;
  }
}

async function createDefaultServicePoints(tenantId, vertical) {
  const points = [];

  if (vertical === "restaurant") {
    // Create 10 default tables
    for (let i = 1; i <= 10; i++) {
      points.push({
        tenant_id: tenantId,
        id: i,
        capacity: i <= 4 ? 2 : i <= 7 ? 4 : 6,
        status: "libre",
      });
    }
    // Use existing "tables" table for now (Phase 1 compat)
    for (const p of points) {
      await supabase.from("tables").insert(p);
    }
  }
}
