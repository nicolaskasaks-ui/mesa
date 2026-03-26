"use client";
// ═══════════════════════════════════════════════════
// CLIENT-SIDE TENANT HOOK
// Fetches and caches tenant config for use in pages
// ═══════════════════════════════════════════════════
import { useState, useEffect, createContext, useContext } from "react";

const TenantContext = createContext(null);

// Default Chuí config (used while loading or if fetch fails)
const DEFAULT_TENANT = {
  id: "a0000000-0000-0000-0000-000000000001",
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
  logo_url: "/logo-dark.png",
  accent_color: "#1A1A1A",
  secondary_color: "#2D7A4F",
  font_display: "Outfit",
  font_body: "Nunito",
  walk_around_radius_m: 300,
  walk_around_minutes: 15,
  arrival_minutes: 10,
  grace_minutes: 5,
  features: {
    bar_promo: true, walk_around: true, referral: true,
    pre_order: true, gps_tracking: true, whatsapp_bot: true,
    analytics: true, crm: true,
  },
  opentable_url: "https://www.opentable.com/r/chui-buenos-aires",
  instagram_handle: "@chui.ba",
  instagram_url: "https://instagram.com/chui.ba",
  google_review_url: "https://g.page/chui-ba/review",
  plan: "pro",
};

// Detect tenant slug from URL
function detectSlug() {
  if (typeof window === "undefined") return "chui";

  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Path-based: /t/:slug/...
  const pathMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);
  if (pathMatch) return pathMatch[1];

  // Subdomain: chui.meantime.ar
  const mainDomains = ["meantime.ar", "mesa-xi.vercel.app", "localhost", "127.0.0.1"];
  for (const d of mainDomains) {
    if (hostname.endsWith(d) && hostname !== d) {
      const sub = hostname.replace(`.${d}`, "");
      if (sub && sub !== "www") return sub;
    }
  }

  // Default
  return "chui";
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = detectSlug();

    // Try cache first
    try {
      const cached = sessionStorage.getItem(`tenant:${slug}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed._ts < 300_000) { // 5min TTL
          setTenant(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fetch from API
    fetch(`/api/tenants?slug=${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          data._ts = Date.now();
          try { sessionStorage.setItem(`tenant:${slug}`, JSON.stringify(data)); } catch {}
          setTenant(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) return { tenant: DEFAULT_TENANT, loading: false };
  return ctx;
}

// Helper: get the right label for the vertical
export function getVerticalLabels(vertical) {
  switch (vertical) {
    case "restaurant":
      return {
        servicePoint: "Mesa",
        servicePoints: "Mesas",
        queue: "Fila",
        guest: "Comensal",
        guests: "Comensales",
        groupSize: "Personas",
        serving: "Sentado",
        available: "Libre",
        status: {
          available: "Libre",
          occupied: "Sentado",
          finishing: "Postre",
          checkout: "Cuenta",
        },
      };
    case "healthcare":
      return {
        servicePoint: "Consultorio",
        servicePoints: "Consultorios",
        queue: "Sala de espera",
        guest: "Paciente",
        guests: "Pacientes",
        groupSize: "Acompañantes",
        serving: "En atención",
        available: "Disponible",
        status: {
          available: "Disponible",
          occupied: "En atención",
          finishing: "Finalizando",
          checkout: "Pagando",
        },
      };
    case "salon":
      return {
        servicePoint: "Silla",
        servicePoints: "Sillas",
        queue: "Turno",
        guest: "Cliente",
        guests: "Clientes",
        groupSize: "Personas",
        serving: "En atención",
        available: "Disponible",
        status: {
          available: "Disponible",
          occupied: "En atención",
          finishing: "Finalizando",
          checkout: "Cobrando",
        },
      };
    default:
      return {
        servicePoint: "Punto",
        servicePoints: "Puntos",
        queue: "Fila",
        guest: "Cliente",
        guests: "Clientes",
        groupSize: "Personas",
        serving: "Atendiendo",
        available: "Disponible",
        status: {
          available: "Disponible",
          occupied: "Ocupado",
          finishing: "Finalizando",
          checkout: "Cerrando",
        },
      };
  }
}
