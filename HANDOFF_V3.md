# Meantime — Handoff V3 (27 Mar 2026)

## Qué cambió desde V2

### Multi-tenant Architecture (Phase 1) — DONE

Se implementó la base completa para multi-tenancy. Meantime puede ahora servir a múltiples restaurantes/negocios desde la misma instancia.

#### Archivos nuevos

| Archivo | Qué es |
|---------|--------|
| `migrations/001_multi_tenant.sql` | SQL para crear tabla `tenants` + agregar `tenant_id` a tables existentes + seed Chuí |
| `middleware.js` | Resolución de tenant por subdomain (`chui.meantime.ar`), path (`/t/chui`), o custom domain |
| `lib/tenant.js` | Server-side tenant resolver con in-memory cache (60s TTL) |
| `lib/api-tenant.js` | Helpers: `resolveTenantFromRequest()`, `withTenantId()`, `tenantQuery()` |
| `lib/use-tenant.js` | Client-side: `TenantProvider`, `useTenant()` hook, `getVerticalLabels()` |
| `app/onboard/page.js` | Wizard de onboarding self-service (3 pasos: vertical, info, mesas) |
| `app/settings/page.js` | Panel de configuración del tenant (general, marca, operaciones, features, links) |
| `app/api/tenants/route.js` | GET (config pública) + POST (crear tenant) |

#### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `app/api/waitlist/route.js` | GET/POST/PATCH/DELETE ahora filtran por `tenant_id` |
| `app/api/tables/route.js` | GET ahora filtra por `tenant_id` |
| `app/api/waitlist/direct-seat/route.js` | POST incluye `tenant_id` en inserts |
| `lib/twilio.js` | Todos los templates parametrizados (ya no hardcodean "Chuí" ni "Loyola 1250") |

#### Cómo funciona

1. **Middleware** detecta tenant slug del request (subdomain > path > default "chui")
2. Setea header `x-tenant-slug` en el request
3. **API routes** llaman `resolveTenantFromRequest(request)` → obtienen `{ tenant, tenantId }`
4. Todas las queries incluyen `.eq("tenant_id", tenantId)` y todos los inserts incluyen `tenant_id`
5. **Backward compatible**: si no hay tenants table en DB, cae a config hardcodeada de Chuí

### WhatsApp Templates parametrizados

Todas las funciones `msg*()` en `lib/twilio.js` ahora aceptan `tenantContext: { restaurantName, address, reviewUrl }`. Hay un helper `tenantToMsgContext(tenant)` para convertir el objeto de tenant.

## Lo que NO cambió

- La UI de host, client, bar, analytics, crm, kiosk, widget siguen exactamente igual
- La lógica de ML prediction, trust scoring, auto-expire, etc. no cambió
- La base de datos actual NO fue modificada (la migración se tiene que correr manualmente)

## Próximos pasos URGENTES

### 1. Correr la migración SQL
```
1. Ir a Supabase Dashboard → SQL Editor
2. Pegar contenido de migrations/001_multi_tenant.sql
3. Ejecutar
4. Verificar que tenants table existe y Chuí está como seed
5. Descomentar los ALTER ... SET NOT NULL después de verificar
```

### 2. Actualizar API routes restantes
Estos routes todavía NO filtran por tenant_id:
- `app/api/bar/route.js`
- `app/api/whatsapp/webhook/route.js`
- `app/api/predict-wait/route.js`
- `app/api/engagement/route.js`
- `app/api/preorder/route.js`
- `app/api/referral/route.js`
- `app/api/reset/route.js`
- `app/api/integration/seat/route.js`
Patrón: importar `resolveTenantFromRequest` y `withTenantId`, agregar `.eq("tenant_id", tenantId)`.

### 3. Integrar TenantProvider en client pages
El hook `useTenant()` está listo pero los pages aún usan:
- `CONFIG.restaurant.*` de `lib/config.js`
- `RESTAURANT.*` de `lib/tokens.js`
- Logo hardcodeado `/logo-dark.png`
- PIN hardcodeado `"1250"`

Hay que reemplazar estos por `tenant.*` del hook.

### 4. Actualizar host PIN dinámico
El PIN del hostess está hardcodeado en `host/page.js` línea 83. Debería venir del tenant:
```js
// Cambiar de:
const HOST_PIN = "1250";
// A:
const { tenant } = useTenant();
// usar tenant.pin
```

### 5. Deploy a Vercel
```bash
cd /Users/nk/mesa
git add -A
git commit -m "feat: multi-tenant architecture phase 1"
git push origin main
```

## Features pendientes (post multi-tenant)

1. **Billing** — MercadoPago para AR, Stripe para international
2. **Meantime Health** — vertical de guardias médicas
3. **WhatsApp producción** — salir del sandbox de Twilio
4. **Custom domain support** — DNS verification + Vercel wildcard
5. **RLS policies** — habilitar RLS en Supabase después de verificar que todos los routes filtran

## Stack
- Next.js 14 (React 18) en Vercel
- Supabase (PostgreSQL + Realtime) — proyecto `hejkvhvubbnxfhzrmcri`
- Twilio WhatsApp (sandbox)
- Open-Meteo API (weather)

## Credenciales
- Supabase: en .env.local del proyecto
- Twilio: en .env.local (sandbox)
- Integration webhook: Bearer meantime-2025
- Host/Analytics/Bar/CRM/Settings PIN: 1250
