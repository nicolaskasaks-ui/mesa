# MEANTIME V2 — Plan Maestro de Producto

> Investigacion de mercado + analisis de gaps + roadmap de implementacion
> Generado: 21 marzo 2026

---

## RESUMEN EJECUTIVO

Meantime hoy es un **MVP solido de waitlist digital** con tracking GPS, WhatsApp, y dashboard hostess. Pero comparado con los lideres del mercado (SevenRooms, Resy, Tock, Eat App), le faltan las capas que convierten una herramienta de operaciones en una **maquina de fidelizacion y revenue**.

La oportunidad es enorme: el 70% de los clientes que visitan un restaurante por primera vez **nunca vuelven**. La diferencia entre un restaurante que sobrevive y uno que prospera es la retencion. Un aumento del 5% en retencion genera un aumento del 25-75% en ganancia.

**Ventaja competitiva de Meantime para Argentina:**
- WhatsApp es rey (93-99% penetracion, 29 hrs/mes de uso, 1,429 aperturas/mes)
- Los competidores (Resy, SevenRooms, Tock) no operan en Argentina
- Pagos digitales crecen exponencialmente (QR interoperable via Transferencias 3.0)
- No hay ningun player local que combine waitlist + CRM + loyalty + WhatsApp nativo

---

## ANALISIS DE GAPS — Meantime vs Lideres

| Dimension | SevenRooms | Resy | Tock | Eat App | Meantime HOY |
|-----------|-----------|------|------|---------|-------------|
| Waitlist digital | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tracking GPS en espera | ❌ | ❌ | ❌ | ❌ | ✅ **UNICO** |
| WhatsApp nativo | ❌ | ❌ | ❌ | ✅ | ✅ |
| CRM / Guest profiles | ✅✅✅ | ✅✅ | ✅ | ✅✅ | ⚠️ Basico |
| Loyalty / Rewards | ✅✅ | Via AmEx | ❌ | ⚠️ | ❌ |
| Marketing automation | ✅✅✅ | ❌ | ❌ | ✅ | ❌ |
| No-show prevention | ✅ | ✅ | ✅✅✅ | ✅ | ⚠️ Solo expire |
| Analytics dashboard | ✅✅ | ✅ | ✅ | ✅ | ❌ |
| Bar/upselling en espera | ❌ | ❌ | ❌ | ❌ | ✅ (2x1 basico) |
| Pre-order durante espera | ❌ | ❌ | ❌ | ❌ | ❌ |
| Post-visit engagement | ✅✅ | ❌ | ❌ | ✅ | ❌ |
| Multi-restaurante | ✅ | ✅ | ✅ | ✅ | ❌ |

**Meantime tiene 2 features UNICAS que ningun competidor ofrece:**
1. GPS tracking en tiempo real durante la espera (distancia, modo paseo)
2. Monetizacion de la espera (2x1 barra) como mecanica de engagement

---

## ROADMAP — 4 FASES

### FASE 1: FOUNDATION (Semanas 1-2)
> Completar los basics que faltan para ser un producto creible

#### 1.1 CRM Inteligente — Guest Profiles
**Por que:** SevenRooms cobra $500+/mes por esto. El 73% de los operadores de restaurantes aumentaron su inversion en tecnologia en 2024, y CRM es el #1.

**Implementar:**
- Enriquecer tabla `customers` con campos:
  ```sql
  ALTER TABLE customers ADD COLUMN
    email TEXT,
    birthday DATE,
    notes TEXT,              -- notas libres del hostess
    tags TEXT[] DEFAULT '{}', -- tags custom (VIP, influencer, prensa, etc)
    preferred_table TEXT,
    preferred_server TEXT,
    total_spend NUMERIC(10,2) DEFAULT 0,
    avg_party_size NUMERIC(3,1),
    last_allergies TEXT[],
    no_show_count INT DEFAULT 0,
    source TEXT DEFAULT 'qr'; -- como llego (qr, whatsapp, instagram, referido)
  ```
- Vista de perfil de cliente en el host (tap en nombre -> drawer con historial)
- Auto-calcular total_spend y avg_party_size desde historial
- Tags del hostess (VIP, influencer, prensa, amigo del chef, etc.)

#### 1.2 Analytics Dashboard — `/analytics`
**Por que:** Sin data, no hay decisiones. Los restaurantes data-driven tienen 23% mas probabilidad de sobrevivir.

**Metricas clave:**
- **Cubiertos por noche** (sentados hoy)
- **Espera promedio** (seated_at - joined_at)
- **No-show rate** (vencidos / notificados) — target <5%
- **Revenue barra** (redemptions promo + consumos pagos)
- **Nuevos vs recurrentes** (pie chart)
- **Source breakdown** (QR, WhatsApp, walk-in, referido)
- **Turnover rate** (tiempo sentado promedio por mesa)
- **RevPASH** (revenue por asiento disponible por hora)
- **Trust level distribution** (cuantos en cada tier)
- Graficos por dia/semana/mes

#### 1.3 Trust Scoring (ya diseñado en HANDOFF)
**Por que:** Reduce no-shows (trust alto = comportamiento verificado) y crea un "game" de fidelidad.

**Implementar segun HANDOFF §6** — agregar:
- Auto-downgrade por no-show: trust baja a 0
- Auto-upgrade por visita exitosa: trust sube si cumple threshold
- GPS check para trust 0 (solo puede anotarse si esta cerca)
- Badge visible en cliente y en host

#### 1.4 Source Tracking (ya diseñado en HANDOFF)
**Por que:** Saber de donde vienen los clientes es fundamental para marketing.

**Implementar segun HANDOFF §1-3**

---

### FASE 2: LOYALTY & ENGAGEMENT (Semanas 3-4)
> Convertir clientes one-time en regulares. El 65-80% del revenue viene de regulares.

#### 2.1 Programa de Loyalty — "Regulares de Chui"
**Por que:** Loyalty members visitan 20% mas seguido y gastan 20% mas por visita. Birthday emails tienen 481% mas transacciones.

**Modelo: Visit-based + Surprise & Delight**
(No puntos complicados — Sweetgreen abandono tiers por ser demasiado complejo)

**Estructura simple:**
| Visitas | Status | Beneficio |
|---------|--------|-----------|
| 1 | Nuevo | 2x1 barra de bienvenida |
| 3 | Regular | Prioridad en fila (+1 posicion) |
| 5 | Habitual | Acceso remoto + amaro de cortesia |
| 10 | VIP | Mesa reservada via WhatsApp + off-menu items |
| 20 | Gold | Invitacion a cenas exclusivas + early access |

**Mecanica:**
- Se trackea automaticamente por customer_id (no necesita app ni tarjeta)
- WhatsApp avisa cuando sube de nivel: "Felicitaciones [nombre]! Ya sos Regular de Chui 🎉"
- Surprise: cada 3 visitas, chance random de cortesia sorpresa (el 94% de clientes que reciben un regalo sorpresa se sienten mas positivos con la marca)

**Birthday program:**
- Guardar birthday en el registro (campo opcional)
- WhatsApp automatico el dia del cumple con invitacion a cenar + postre gratis
- Birthday emails tienen 56.2% open rate vs 16.8% de promos normales

#### 2.2 Referral Program — "Trajo un amigo"
**Por que:** Los incentivos no-cash son 24% mas efectivos que cash para referrals.

**Mecanica:**
- Cada cliente recibe un link unico: `mesa-xi.vercel.app/?ref=CODIGO`
- Si un referido se sienta, ambos reciben un beneficio en la proxima visita
- El referidor sube mas rapido de trust level
- Host ve "Referido por: [nombre]" en la fila

#### 2.3 Post-Visit Engagement via WhatsApp
**Por que:** 90% de los mensajes se abren en 3 minutos. El momento post-visita es critico para fidelizar.

**Secuencia automatica (24h despues de seated):**
1. **Agradecimiento + link de review:** "Gracias [nombre]! Como la pasaste en Chui? [link Google Reviews]"
2. **Si responde positivo:** "Que bueno! Nos ayudarias dejando una reseña? [link]"
3. **Si responde negativo:** "Lamentamos eso. Nos contas que paso? [chat con manager]"
4. **A los 7 dias:** "Te extrañamos! Tu mesa favorita te espera este finde" (solo para trust >= 1)

**Bounce-back offer:**
- A los 14 dias sin volver: "Veni esta semana y el postre va por nuestra cuenta"
- Aumenta frequency un 20% segun datos de la industria

---

### FASE 3: REVENUE OPTIMIZATION (Semanas 5-6)
> Maximizar el revenue por cada asiento por hora

#### 3.1 Pre-Order During Wait — "Pedí desde la fila"
**Por que:** Digital ordering aumenta el ticket promedio 15-30%. Carbonara App ya ofrece esto gratis. Meantime puede hacerlo mejor con WhatsApp.

**Implementar:**
- Mientras espera, el cliente ve un boton "Pedi algo para cuando te sientes"
- Abre un mini-menu (tragos, entradas, vino)
- El pedido llega a la cocina/barra asociado al waitlist entry
- Cuando se sienta, ya tiene su bebida/entrada lista
- **Revenue inmediato** + reduce tiempo de primer servicio + mejora la experiencia de espera

**Integracion WhatsApp:**
- Si el cliente prefiere, puede pedir por WhatsApp con botones interactivos
- "Mientras esperas, te pedimos algo? 1️⃣ Cerveza 2️⃣ Copa de vino 3️⃣ Negroni 4️⃣ Ver carta"

#### 3.2 Bar POS Lite — Vista Barman (`/bar`)
**Ya diseñado en HANDOFF §4.** Agregar:
- Lista de clientes con 2x1 activo
- Boton "+ Consumo" con precio (consumo post-promo, no gratis)
- Timer de espera visible (barman sabe cuanto falta para sentar)
- Dashboard: revenue barra por noche

#### 3.3 Smart Table Management
**Por que:** Un restaurante de 150 asientos puede generar 15-25% mas revenue optimizando turnover. El pago es el mayor bottleneck — tableside terminals recortan 10+ minutos por mesa.

**Implementar:**
- **Alerta de turnover:** Si una mesa lleva >2h en casual dining (>3h en cena), el host ve alerta ambar
- **Prediccion de liberacion:** Basado en el estado (postre → ~20min para libre, cuenta → ~10min)
- **Overbooking inteligente:** Si el no-show rate historico es 10%, sugerir 7.5% overbooking (formula: no-show rate × 0.75)
- **RevPASH en tiempo real:** Mostrar en analytics cuanto genera cada asiento por hora

#### 3.4 Dynamic Promotions
**Por que:** Las promos en horarios muertos llenan el restaurante sin descuentar en peak. Funciona como "discounting off-peak" (sin backlash).

**Implementar:**
- "Happy Hour inteligente": si a las 19h hay >50% mesas libres, activar promo automatica via WhatsApp a trust >= 1
- "Last seat": si queda 1 mesa libre, push a los primeros 3 de la fila con oferta especial
- Dia lento detectado → WhatsApp a regulares: "Hoy hay lugar sin espera + 2x1 toda la noche"

---

### FASE 4: SCALE & MOAT (Semanas 7-8+)
> Construir la ventaja competitiva que hace a Meantime irreemplazable

#### 4.1 Multi-Restaurante
**Por que:** Para ser un producto SaaS, necesita funcionar con mas de un restaurante. Cada restaurante nuevo es revenue recurrente.

**Implementar:**
- Tabla `restaurants` con config por restaurante (nombre, logo, colores, coordenadas, promo, horarios)
- `tokens.js` dinamico segun restaurant_id
- Subdominio o path: `mesa-xi.vercel.app/chui` vs `mesa-xi.vercel.app/otrolugar`
- Dashboard admin para config de cada restaurante
- Datos compartidos de clientes entre restaurantes (un CRM unico)

#### 4.2 WhatsApp Business API Produccion
**Por que:** El sandbox de Twilio limita a 1 numero y mensajes de prueba. Para produccion necesitas un numero verificado.

**Pasos:**
1. Registrar cuenta de WhatsApp Business API via Twilio
2. Verificar el numero de telefono del restaurante
3. Crear message templates aprobados por Meta
4. Migrar de sandbox a produccion
5. Implementar webhook de n8n routing (ya diseñado)

#### 4.3 PWA Completa con Push Notifications
**Por que:** Push notifications aumentan engagement 88% y retencion 3-10x.

**Implementar:**
- Service worker para offline + push notifications
- "Instala Meantime" prompt en la vista de espera
- Push notifications para:
  - "Tu mesa esta lista" (ademas de WhatsApp)
  - "Avanzaste en la fila"
  - Promos flash para regulares
- **Caveat iOS:** Requiere iOS 16.4+ y PWA instalada en home screen

#### 4.4 Integracion con POS
**Por que:** Sin datos de spend, el CRM esta incompleto. Con POS data, sabes exactamente cuanto gasta cada cliente.

**Opciones para Argentina:**
- Integracion con sistemas POS argentinos (Resto, iFood, etc.)
- O mas simple: input manual de ticket promedio al cerrar mesa
- A futuro: QR para pago que captura el monto automaticamente

#### 4.5 AI Features (Futuro)
- **Prediccion de demanda:** Basado en dia, clima, eventos, historial
- **Auto-seating:** Asignacion optima de mesas por AI (ya tenemos predictTable, evolucionarlo)
- **Sentiment analysis:** Analizar respuestas de WhatsApp para detectar clientes insatisfechos
- **Smart re-engagement:** AI decide cuando y que mandarle a cada cliente para que vuelva

---

## PRIORIDAD DE IMPLEMENTACION

### IMPACTO ALTO + ESFUERZO BAJO (hacer primero)
1. ✅ Analytics dashboard basico (`/analytics`) — 1 dia
2. ✅ Trust scoring auto-upgrade/downgrade — 0.5 dias
3. ✅ Source tracking + pill en host — 0.5 dias
4. ✅ Post-visit WhatsApp (agradecimiento + review) — 1 dia
5. ✅ Birthday capture + auto-WhatsApp — 0.5 dias

### IMPACTO ALTO + ESFUERZO MEDIO
6. Loyalty program basico (visit-based, status tiers) — 2 dias
7. Pre-order durante espera (mini menu + barra) — 2 dias
8. Bar POS lite (`/bar`) — 1.5 dias
9. Referral program — 1 dia
10. CRM enrichment (perfil de cliente en host) — 1.5 dias

### IMPACTO ALTO + ESFUERZO ALTO
11. WhatsApp Business API produccion — 2-3 dias (incluye aprobacion Meta)
12. Multi-restaurante — 3-5 dias
13. PWA push notifications — 2 dias

### NICE TO HAVE
14. Dynamic promos (happy hour inteligente) — 1 dia
15. Smart table management (alertas turnover) — 1 dia
16. POS integration — variable
17. AI features — ongoing

---

## MODELO DE NEGOCIO SUGERIDO

### Pricing para restaurantes
| Plan | Precio | Incluye |
|------|--------|---------|
| **Starter** | Gratis | Waitlist basica + 50 WhatsApp/mes |
| **Pro** | $29.990 ARS/mes (~$30 USD) | Waitlist + CRM + Analytics + WhatsApp ilimitado |
| **Premium** | $59.990 ARS/mes (~$60 USD) | Todo Pro + Loyalty + Marketing automation + Bar POS |
| **Enterprise** | Custom | Multi-location + API + soporte dedicado |

### Metricas clave para el negocio
- **MRR** (Monthly Recurring Revenue) por restaurante
- **Churn rate** de restaurantes (target <5%/mes)
- **Net Revenue Retention** (expansion: restaurantes que upgraden)
- **Customer Acquisition Cost** (target: <2 meses de MRR)

---

## VENTAJA COMPETITIVA FINAL — "MOAT"

Meantime puede ganar en Argentina (y LATAM) porque:

1. **WhatsApp-native:** Los competidores globales (Resy, SevenRooms) usan SMS/email. En Argentina, WhatsApp ES el canal. Meantime es WhatsApp-first.

2. **GPS tracking en espera:** Ningun competidor lo ofrece. Saber donde esta tu cliente cambia la operacion del hostess.

3. **Monetizacion de la espera:** La espera no es un problema — es una oportunidad de revenue (2x1, pre-orders, bar POS).

4. **CRM que se construye solo:** Cada visita enriquece el perfil automaticamente. El restaurante no tiene que hacer nada manual.

5. **Trust scoring:** Crea un loop de fidelidad: venis mas → mejor tratamiento → venis mas. Es adictivo para el cliente y reduce no-shows para el restaurante.

6. **Precio accesible para LATAM:** SevenRooms cobra $500+/mes. Meantime puede cobrar $30-60 USD y ser rentable.

---

## NEXT STEPS

Cuando leas esto, decime:
1. Cual de las 4 fases queres arrancar primero
2. Si hay features que queres priorizar o descartar
3. Si queres que arranque a implementar directamente

El plan esta diseñado para que cada fase sea deployable independientemente — no necesitas completar todo para tener valor.

---

*Generado por investigacion de: Resy, Tock, SevenRooms, Yelp Guest Manager, OpenTable, Carbonara, Eat App, Queue-it, Sweetgreen, Starbucks Rewards, Chick-fil-A One, Eleven Madison Park, Don Julio BA, + 50 articulos de industria y research papers.*
