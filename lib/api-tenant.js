// ═══════════════════════════════════════════════════
// API TENANT HELPER
// Extract tenant context from API requests
// ═══════════════════════════════════════════════════
import { getTenant, getDefaultTenantId } from "./tenant";

// Extract tenant slug from request headers (set by middleware)
// Returns { tenant, tenantId } for use in API routes
export async function resolveTenantFromRequest(request) {
  const slug = request.headers.get("x-tenant-slug") || "chui";
  const tenant = await getTenant(slug);
  return {
    tenant,
    tenantId: tenant?.id || getDefaultTenantId(),
  };
}

// Helper: add tenant_id filter to a Supabase query builder
// Usage: tenantQuery(supabase.from("waitlist").select("*"), tenantId)
export function tenantQuery(queryBuilder, tenantId) {
  if (!tenantId) return queryBuilder;
  return queryBuilder.eq("tenant_id", tenantId);
}

// Helper: add tenant_id to insert data
export function withTenantId(data, tenantId) {
  if (!tenantId) return data;
  if (Array.isArray(data)) {
    return data.map(d => ({ ...d, tenant_id: tenantId }));
  }
  return { ...data, tenant_id: tenantId };
}
