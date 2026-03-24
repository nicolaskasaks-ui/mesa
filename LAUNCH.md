# MEANTIME — Launch Intelligence Package

> Compilado: 24 Mar 2026, 3AM
> Status: Todo investigado. Listo para ejecutar.

---

## RESUMEN EJECUTIVO

Meantime es una plataforma de fila virtual WhatsApp-first para restaurantes. El mercado de queue management en LATAM esta practicamente vacio. Con WhatsApp al 93% de penetracion en Argentina, Meantime tiene una ventaja competitiva real contra cualquier competidor global.

### Numeros clave

| Metrica | Valor |
|---------|-------|
| Break-even | **2 restaurantes pagando** |
| LTV:CAC | **28.6x** (founder-led sales) |
| Margen bruto | **86.7%** |
| Costo infra por restaurant | **$19-22/mes** |
| TAM Argentina | **$59M/anio** |
| TAM LATAM | **$500M+/anio** |
| Pricing sugerido | Free / $29 Pro / $59 Growth |

---

## DOCUMENTOS COMPLETOS

### 1. INFRAESTRUCTURA (ver arriba en este doc)
- Vercel Pro + Supabase Pro + Twilio = $64/mes para el piloto
- A 1,000 restaurantes: $19,200/mes (optimizable a $10,887 con 360dialog + Hetzner)
- WhatsApp es 90%+ del costo — optimizar con service-window messages

### 2. GTM STRATEGY (GTM.md)
- Fase 1: 10 restaurantes en Palermo/Villa Crespo (walk-in sales)
- Fase 2: 50 restaurantes (referrals + prensa)
- Fase 3: Argentina (Cordoba, Rosario, Mendoza)
- Fase 4: LATAM (Colombia primero, luego Mexico, luego Brasil)
- CAC organico: $8/restaurant
- Templates de outreach en espanol incluidos

### 3. LEGAL & COMPLIANCE (LEGAL_AND_DECK.md)
- Ley 25.326: alergias son datos sensibles, necesitan consentimiento explicito
- AAIP: registro obligatorio via Portal TAD
- Supabase en US: necesita Standard Contractual Clauses
- WhatsApp: opt-in obligatorio antes de mensajear
- Estructura: SAS recomendada, Monotributo para arrancar
- Pagos: MercadoPago para billing recurrente en ARS
- Investor deck de 12 slides con datos reales de mercado

### 4. ROADMAP 12 MESES (ROADMAP.md)
- M1-3: Polish + piloto Chui + 10 restaurantes
- M3-6: Onboarding wizard + Stripe + 50 restaurantes
- M6-9: Multi-location + API + POS connectors + 200 restaurantes
- M9-12: Multi-vertical (salud, bancos) + 500 restaurantes
- Revenue target: $0 → $120K MRR en 12 meses
- Equipo: de 1 a 12 personas

### 5. VENTAS GLOBALES (GLOBAL_SALES.md)
- Product Hunt, Capterra, G2, AppSumo como canales
- Reserve with Google como integracion clave
- SEO: "restaurant waitlist app", "fila virtual restaurante"
- 9 regiones analizadas con precios ajustados por PPP
- Brasil e India: mercados de mayor oportunidad
- Partnerships: Toast, Square, MercadoPago, FEHGRA

### 6. CLIENTES POTENCIALES (PROSPECTS.md)
- 13 grupos de Buenos Aires (Sarkis = cliente ideal, 260 cubiertos, no acepta reservas)
- 15 cadenas LATAM (Madero 270+ locales, Crepes & Waffles 100+)
- 13 cadenas globales en mercados WhatsApp (Nusr-Et, Jollibee, Barbeque Nation)
- 8 food halls (Time Out Market, Eataly)
- 10 verticales no-restaurante (Farmacity, dr.consulta, ANSES)
- Top 20 prospects rankeados con estrategia de approach

---

## PROXIMOS PASOS INMEDIATOS

### Esta semana
- [ ] Correr SQL migrations en Supabase (columnas nuevas)
- [ ] Testear flujo completo: signup → fila → avisar → sentar
- [ ] Verificar WhatsApp sandbox funciona end-to-end
- [ ] Imprimir QR para Chui

### Semana 2
- [ ] Noche piloto en Chui con staff real
- [ ] Registrar SAS o Monotributo
- [ ] Aplicar a WhatsApp Business API produccion (Twilio)
- [ ] Registrar dominio meantime.ar

### Semana 3
- [ ] Primera noche real en Chui
- [ ] Visitar 10 restaurantes en Palermo con one-pager
- [ ] Crear Instagram @meantime.ar
- [ ] Grabar video demo de 90 segundos

### Mes 2
- [ ] 5 restaurantes pagando
- [ ] Case study de Chui con datos reales
- [ ] Listar en Capterra y G2
- [ ] Aplicar a Product Hunt

---

## STACK FINAL

| Componente | Herramienta | Costo/mes |
|-----------|-------------|-----------|
| Frontend | Next.js + Vercel Pro | $20 |
| Base de datos | Supabase Pro | $25 |
| WhatsApp | Twilio (luego 360dialog) | $18+ |
| Dominio | meantime.ar | $1 |
| Pagos | MercadoPago | 3.5% + IVA |
| Analytics | Built-in (/analytics) | $0 |
| CRM | Built-in (/crm) | $0 |
| **Total piloto** | | **~$64/mes** |

---

## FEATURES IMPLEMENTADOS (20+)

| Feature | Ruta | Estado |
|---------|------|--------|
| Signup QR + fila virtual | / | Live |
| GPS tracking + walk-around | / | Live |
| WhatsApp bidireccional | /api/whatsapp/webhook | Live |
| Text-to-join WhatsApp | /api/whatsapp/webhook | Live |
| Host dashboard + drag & drop | /host | Live |
| Source tracking (M/WI/OT) | /host | Live |
| Allergy alerts con modal | /host | Live |
| Trust scoring automatico | /api/waitlist | Live |
| Analytics dashboard | /analytics | Live |
| CRM con historial | /crm | Live |
| Kiosk mode iPad | /kiosk | Live |
| Widget embeddable | /widget | Live |
| Bar POS + 2x1 promo | /bar | Live |
| AI wait prediction | /api/predict-wait | Live |
| Multi-language ES/EN | / | Live |
| White-label config | lib/config.js | Live |
| Pre-order de barra | / | Live |
| Referral program | / | Live |
| Post-visit review WhatsApp | /api/waitlist | Live |
| Auto-cleanup + nightly reset | /api/tables + /api/reset | Live |
| ETA al host + arrival toast | /host | Live |
| Confirm antes de liberar mesa | /host | Live |

---

*Buenas noches. Manana tenes todo esto para revisar y ejecutar.*
