# HANDOFF — La Bicha + Meantime

## Estado actual
La app corre en la Mac del usuario. Supabase está configurado y healthy.

### Credenciales Supabase (ya en .env.local en su Mac)
```
NEXT_PUBLIC_SUPABASE_URL=https://xespohzcyofyzsiksqrm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhlc3BvaHpjeW9meXpzaWtzcXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDMzNTUsImV4cCI6MjA4OTY3OTM1NX0.rr5VeIFK2KhsBnz5gRR9LQhBIXrJsCDYhVP3ZbHWMg8
```

### Base de datos
- Proyecto: "La Bicha" en Supabase (us-west-2, Oregon)
- Tablas creadas: `bicha_menu_items`, `bicha_tickets`, `bicha_customers`, `bicha_packs`, `bicha_pack_purchases`
- Realtime habilitado en `bicha_tickets`
- Datos de ejemplo cargados (menú + packs)

### Repo
- GitHub: `nicolaskasaks-ui/mesa`
- Branch: `claude/restaurant-queue-ticket-app-DLh6O`
- Stack: Next.js 14, Supabase, React 18

### Para correr en su Mac
```bash
cd ~/mesa
npm run dev
# Abrir http://localhost:3000/bicha (o el puerto que diga la terminal)
```

Si da "Port in use", cerrar otras terminales que tengan npm run dev corriendo, o usar el puerto que indique la terminal.

### Rutas de la app
- `/bicha` — Vista cliente (pedidos, packs, loyalty)
- `/bicha/admin` — Panel admin (PIN: 1234)
- `/bicha/cocina` — Vista cocina (PIN: 1234)
- `/host` — Host dashboard (waitlist original de Meantime)
- `/bar` — POS del bar
- `/` — Vista cliente waitlist (Meantime original)

### Archivos clave — La Bicha
- `app/bicha/page.js` — Cliente: menú, pedidos, packs QR, loyalty stamps
- `app/bicha/admin/page.js` — Admin: gestión tickets, packs, clientes
- `app/bicha/cocina/page.js` — Cocina: tickets entrantes, cambio de estado
- `app/api/bicha/tickets/route.js` — CRUD tickets + WhatsApp notif
- `app/api/bicha/packs/route.js` — CRUD packs + redeem codes
- `app/api/bicha/menu/route.js` — CRUD menú items
- `app/api/bicha/customers/route.js` — CRUD clientes/loyalty
- `app/api/bicha/mercadopago/route.js` — Checkout MercadoPago
- `lib/bicha-setup.sql` — SQL para crear todas las tablas

### Archivos clave — Meantime (waitlist)
- `app/page.js` — Cliente waitlist
- `app/host/page.js` — Host dashboard
- `app/bar/page.js` — Bar POS
- `lib/tokens.js` — Design tokens (colores, fonts)
- `lib/supabase.js` — Cliente Supabase (browser)
- `lib/supabase-server.js` — Cliente Supabase (server, service role)
- `lib/twilio.js` — WhatsApp sender
- `lib/menu-data.js` — Datos del menú

### Fixes aplicados en esta sesión
1. Imports `@/lib/...` cambiados a relative paths (`../../lib/...`) — el alias `@/` no resolvía en la Mac
2. `layout.js` — `<style>{...}` cambiado a `<style dangerouslySetInnerHTML>` para evitar hydration mismatch

### Documentos de referencia
- `HANDOFF.md` — Handoff original de Meantime con features y pendientes
- `PLAN_V2.md` — Plan maestro V2 con roadmap completo (4 fases)

### Lo que falta / problemas conocidos
- No está deployada en Vercel todavía (solo corre local)
- MercadoPago no tiene keys configuradas (necesita `MP_ACCESS_TOKEN` en env)
- Twilio está en sandbox (no producción)
- No hay auth real para /host ni /bicha/admin (solo PIN hardcodeado "1234")
- El usuario tiene muchos procesos `npm run dev` corriendo — debe cerrar las terminales viejas
