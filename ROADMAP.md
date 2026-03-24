# MEANTIME -- 12-Month Product Roadmap
**WhatsApp-first virtual waitlist platform**
**Date: March 2026 | Version 1.0**

---

## EXECUTIVE SUMMARY

Meantime is live with a full restaurant waitlist product. This roadmap takes us from a polished single-restaurant tool to a multi-vertical platform serving 200+ locations across restaurants, clinics, banks, and retail.

**Revenue model assumed:** SaaS subscription (tiered) + per-transaction fees on pre-orders/promos.

| Phase | Timeline | Goal | Restaurant Count | MRR Target |
|-------|----------|------|-----------------|------------|
| Polish & Pilot | M1-3 | Production-ready, 5-10 paying restaurants | 5-10 | $2,500 |
| Growth | M3-6 | Self-service onboarding, 50 restaurants | 50 | $15,000 |
| Scale | M6-9 | Multi-location chains, integrations | 200 | $60,000 |
| Platform | M9-12 | Multi-vertical (health, banking, retail) | 200+ venues | $120,000 |

---

## PRICING TIERS (launch at M2)

| Tier | Price/mo | Includes |
|------|----------|----------|
| Starter | $49 | 1 location, 200 parties/mo, basic analytics, WhatsApp notifications |
| Pro | $149 | 1 location, unlimited parties, full analytics, pre-order, promos, CRM, kiosk mode |
| Business | $299 | Up to 5 locations, API access, white-label, priority support |
| Enterprise | Custom | Unlimited locations, SLA, custom integrations, dedicated CSM |

---

## PHASE 1: POLISH & PILOT (Months 1-3)

### MONTH 1 -- Stability & Hardening

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| End-to-end error handling | M | Catch every failure path: WhatsApp delivery failures, GPS timeouts, Supabase connection drops. Surface user-friendly errors. |
| Offline resilience for host dashboard | M | Service worker + IndexedDB cache so hosts can manage tables during 30-second network drops. Queue actions, sync on reconnect. |
| WhatsApp message retry logic | S | Exponential backoff for failed WhatsApp sends via Twilio/360dialog. Dead-letter queue after 3 failures with host alert. |
| Rate limiting on all endpoints | S | Per-IP and per-restaurant rate limits. Prevent abuse on QR signup endpoint (bot spam). |
| Input validation audit | S | Sanitize every user input. XSS prevention on widget embed. SQL injection review (Supabase RLS audit). |
| Automated test suite (core flows) | L | E2E tests: QR signup -> queue join -> position update -> notification -> seating -> review request. Use Playwright + Vitest. Cover 80% of critical paths. |
| Logging & observability setup | M | Structured logging (JSON) to Supabase logs or Logflare. Error tracking via Sentry. Key events: queue join, seat, no-show, WhatsApp send/fail. |

**Technical Debt:**
- Audit all Supabase RLS policies. Every table must have row-level security enforced.
- Remove any hardcoded restaurant IDs or config values. Move to environment variables or DB config.
- Standardize API response format: `{ success: boolean, data: T, error: string | null }`.
- Fix any N+1 queries in the host dashboard (table grid with many parties loads slowly).
- Review and optimize real-time subscriptions -- unsubscribe on component unmount.

**Infrastructure:**
- Enable Supabase Point-in-Time Recovery (PITR) backups.
- Set up staging environment (separate Supabase project, separate Vercel preview branch).
- Configure Vercel environment variables for staging vs production.
- Set up uptime monitoring (Betterstack or UptimeRobot) -- alert on downtime within 60 seconds.
- WhatsApp Business API: confirm production-approved message templates with Meta.

**Hiring:**
- No hires yet. Founder(s) + 1 contractor for QA/testing.

**Key Metrics:**
- Uptime: 99.5%+
- WhatsApp delivery rate: 98%+
- Average host dashboard load time: < 2 seconds
- Zero critical bugs in production
- Test coverage on critical paths: 80%

**Revenue Target:** $0 (free pilots)

---

### MONTH 2 -- Pilot Program & Billing

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Stripe billing integration | M | Subscription management. Free trial (14 days). Auto-charge. Webhook handling for failed payments, cancellations. Use Stripe Checkout + Customer Portal. |
| Usage metering | S | Track parties served per month per restaurant. Enforce tier limits. Soft limit warning at 80%, hard block at 110% with upgrade prompt. |
| Onboarding flow (manual) | M | Step-by-step setup wizard: restaurant name, logo, table layout, operating hours, WhatsApp number verification, QR code generation. Admin completes this WITH the restaurant. |
| Host mobile optimization | M | Host dashboard must work on phone. Responsive redesign of table grid for mobile viewport. Touch-friendly drag-and-drop (or tap-to-assign alternative). |
| No-show tracking & penalties | S | Track no-shows per customer. After 3 no-shows in 30 days, flag in CRM. Optional: auto-lower trust score. |
| Wait time accuracy tracking | S | Compare AI-predicted wait time vs actual. Log delta. Dashboard showing prediction accuracy %. Feed accuracy data back to improve model. |
| WhatsApp opt-in compliance | S | Explicit opt-in message on QR signup. Store consent timestamp. Opt-out keyword handling ("STOP"). Required for WhatsApp Business API compliance. |

**Technical Debt:**
- Extract shared UI components into a component library (buttons, modals, cards, forms).
- Document all Supabase Edge Functions with input/output schemas.
- Implement database migrations workflow (use Supabase CLI migrations instead of manual SQL).

**Infrastructure:**
- Stripe account setup with test mode for staging.
- CDN configuration for static assets (Vercel handles this, but verify widget embed performance).

**Hiring:**
- Begin recruiting: 1 full-stack engineer (start M3). Focus on someone with WhatsApp API / messaging experience.

**Key Metrics:**
- 5 restaurants on paid pilots ($49-149/mo each)
- Average setup time per restaurant: < 2 hours
- Customer satisfaction score (post-pilot survey): 8+/10
- Stripe integration: zero billing errors

**Revenue Target:** $500-$1,500

---

### MONTH 3 -- Iterate on Feedback & Launch Publicly

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Customer feedback loop | S | In-app feedback widget for hosts. NPS survey after 30 days. Structured feedback collection in Notion/Airtable. |
| Multi-language expansion (PT) | S | Add Portuguese. Prepare i18n architecture for rapid language addition. |
| SMS fallback | M | If WhatsApp delivery fails after retries, fall back to SMS via Twilio. Configurable per restaurant. |
| Improved analytics v2 | M | Add: peak hours heatmap, average wait time by day-of-week, no-show rate trend, source attribution (QR vs walk-in vs OpenTable), revenue from pre-orders. |
| Public marketing site | M | Landing page with demo video, pricing, signup CTA. Built on same Next.js app or separate Astro/Next site. SEO-optimized for "restaurant waitlist app", "virtual queue restaurant". |
| Party size prediction | S | Use historical data to predict party size distribution by time slot. Help hosts pre-allocate tables. |

**Technical Debt:**
- Performance audit: Lighthouse score > 90 on all customer-facing pages.
- Database index review: ensure all frequent queries have proper indexes (especially on restaurant_id, status, created_at).
- Clean up unused Supabase Edge Functions and database tables from prototyping.

**Infrastructure:**
- Custom domain setup for marketing site and app.
- Email infrastructure (Resend or Postmark) for transactional emails: signup confirmation, billing receipts, weekly reports.
- Set up analytics pipeline: Mixpanel or PostHog for product analytics.

**Hiring:**
- 1 full-stack engineer starts. First task: self-service onboarding wizard.

**Key Metrics:**
- 10 paying restaurants
- Average parties per restaurant per day: 30+
- WhatsApp delivery rate: 99%+
- Wait time prediction accuracy: within 5 minutes for 80% of parties
- Marketing site live with 500+ unique visitors in first month

**Revenue Target:** $2,500

---

## PHASE 2: GROWTH (Months 4-6)

### MONTH 4 -- Self-Service Onboarding

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Self-service signup & onboarding wizard | L | Restaurant owner signs up, enters business info, configures table layout (visual editor), verifies WhatsApp number, generates QR codes, activates -- all without admin help. Target: under 15 minutes. |
| Visual table layout editor | M | Drag-and-drop floor plan editor. Add/remove tables, set capacity, name sections (patio, bar, main). Replaces current manual grid setup. |
| Admin super-dashboard | M | Internal dashboard for Meantime team: all restaurants, health status, MRR, usage metrics, support tickets. Alert on restaurants with issues (high no-show rate, low usage). |
| Automated WhatsApp number onboarding | M | Integrate WhatsApp Business API provisioning. Guide restaurant through Facebook Business verification. Auto-register message templates. |
| In-app help & tooltips | S | Contextual help tooltips on every major feature. Link to knowledge base articles. Reduce support burden. |
| Weekly email reports | S | Automated weekly summary email to restaurant owners: parties served, avg wait time, no-show rate, top customers, revenue from pre-orders. |

**Technical Debt:**
- Extract business logic from UI components into service layer. Prepare for API extraction.
- Implement proper database connection pooling (Supabase pgBouncer config).
- Add request tracing (correlation IDs across Edge Functions).

**Infrastructure:**
- Set up customer support tooling: Intercom or Crisp for in-app chat.
- Knowledge base / help center (Notion public pages or GitBook).
- CI/CD hardening: require all tests pass before deploy. Preview deployments for PRs.

**Hiring:**
- 1 designer (contract or part-time) for onboarding UX and marketing site.

**Key Metrics:**
- 25 paying restaurants
- Self-service signup completion rate: 60%+
- Average time to first queue activation: < 20 minutes
- Support tickets per restaurant per month: < 3
- Churn rate: < 5% monthly

**Revenue Target:** $6,000

---

### MONTH 5 -- Marketplace & Discovery

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Customer-facing "Find restaurants" page | M | Public directory of Meantime restaurants. Show current wait times, cuisine type, location on map. SEO play: "restaurants near me no reservation needed". |
| Customer profiles (cross-restaurant) | M | Diners who use Meantime at multiple restaurants get a unified profile. Track preferences, allergies, visit history across venues. Single WhatsApp number = single profile. |
| Smart notifications for diners | S | "Your favorite restaurant Miso has a 5-minute wait right now" -- opt-in push via WhatsApp when nearby restaurants have short queues. |
| Referral program v2 (restaurant-to-restaurant) | S | Existing restaurant owners refer other restaurants. $50 credit per successful referral. Tracked via unique referral codes. |
| Table turn time tracking | M | Automatically track how long each table is occupied. Calculate average turn time by party size. Alert hosts on tables exceeding 2x average. |
| Configurable notification templates | S | Let restaurants customize WhatsApp message text within approved templates. Branded voice. |

**Technical Debt:**
- Database schema review for multi-tenancy at scale. Ensure restaurant_id is partition-ready.
- Audit all real-time subscriptions for memory leaks.
- Implement graceful degradation: if Supabase real-time goes down, fall back to polling.

**Infrastructure:**
- CDN for customer-facing pages (Vercel Edge handles this).
- Database read replicas consideration (not needed yet at 50 restaurants, but plan the migration path).
- Implement database connection monitoring and alerting.

**Hiring:**
- 1 growth/marketing person (part-time or contract). Focus: SEO, restaurant outreach, content.

**Key Metrics:**
- 40 paying restaurants
- Customer directory page: 2,000+ monthly visitors
- Cross-restaurant customer profiles: 1,000+
- Restaurant referral rate: 10% of existing customers refer at least 1

**Revenue Target:** $10,000

---

### MONTH 6 -- Billing, Permissions & Polish

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Role-based access control (RBAC) | M | Roles: Owner, Manager, Host, Server. Owner manages billing & settings. Manager manages staff & tables. Host manages queue. Server views queue only. |
| Multi-user per restaurant | S | Multiple staff members with individual logins. Activity log per user. |
| Billing dashboard for owners | M | View plan, usage, invoices, payment method. Upgrade/downgrade. Cancel with exit survey. |
| Advanced CRM filters | S | Filter customers by: visit count, last visit date, average party size, trust score, allergens, source. Export to CSV. |
| Embeddable widget v2 | M | Improved public widget: show estimated wait time, party count, join queue directly. Customizable colors/branding. iFrame and Web Component versions. |
| API v0 (internal) | M | RESTful API for all core operations. Not public yet, but structured and documented. This is the foundation for the public API in Phase 3. OpenAPI spec. |

**Technical Debt:**
- Complete extraction of all business logic into API service layer.
- Implement proper caching strategy (Redis via Upstash for frequently-read data: restaurant config, current queue count).
- Audit and optimize all database queries. Target: no query > 100ms.

**Infrastructure:**
- Upstash Redis for caching and rate limiting.
- Move secrets management to Vercel environment variables with proper scoping.
- Implement automated database backups verification (test restore monthly).

**Hiring:**
- Team is now: 2 engineers, 1 designer (contract), 1 growth (contract), founder(s).
- Begin recruiting: 1 senior backend engineer (for API-first architecture in Phase 3).

**Key Metrics:**
- 50 paying restaurants
- MRR: $15,000
- Average revenue per restaurant: $300/mo (mix of tiers)
- Churn rate: < 4% monthly
- RBAC adoption: 80% of restaurants have 2+ users
- API v0 serving 100% of dashboard operations

**Revenue Target:** $15,000

---

## PHASE 3: SCALE (Months 7-9)

### MONTH 7 -- Multi-Location & Chains

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Multi-location management | L | Single owner account manages multiple locations. Unified billing. Cross-location analytics. Shared customer database. Central menu/promo management with per-location overrides. |
| Chain admin dashboard | M | Aggregate view: total parties across all locations, performance comparison, staff performance, busiest locations. |
| Location-level configuration | M | Each location can have different: table layout, operating hours, notification templates, promos, staff. Inherits defaults from chain settings. |
| POS integration -- Square | L | Two-way sync: when party is seated in Meantime, create ticket in Square POS. When check is closed in Square, auto-mark table as available. Reduces double-entry for hosts. |
| POS integration -- Toast | L | Same as Square integration but for Toast. These two cover ~60% of US restaurant POS market. |
| Reservation integration (OpenTable/Resy inbound) | M | Accept reservation data from OpenTable/Resy. Show reserved tables in host dashboard alongside walk-in queue. Unified view. |

**Technical Debt:**
- Refactor database schema for hierarchical multi-tenancy: Organization -> Location -> Queue -> Party.
- Implement tenant isolation testing: verify no data leakage between restaurants.
- Begin API versioning strategy (v1 prefix on all endpoints).

**Infrastructure:**
- **Architecture decision point: stay on Vercel/Supabase or begin migration.**
  - At 200 restaurants with real-time updates, Supabase real-time connections will be ~500-1000 concurrent.
  - Supabase Pro plan handles this. Stay on Supabase until 500+ restaurants or specific feature needs arise.
  - Vercel scales fine for serverless. No migration needed yet.
  - **Decision: Stay on Vercel/Supabase through M12. Re-evaluate at 500 restaurants.**
- Upgrade Supabase to Pro plan ($25/mo) if not already.
- Set up database connection pooling properly for multi-location concurrent access.
- Implement request queuing for POS integration webhooks (Supabase Edge Functions + queue).

**Hiring:**
- 1 senior backend engineer starts. Focus: API, POS integrations.
- Team: 3 engineers, 1 designer, 1 growth, founder(s).

**Key Metrics:**
- 80 paying locations (some are multi-location chains)
- 3+ chain accounts (5+ locations each)
- POS integration active at 20+ locations
- Cross-location query performance: < 500ms
- Zero data leakage incidents

**Revenue Target:** $30,000

---

### MONTH 8 -- Public API & Advanced Analytics

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Public API v1 | L | RESTful API with API key authentication. Endpoints: queue management, party CRUD, table status, analytics read, webhook subscriptions. Rate limited per tier. Full OpenAPI documentation on docs.meantime.app. |
| Webhook system | M | Restaurants can subscribe to events: party_joined, party_seated, party_left, no_show, review_submitted. POST to their endpoint. Retry logic. Webhook logs in dashboard. |
| Advanced analytics v3 | L | Revenue attribution: track revenue generated per party (from pre-orders). Customer lifetime value. Cohort analysis (first-time vs repeat visitors). Predictive: "next week will be 20% busier than average". |
| Custom reporting & exports | M | Schedule daily/weekly/monthly CSV or PDF reports via email. Custom date ranges. Filter by source, party size, time slot. |
| Staff performance metrics | S | Track per-host: parties seated, average seating time, no-show rate on their shift. Leaderboard optional. |
| Guest communication log | S | Full history of all WhatsApp messages sent to/from each guest. Visible in CRM. Audit trail. |

**Technical Debt:**
- Implement proper API gateway pattern (can use Vercel middleware or Kong on Supabase).
- Add comprehensive API request logging for debugging and usage analytics.
- Implement database query result caching with proper invalidation.
- Load testing: simulate 200 concurrent restaurants with 50 parties each.

**Infrastructure:**
- API documentation hosting (Swagger UI or Redocly on docs.meantime.app).
- Webhook delivery infrastructure: dedicated queue, retry logic, delivery logs.
- Database performance: analyze query plans, add missing indexes, consider materialized views for analytics.
- **Load test results determine if infrastructure changes are needed.** Target: handle 10,000 concurrent parties across all restaurants.

**Hiring:**
- 1 DevOps/infrastructure engineer (contract) for load testing and optimization.
- Begin recruiting: 1 customer success manager.

**Key Metrics:**
- 120 paying locations
- API: 10+ restaurants actively using the API
- Webhook delivery success rate: 99%+
- Analytics queries: < 3 seconds for any report
- System handles 10,000 concurrent parties without degradation

**Revenue Target:** $45,000

---

### MONTH 9 -- Enterprise & Security

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| SSO/SAML for enterprise | M | Enterprise chains need SSO. Integrate with Okta, Azure AD, Google Workspace. Required for Business/Enterprise tier. |
| Audit logging | M | Every action logged: who did what, when, from which IP. Immutable audit trail. Required for compliance. Retention: 1 year. |
| Data export & portability | S | Restaurant owners can export all their data (parties, customers, analytics) in standard formats. GDPR Article 20 compliance. |
| Custom SLA management | S | Enterprise tier: define SLA terms (uptime, response time). Dashboard showing SLA compliance. Automated alerts on SLA breach. |
| Branded mobile experience (PWA) | M | Progressive Web App for diners: installable, push notifications (in addition to WhatsApp), offline queue status. Branded per restaurant via white-label. |
| Advanced AI wait time | M | Incorporate: current queue, historical patterns, day of week, weather, local events, table turn time. Target: within 3 minutes accuracy for 90% of predictions. |

**Technical Debt:**
- Security audit by external firm. Fix all critical and high findings.
- Implement secrets rotation policy (API keys, database passwords, WhatsApp tokens).
- Penetration testing on public API.
- OWASP Top 10 compliance verification.

**Infrastructure:**
- **Security hardening for enterprise:**
  - Enable Supabase Vault for secrets management.
  - Implement IP allowlisting for API access (enterprise tier).
  - Add WAF rules on Vercel (Vercel Firewall).
  - Enable database encryption at rest (Supabase default) and in transit (SSL enforced).
  - Implement field-level encryption for PII (customer phone numbers, names).
- **SOC 2 Type I preparation begins.** Engage compliance consultancy. Expected timeline: 3-4 months to achieve.
- Set up vulnerability scanning (Snyk or Dependabot) in CI pipeline.

**Hiring:**
- 1 customer success manager starts.
- Team: 3-4 engineers, 1 designer, 1 growth, 1 CSM, founder(s). Total: 7-8 people.

**Key Metrics:**
- 200 paying locations
- MRR: $60,000
- 2+ enterprise accounts (Business/Enterprise tier)
- Security audit: zero critical vulnerabilities
- PWA installs: 1,000+
- Wait time prediction accuracy: within 3 minutes for 90%

**Revenue Target:** $60,000

---

## PHASE 4: MULTI-VERTICAL & PLATFORM (Months 10-12)

### THE ABSTRACTION LAYER

Before building vertical-specific features, refactor the core platform:

**Current restaurant-specific concepts -> Generic platform concepts:**

| Restaurant Term | Platform Term | Description |
|----------------|---------------|-------------|
| Restaurant | Venue / Location | Any business with a queue |
| Table | Service Point | A table, exam room, bank teller, barber chair |
| Party | Visit / Appointment | Group of people waiting for service |
| Party size | Group size | Number of people in the visit |
| Menu | Service Catalog | Items that can be ordered/selected pre-visit |
| Pre-order | Pre-service selection | Choose service type, products, etc. before visit |
| Seated | In Service | Currently being served |
| Allergy alert | Special requirements | Any critical info the service provider needs |
| Host | Agent / Operator | Person managing the queue |
| Trust score | Customer score | Loyalty/priority metric |

**Database schema changes (M10):**
- Add `venue_type` enum: `restaurant`, `clinic`, `bank`, `barbershop`, `retail`, `government`, `custom`.
- Add `service_type` table: defines what services a venue offers (for clinic: checkup, lab, X-ray).
- Add `priority_queue` support: multiple queues per venue, each with priority rules.
- Add `appointment_slot` table: for venues that mix appointments with walk-ins.
- All existing restaurant features continue working -- restaurant is just one `venue_type`.

---

### MONTH 10 -- Platform Core & Healthcare Vertical

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Platform abstraction layer | L | Refactor core to support any venue type. Generic queue, service point, visit models. Venue type determines UI labels, workflow rules, compliance requirements. |
| Multi-queue support | M | Single venue can have multiple queues. Clinic: check-in queue, lab queue, pharmacy queue. Bank: personal banking, business banking, mortgage. Parties can be transferred between queues. |
| Priority queue logic | M | Priority rules per queue: appointment time, urgency level, VIP status, age (seniors first), disability accommodation. Configurable per venue. Manual override by operator. |
| Service type management | M | Define service types per venue. Clinic: "General checkup (15 min)", "Blood work (10 min)", "X-ray (20 min)". Estimated duration per service. Used for wait time calculation. |
| Appointment + walk-in hybrid | L | Calendar-based appointment booking alongside walk-in queue. Appointments get priority but walk-ins fill gaps. Visual timeline view for operators. WhatsApp appointment reminders. |
| Healthcare-specific compliance flags | M | HIPAA-relevant: no patient names in WhatsApp messages (use ticket numbers). No medical info in notifications. Configurable privacy levels per venue type. |

**Technical Debt:**
- Ensure all restaurant features work identically after platform abstraction.
- Regression test suite for restaurant vertical: every feature must pass.
- Performance testing with multi-queue scenarios.

**Infrastructure:**
- **HIPAA compliance preparation** (for healthcare vertical):
  - BAA (Business Associate Agreement) with Supabase (available on Enterprise plan).
  - BAA with Twilio/WhatsApp provider.
  - Encrypt all PHI at rest and in transit (already covered by Supabase + SSL).
  - Access logging for all PHI access (audit log from M9).
  - Implement automatic session timeout for operators.
  - Data retention policies: configurable per venue (healthcare requires specific retention periods).
- **Decision point: Supabase Enterprise plan** for BAA. Cost: ~$599/mo. Required for healthcare.

**Hiring:**
- 1 additional full-stack engineer (healthcare/compliance experience preferred).
- 1 sales person (begin outreach to clinic chains, bank branches).
- Team: 4-5 engineers, 1 designer, 1 growth, 1 CSM, 1 sales. Total: 9-10 people.

**Key Metrics:**
- Platform abstraction complete with zero regression in restaurant vertical
- 3+ healthcare pilot locations
- Multi-queue tested with 5+ queues per venue
- HIPAA compliance checklist: 90%+ complete

**Revenue Target:** $80,000

---

### MONTH 11 -- Banking & Retail Verticals

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Banking vertical configuration | M | Pre-configured templates for bank branches: queue types (teller, loan officer, new account), average service times, priority rules (appointment > walk-in), branch hours. |
| Retail vertical: appointment booking | M | Retail stores with appointment-based services (Apple Store Genius Bar model): book time slot, queue for walk-in, service type selection. |
| Ticket number system | S | Alternative to name-based queue for privacy-sensitive venues (banks, government). Customer gets ticket number displayed on WhatsApp. Called by number on screen/speaker. |
| Digital signage / TV display mode | M | Large-screen display showing current queue: ticket numbers, estimated wait, "now serving" alerts. Runs on any browser/smart TV. Kiosk mode variant. Auto-refresh. |
| Capacity management | S | Venue-level capacity limits. Fire code compliance. Dashboard shows current occupancy vs capacity. Alert when approaching capacity. |
| Feedback by service type | S | Post-visit review request customized by service type. "How was your checkup?" vs "How was your banking experience?" Rating + optional comment. |

**Technical Debt:**
- Optimize real-time performance for high-volume venues (banks can have 200+ visitors/day).
- Ensure ticket number system works correctly with multi-queue (no collisions).
- Test digital signage with 8+ hour continuous operation (memory leaks, reconnection).

**Infrastructure:**
- Digital signage requires persistent WebSocket connections. Verify Supabase real-time handles 24/7 connections with auto-reconnect.
- CDN optimization for signage assets (low-bandwidth, fast load).
- Consider dedicated real-time channel per signage display to reduce message volume.

**Hiring:**
- No new hires. Team is sufficient for vertical expansion with existing platform.

**Key Metrics:**
- 2+ banking pilot locations
- 2+ retail pilot locations
- Digital signage deployed at 10+ venues
- Ticket number system active at 5+ venues
- Total venue count: 230+

**Revenue Target:** $100,000

---

### MONTH 12 -- Platform Maturity & Marketplace

**Features to Build:**

| Feature | Effort | Description |
|---------|--------|-------------|
| Marketplace for integrations | M | Public directory of integrations (POS, CRM, calendar). Partners can list their integrations. Foundation for ecosystem. |
| Multi-vertical customer profiles | M | A single customer visiting restaurants AND clinics on Meantime has unified profile. Cross-vertical loyalty potential. Privacy controls: customer chooses what to share per vertical. |
| White-label v2 (full platform) | M | Complete white-label: custom domain, custom branding on all touchpoints (WhatsApp messages, widget, signage, emails). For enterprise clients who want "powered by" hidden. |
| Advanced reporting builder | L | Drag-and-drop report builder. Custom metrics, date ranges, filters, charts. Schedule automated delivery. Export to PDF/CSV/Google Sheets. |
| Government vertical (basic) | M | DMV/town hall configuration: take-a-number, service categories, estimated processing time, multi-window service. Accessibility features (large text, high contrast). |
| Platform health dashboard | S | Internal: cross-vertical metrics, system health, revenue by vertical, growth trends. Board-ready reporting. |

**Technical Debt:**
- Full platform documentation: architecture docs, API docs, onboarding docs, runbooks.
- Disaster recovery plan: documented, tested quarterly.
- Complete SOC 2 Type I certification.

**Infrastructure:**
- **SOC 2 Type I certification achieved** (started in M9, 3-month process).
- Begin SOC 2 Type II continuous monitoring.
- For HIPAA: complete compliance certification with selected auditor.
- Evaluate infrastructure costs vs revenue. At $120K MRR and ~$2K infrastructure cost, margins are healthy.
- **Self-hosted evaluation:** At this scale (200+ venues, ~$120K MRR), Supabase/Vercel costs are ~$500-2,000/mo. Self-hosting saves maybe $1,000/mo but adds operational burden. **Decision: Stay on managed services until $500K+ MRR or specific compliance requirements force migration.**

**Hiring:**
- 1 additional sales person (vertical-specific: healthcare or banking).
- Consider: VP of Engineering hire at $200K+ MRR.
- Team at end of year: 4-5 engineers, 1 designer, 1 growth, 1 CSM, 2 sales, founder(s). Total: 11-12 people.

**Key Metrics:**
- Total venues: 250+
- MRR: $120,000
- ARR: $1.4M run rate
- Verticals active: 4 (restaurant, health, banking, retail)
- SOC 2 Type I certified
- API active users: 30+
- Churn rate: < 3% monthly
- NPS: 50+

**Revenue Target:** $120,000

---

## CROSS-CUTTING DECISIONS

### MOBILE APP DECISION

| Timeline | Decision | Rationale |
|----------|----------|-----------|
| M1-6 | PWA only | Web app with service worker. Install prompt on mobile Chrome/Safari. Push notifications via WhatsApp (primary channel). Cost: $0 extra. |
| M7-9 | Enhanced PWA | Add offline support, background sync, app-like navigation. PWA covers 90% of native app functionality. |
| M9-12 | **Evaluate native app** | If PWA push notification limitations on iOS become a blocker (Safari push is now supported but limited), consider React Native or Expo for a thin native wrapper. Only build native if PWA metrics show > 20% of users would benefit. |
| M12+ | Native app if justified | Only if: (a) PWA engagement is measurably lower than competitors with native apps, (b) features requiring native APIs (NFC, Bluetooth beacons) become priority, or (c) enterprise clients require MDM-managed app deployment. |

**Recommendation: Stay PWA through Month 12. Native app is a Month 13+ decision based on data.**

---

### API-FIRST ARCHITECTURE TIMELINE

| Month | Milestone |
|-------|-----------|
| M6 | API v0: internal API serving the dashboard. All UI operations go through API layer. |
| M8 | API v1: public RESTful API with API key auth, rate limiting, OpenAPI docs. |
| M10 | Webhook system: event-driven integrations. |
| M12 | Marketplace: third-party integrations directory. |
| M12+ | API v2: GraphQL option for complex queries. SDK libraries (JS, Python). |

---

### TECHNICAL ARCHITECTURE EVOLUTION

```
MONTH 1-6 (Current):
  [Next.js on Vercel] -> [Supabase (Postgres + Auth + Realtime + Edge Functions)]
  [WhatsApp via Twilio/360dialog]
  [Stripe for billing]
  [Sentry for errors]
  [PostHog for analytics]

MONTH 7-9 (Add caching & queue):
  [Next.js on Vercel] -> [Upstash Redis (cache + rate limit)]
                      -> [Supabase Pro (Postgres + Auth + Realtime + Edge Functions)]
  [API Gateway layer (Vercel middleware)]
  [Webhook delivery queue (Upstash QStash)]
  [POS integrations (Square, Toast)]

MONTH 10-12 (Platform):
  [Next.js on Vercel] -> [Upstash Redis]
                      -> [Supabase Enterprise (Postgres + Auth + Realtime + Edge Functions)]
                      -> [QStash (async job processing)]
  [Public API v1 with API keys]
  [Webhook delivery system]
  [POS + Calendar + CRM integrations]
  [Digital signage (WebSocket channels)]
  [Multi-vertical queue engine]

MONTH 13+ (If needed):
  Consider: dedicated Postgres on AWS RDS/Neon if Supabase pricing exceeds $5K/mo
  Consider: move Edge Functions to AWS Lambda if cold start becomes issue
  Consider: Kubernetes only if self-hosted requirement from enterprise client
```

**Key principle: Only migrate away from managed services when the cost of staying exceeds the cost (time + money + risk) of migrating. Vercel/Supabase scale well to $500K+ MRR.**

---

### SECURITY HARDENING TIMELINE

| Month | Action | Why |
|-------|--------|-----|
| M1 | Supabase RLS audit, input validation, rate limiting | Basic security hygiene |
| M2 | WhatsApp opt-in compliance, data encryption review | Regulatory compliance |
| M3 | Penetration testing (self or automated via Snyk) | Find vulnerabilities early |
| M6 | RBAC, audit logging foundation | Enterprise readiness |
| M8 | External security audit | Third-party validation |
| M9 | SOC 2 Type I preparation begins, field-level encryption for PII | Enterprise sales requirement |
| M10 | HIPAA compliance for healthcare (BAA, PHI controls) | Healthcare vertical requirement |
| M12 | SOC 2 Type I achieved, HIPAA certification in progress | Enterprise and healthcare sales enablement |
| M15+ | SOC 2 Type II (continuous), HIPAA full certification | Ongoing compliance |

---

## RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WhatsApp Business API policy change (rate limits, template restrictions) | Medium | High | Build SMS fallback. Explore RCS. Keep templates compliant. |
| Supabase real-time scaling limits at 500+ concurrent connections | Low | High | Architecture supports swap to dedicated WebSocket server (Socket.io on Railway/Fly). |
| POS integration maintenance burden (API changes) | High | Medium | Abstract POS behind interface. Budget 20% of integration engineer time for maintenance. |
| Enterprise sales cycle longer than expected (6+ months) | Medium | Medium | Focus on SMB revenue. Enterprise is bonus, not dependency. |
| HIPAA compliance costs exceed budget | Medium | Medium | Start with clinics that do NOT handle PHI in Meantime (queue only, no medical data). |
| Key engineer leaves | Medium | High | Document everything. No single points of failure in codebase. Competitive comp. |

---

## QUARTERLY SUMMARY

| Quarter | Venues | MRR | Team Size | Key Milestone |
|---------|--------|-----|-----------|---------------|
| Q1 (M1-3) | 10 | $2,500 | 3 | Product-market fit validated, paying customers |
| Q2 (M4-6) | 50 | $15,000 | 6 | Self-service onboarding, public API foundation |
| Q3 (M7-9) | 200 | $60,000 | 8 | Multi-location chains, POS integrations, SOC 2 started |
| Q4 (M10-12) | 250+ | $120,000 | 12 | Multi-vertical platform, healthcare + banking pilots, SOC 2 achieved |

---

## MONTH-BY-MONTH ENGINEERING CAPACITY

Assuming 1 engineer = 1 Large feature OR 2-3 Medium features OR 4-6 Small features per month.

| Month | Engineers | Capacity | Allocated To |
|-------|-----------|----------|-------------|
| M1 | 1 | 1L or 3M | Stability, testing, observability |
| M2 | 1 | 1L or 3M | Billing, onboarding, mobile optimization |
| M3 | 2 | 2L or 6M | Analytics, marketing site, SMS fallback |
| M4 | 2 | 2L or 6M | Self-service onboarding wizard (big lift) |
| M5 | 2 | 2L or 6M | Marketplace, customer profiles, table turn tracking |
| M6 | 2 | 2L or 6M | RBAC, API v0, widget v2, billing dashboard |
| M7 | 3 | 3L or 9M | Multi-location, POS integrations (Square + Toast) |
| M8 | 3 | 3L or 9M | Public API v1, webhooks, advanced analytics |
| M9 | 3-4 | 3-4L or 10M | SSO, security audit, PWA, AI wait time v2 |
| M10 | 4-5 | 4-5L or 12M | Platform abstraction, multi-queue, healthcare |
| M11 | 4-5 | 4-5L or 12M | Banking + retail verticals, digital signage |
| M12 | 4-5 | 4-5L or 12M | Marketplace, white-label v2, government, SOC 2 |
