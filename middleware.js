import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════
// TENANT RESOLUTION MIDDLEWARE
// Resolves tenant slug from:
//   1. Custom domain: cola.donjulio.com.ar → donjulio
//   2. Subdomain: chui.meantime.ar → chui
//   3. Path-based: /t/chui/... → chui
//   4. Default: chui (backward compat)
// Sets x-tenant-slug header for API routes and pages
// ═══════════════════════════════════════════════════

const MAIN_DOMAINS = [
  "meantime.ar",
  "mesa-xi.vercel.app",
  "localhost",
  "127.0.0.1",
];

// Paths that don't need tenant resolution (marketing, onboarding, static)
const PUBLIC_PATHS = [
  "/landing",
  "/onboard",
  "/api/onboard",
  "/api/tenants",
  "/_next",
  "/favicon",
  "/manifest",
  "/logo",
  "/one-pager",
];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Skip static files and public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let tenantSlug = null;

  // 1. Check for path-based routing: /t/:slug/...
  const pathMatch = pathname.match(/^\/t\/([a-z0-9-]+)(\/.*)?$/);
  if (pathMatch) {
    tenantSlug = pathMatch[1];
    // Rewrite to remove /t/:slug prefix
    const rewritePath = pathMatch[2] || "/";
    const url = request.nextUrl.clone();
    url.pathname = rewritePath;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-tenant-slug", tenantSlug);
    return response;
  }

  // 2. Check subdomain: chui.meantime.ar or chui.localhost:3000
  const hostWithoutPort = hostname.split(":")[0];
  for (const mainDomain of MAIN_DOMAINS) {
    if (hostWithoutPort.endsWith(mainDomain) && hostWithoutPort !== mainDomain) {
      // Extract subdomain
      const sub = hostWithoutPort.replace(`.${mainDomain}`, "");
      if (sub && sub !== "www") {
        tenantSlug = sub;
        break;
      }
    }
  }

  // 3. Custom domain (not a known main domain)
  if (!tenantSlug && !MAIN_DOMAINS.some(d => hostWithoutPort === d || hostWithoutPort.endsWith(`.${d}`))) {
    // This is a custom domain — the slug will be resolved by looking up the domain in DB
    // For now, pass the full domain as slug; the tenant resolver will handle the lookup
    tenantSlug = hostWithoutPort;
  }

  // 4. Default to chui for backward compatibility
  if (!tenantSlug) {
    tenantSlug = "chui";
  }

  const response = NextResponse.next();
  response.headers.set("x-tenant-slug", tenantSlug);
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)).*)",
  ],
};
