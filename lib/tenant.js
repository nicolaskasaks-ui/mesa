// ═══════════════════════════════════════════════════
// TENANT RESOLUTION & CONFIG
// Resolves tenant from slug/domain, provides config
// ═══════════════════════════════════════════════════
import { supabaseServer } from "./supabase-server";

// Default tenant for backward compatibility (Chuí)
const DEFAULT_TENANT_SLUG = "chui";
const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

// In-memory cache (TTL 60s) — avoids DB hit on every request
const cache = new Map();
const CACHE_TTL = 60_000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// Resolve tenant from request headers (set by middleware)
// or from explicit slug parameter
export async function getTenant(slugOrRequest) {
  let slug = null;

  if (typeof slugOrRequest === "string") {
    slug = slugOrRequest;
  } else if (slugOrRequest?.headers) {
    // From Next.js request headers (set by middleware)
    slug = slugOrRequest.headers.get("x-tenant-slug") || DEFAULT_TENANT_SLUG;
  } else {
    slug = DEFAULT_TENANT_SLUG;
  }

  // Check cache
  const cached = getCached(`tenant:${slug}`);
  if (cached) return cached;

  if (!supabaseServer) {
    // Fallback: return hardcoded Chuí config if no DB
    const fallback = getHardcodedChui();
    setCache(`tenant:${slug}`, fallback);
    return fallback;
  }

  const { data, error } = await supabaseServer
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) {
    // If tenant not found, try by custom domain
    const { data: domainData } = await supabaseServer
      .from("tenants")
      .select("*")
      .eq("custom_domain", slug)
      .eq("status", "active")
      .single();

    if (domainData) {
      const tenant = normalizeTenant(domainData);
      setCache(`tenant:${slug}`, tenant);
      return tenant;
    }

    // Fallback to Chuí
    const fallback = getHardcodedChui();
    setCache(`tenant:${slug}`, fallback);
    return fallback;
  }

  const tenant = normalizeTenant(data);
  setCache(`tenant:${slug}`, tenant);
  return tenant;
}

// Get tenant by ID (for API routes that already know the ID)
export async function getTenantById(tenantId) {
  if (!tenantId) return getHardcodedChui();

  const cached = getCached(`tenant_id:${tenantId}`);
  if (cached) return cached;

  if (!supabaseServer) return getHardcodedChui();

  const { data } = await supabaseServer
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .eq("status", "active")
    .single();

  if (!data) return getHardcodedChui();

  const tenant = normalizeTenant(data);
  setCache(`tenant_id:${tenantId}`, tenant);
  return tenant;
}

// Normalize DB row into the config shape used by the app
function normalizeTenant(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    vertical: row.vertical,
    // Location
    address: row.address,
    city: row.city,
    country: row.country,
    lat: parseFloat(row.lat) || 0,
    lng: parseFloat(row.lng) || 0,
    timezone: row.timezone,
    locale: row.locale,
    // Branding
    logo: row.logo_url || "/logo-dark.png",
    favicon: row.favicon_url,
    accentColor: row.accent_color || "#1A1A1A",
    secondaryColor: row.secondary_color || "#2D7A4F",
    fontDisplay: row.font_display || "Outfit",
    fontBody: row.font_body || "Nunito",
    customCss: row.custom_css,
    // Auth
    pin: row.pin || "0000",
    // Operational
    walkAroundRadius: row.walk_around_radius_m || 300,
    walkAroundMinutes: row.walk_around_minutes || 15,
    arrivalMinutes: row.arrival_minutes || 10,
    graceMinutes: row.grace_minutes || 5,
    autoCleanupHours: row.auto_cleanup_hours || 6,
    longWaitHours: parseFloat(row.long_wait_hours) || 3.0,
    // Features
    features: row.features || {},
    // Links
    otLink: row.opentable_url,
    instagram: row.instagram_handle,
    instagramUrl: row.instagram_url,
    googleReviewUrl: row.google_review_url,
    // WhatsApp
    twilioPhone: row.twilio_phone_number,
    usesSharedNumber: row.uses_shared_number !== false,
    // Billing
    plan: row.plan || "free",
    // Status
    status: row.status,
  };
}

// Hardcoded Chuí config — used when DB is unavailable
function getHardcodedChui() {
  return {
    id: DEFAULT_TENANT_ID,
    slug: "chui",
    name: "Chuí",
    vertical: "restaurant",
    address: "Loyola 1250, Villa Crespo",
    city: "Buenos Aires",
    country: "AR",
    lat: -34.59013,
    lng: -58.44112,
    timezone: "America/Argentina/Buenos_Aires",
    locale: "es-AR",
    logo: "/logo-dark.png",
    favicon: null,
    accentColor: "#1A1A1A",
    secondaryColor: "#2D7A4F",
    fontDisplay: "Outfit",
    fontBody: "Nunito",
    customCss: null,
    pin: "1250",
    walkAroundRadius: 300,
    walkAroundMinutes: 15,
    arrivalMinutes: 10,
    graceMinutes: 5,
    autoCleanupHours: 6,
    longWaitHours: 3.0,
    features: {
      bar_promo: true,
      walk_around: true,
      referral: true,
      pre_order: true,
      gps_tracking: true,
      whatsapp_bot: true,
      analytics: true,
      crm: true,
    },
    otLink: "https://www.opentable.com/r/chui-buenos-aires",
    instagram: "@chui.ba",
    instagramUrl: "https://instagram.com/chui.ba",
    googleReviewUrl: "https://g.page/chui-ba/review",
    twilioPhone: null,
    usesSharedNumber: true,
    plan: "pro",
    status: "active",
  };
}

// Invalidate cache for a tenant (after config change)
export function invalidateTenantCache(slug) {
  for (const [key] of cache) {
    if (key.includes(slug)) cache.delete(key);
  }
}

// Get default tenant ID (for backward compat in routes that don't have tenant context yet)
export function getDefaultTenantId() {
  return DEFAULT_TENANT_ID;
}
