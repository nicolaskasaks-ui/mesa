# MEANTIME — Handoff

## Repo & Deploy
- **Repo:** `~/mesa` — GitHub: `nicolaskasaks-ui/mesa`
- **Deploy:** `mesa-xi.vercel.app` (Vercel, auto-deploy on push to main)
- **Stack:** Next.js 14, Supabase (Postgres + Realtime), Twilio WhatsApp sandbox

## Supabase
- RLS desactivado en waitlist/customers/tables
- Service role key en Vercel env vars
- Tablas: `waitlist`, `customers`, `tables`, `bar_redemptions`

## Archivos clave
- `app/page.js` — cliente (welcome, form, waiting, notified, seated, walk around)
- `app/host/page.js` — host dashboard (grilla mesas + fila)
- `app/api/waitlist/route.js` — CRUD waitlist + auto-expire 15min + WhatsApp position #1-3
- `app/api/tables/route.js` — CRUD mesas + auto-notify on libre
- `app/api/whatsapp/route.js` — envio WhatsApp via Twilio
- `app/api/bar/route.js` — registro 2x1 redemptions
- `lib/twilio.js` — sender + templates con variaciones naturales
- `lib/tokens.js` — design tokens (warm white, Outfit/Nunito)
- `lib/supabase.js` — client-side (anon key, realtime)
- `lib/supabase-server.js` — server-side (service role key)

## Features implementadas
- Fila virtual con posicion en tiempo real (Supabase Realtime)
- WhatsApp: notificacion mesa lista (5 variantes), updates posicion #1-3
- Notificacion al cliente: countdown 10min + confirmar/cancelar/pasar turno
- Auto-expire: 15min (10 + 5 gracia) cancela automaticamente
- Host: grilla mesas colores solidos (negro sentado, verde libre, rojo cuenta, ambar limpiando)
- Host: seat picker al liberar/tocar mesa libre/limpiando
- Host: prediccion de mesa asignada por cliente
- Host: countdown timer en avisados (verde/ambar/rojo)
- Host: distancia al restaurante + tiempo de espera con colores
- Host: limpiar viejos (>5h) / vaciar fila
- Host: BARRA 2x1 badge con codigo
- 2x1 en barra: cliente elige cerveza/vino/vermut, se registra en DB
- Modo paseo: GPS tracking, push activity cada 15s
- Returning customers: localStorage

## Tipografias
Outfit (display), Nunito (body), Futura (labels, pills)
Chui siempre con tilde: Chuí

## Pendientes — Orden de implementacion

### 1. SQL primero
```sql
ALTER TABLE waitlist ADD COLUMN source TEXT DEFAULT 'direct'
  CHECK (source IN ('direct', 'whatsapp_bot', 'opentable_overflow', 'walkin'));
ALTER TABLE bar_redemptions
  ADD COLUMN is_promo BOOLEAN DEFAULT true,
  ADD COLUMN price NUMERIC(10,2) DEFAULT 0;
```

### 2. API routes
- `app/api/waitlist/route.js` POST: agregar source al insert
- `app/api/bar/route.js` POST: agregar is_promo y price

### 3. Host: pill de source en la fila
Mostrar WA / Walk-in / OT segun source del waitlist entry

### 4. Nueva ruta /bar — vista del barman
- `app/bar/page.js`
- Muestra clientes con 2x1 activo (join waitlist + bar_redemptions)
- Boton "+ Consumo" por cliente con precio y tipo
- Registra en bar_redemptions con is_promo: false

### 5. Nueva ruta /analytics — dashboard
- `app/analytics/page.js`
- Nuevos vs recurrentes
- Revenue post-2x1 (consumos no-promo)
- No-show rate (vencidos / notificados)
- Espera promedio (seated_at - joined_at)
- Source breakdown (direct vs walkin vs whatsapp_bot)
- Ticket promedio post-promo vs sin promo

### 6. Otras mejoras pendientes
- Twilio produccion (salir del sandbox)
- Auth para host (ahora /host es publico)
- Multi-restaurante
- Registro marca Meantime + dominio
