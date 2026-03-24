# MEANTIME -- Legal & Compliance Research + Investor Deck Outline

**WhatsApp-First Virtual Waitlist SaaS for Restaurants (Argentina / LATAM)**
**Research Date: March 2026**

---

# PART 1: LEGAL & COMPLIANCE

---

## 1. Argentina Data Protection (Ley 25.326)

### 1.1 What Data Can We Collect?

Under Ley 25.326 (Personal Data Protection Act), data collection must be:
- **True, adequate, relevant, and not excessive** relative to the stated purpose
- Collected with **free, express, and informed consent**
- Not collected by fraudulent, deceptive, or unlawful means

**For Meantime specifically:**

| Data Field | Permissible? | Classification | Notes |
|---|---|---|---|
| Name | Yes | Personal data | Standard -- requires consent |
| Phone number | Yes | Personal data | Core to WhatsApp delivery |
| Location (restaurant vicinity) | Yes | Personal data | Must state purpose (queue proximity) |
| Dietary allergies | CAUTION | Sensitive data (health) | Ley 25.326 Art. 7 treats health data as "sensitive." Requires explicit, written consent and must be strictly necessary. Consider collecting only at order time, not at waitlist join |
| Wait preferences | Yes | Personal data | Non-sensitive operational data |
| Party size | Yes | Personal data | Operational, non-sensitive |

**Key constraint on allergies:** Health-related data is classified as "sensitive data" under Art. 2 and Art. 7. Collecting it requires a stronger legal basis. Recommendation: Do NOT collect allergy data as part of the waitlist flow. If needed, let the restaurant collect it separately during seating.

### 1.2 AAIP Registration -- MANDATORY

**Yes, registration is required.** Any entity processing personal data for purposes beyond personal/domestic use must register with the Registro Nacional de Bases de Datos (National Registry of Databases) under the AAIP (Agencia de Acceso a la Informacion Publica).

**Registration process:**
- Done through Portal TAD (Tramites a Distancia)
- Requires AFIP clave fiscal level 2 or higher
- Must declare: data controller identity, purpose, data categories collected, data origin, recipients, security measures, and retention period

**Information required in the filing:**
1. Identity and address of the data controller
2. Purpose of the data processing
3. Categories of personal data processed
4. Source/origin of the data
5. Data recipients or classes of recipients
6. Security measures implemented
7. Data retention period

**Failure to register can result in administrative sanctions.**

Source: [AAIP -- Tramites](https://www.argentina.gob.ar/aaip/datospersonales/tramites), [AAIP -- Obligaciones](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones)

### 1.3 Privacy Policy Requirements

Under Ley 25.326, your privacy policy must inform users of:
- Identity of the data controller
- Purpose of data collection
- Categories of data collected
- Recipients or categories of recipients
- Rights of data subjects (access, rectification, deletion, objection)
- Whether providing data is mandatory or optional
- Consequences of refusal to provide data
- Security measures in place
- Data retention periods
- Cross-border transfer details and safeguards

**Practical requirement:** The privacy policy must be available IN SPANISH and accessible before or at the point of data collection (i.e., before the user joins a waitlist via WhatsApp).

### 1.4 Data Retention Rules

Ley 25.326 does not prescribe specific retention periods but mandates:
- Data must be destroyed or anonymized when no longer needed for the stated purpose
- Data subjects can request deletion at any time (derecho de supresion)
- The data controller must respond within 10 business days

**Recommendation for Meantime:**
- Waitlist session data: Delete or anonymize within 24-48 hours of visit completion
- Customer profiles (for returning guests): Retain with consent, offer opt-out
- Analytics/aggregated data: Retain indefinitely (if truly anonymized)
- Define and publish a clear retention schedule in the privacy policy

### 1.5 Cross-Border Data Transfer (Supabase US Servers)

**This is a critical compliance risk.**

The US is NOT on Argentina's list of countries with "adequate protection." Adequate countries include: EU/EEA members, Switzerland, Uruguay, UK, Canada (private sector), New Zealand, Andorra, Guernsey, Jersey, Isle of Man, Faeroe Islands.

**Options to legally transfer data to US-based Supabase servers:**

1. **Explicit data subject consent** -- The user must be clearly informed that their data will be transferred to servers in the US and must expressly consent. This must be granular and specific (not buried in general T&Cs).

2. **Standard Contractual Clauses (SCCs)** -- Execute a data transfer agreement with Supabase following the model clauses issued by the AAIP. This is the most robust approach.

3. **Binding Corporate Rules (BCRs)** -- Less relevant for a B2B SaaS using a third-party provider.

**Recommended approach:** Use BOTH mechanisms:
- Include explicit consent in the WhatsApp opt-in flow
- Execute SCCs with Supabase (Supabase already has a DPA available)
- Document the transfer in your AAIP registry filing

Source: [ITIF -- Argentina Cross-Border Data Transfer](https://itif.org/publications/2025/02/27/argentinas-cross-border-data-transfer-regulation/), [DLA Piper -- Argentina](https://www.dlapiperdataprotection.com/index.html?t=law&c=AR)

---

## 2. WhatsApp Business API Compliance

### 2.1 Meta's Terms for Business Messaging

All businesses using the WhatsApp Business Platform must comply with:
- WhatsApp Business Policy
- WhatsApp Messaging Guidelines
- WhatsApp Business Terms of Service
- WhatsApp Commerce Policy (if applicable)

Violations can result in rate limiting, messaging restrictions, or account suspension.

**Argentina-specific:** LATAM countries including Argentina are adopting GDPR-inspired frameworks. Templates must be localized (Spanish) and comply with regional messaging laws. A single global template often fails Meta's approval due to language and policy variations.

Source: [WhatsApp Business Policy](https://business.whatsapp.com/policy)

### 2.2 Opt-In Requirements

**You CANNOT message users first without opt-in.**

Requirements:
- Users must actively opt in to receive WhatsApp messages from your business
- Opt-in must be collected separately from other consents
- You must clearly state: (a) what types of messages the user will receive, (b) the business name sending messages
- Opt-in can be collected via: website form, QR code scan at the restaurant, WhatsApp "click to chat" link, or in-person verbal consent documented digitally

**For Meantime's waitlist flow:**
- The guest scanning a QR code or texting a keyword to join the waitlist constitutes opt-in for waitlist-related messages
- Marketing messages (promotions, future visit reminders) require SEPARATE opt-in
- Users must be able to opt out at any time (e.g., reply STOP)

### 2.3 Template Message Approval

- All outbound messages sent outside the 24-hour customer service window must use pre-approved templates
- Templates are submitted through the WhatsApp Business Manager
- Approval typically takes 24-48 hours
- Templates are categorized: Marketing, Utility, Authentication
- For Meantime, most messages are **Utility** (queue position updates, table-ready alerts)

**Templates Meantime would need:**
1. "Your table is ready" notification (Utility)
2. Queue position update (Utility)
3. Waitlist confirmation (Utility)
4. Post-visit feedback request (Marketing -- needs separate opt-in)
5. Promotional offers from restaurants (Marketing -- needs separate opt-in)

### 2.4 Anti-Spam Rules

- Do not send unsolicited messages
- Maintain a quality rating above "Medium" (monitored by Meta)
- High block/report rates trigger rate limiting, then account restriction
- Do not send more than the allowed messaging volume (starts at 250/day, scales to 100K+/day based on quality)
- As of January 2026, Meta banned mainstream chatbots from running on WhatsApp Business API; only business automation flows (support bots, booking bots, order bots) are permitted

### 2.5 WhatsApp Business Verification Cost

**Meta Business Verification:** Free (identity verification through Meta Business Manager)

**Meta Verified for Business (green checkmark badge):**
- Requires verified Meta Business Manager
- Submit official business documents (registration certificate, utility bills, etc.)
- Monthly subscription fee applies (pricing varies by market; not yet available in all countries)
- Processing time: up to 3 business days

**WhatsApp Business API access (via BSP):**
- API access itself: Free through Meta Cloud API
- Business Solution Provider (BSP) fees: Varies ($0-$500/month depending on provider)
- Popular BSPs for LATAM: Twilio, Infobip, WATI, 360dialog

### 2.6 Messaging Costs (Post-July 2025)

As of July 1, 2025, WhatsApp switched from per-conversation to per-message pricing:

| Message Category | Approximate Cost (Argentina) | Notes |
|---|---|---|
| Utility | $0.004-$0.03 | Queue updates, table-ready alerts |
| Marketing | $0.025-$0.10+ | Promotions, re-engagement |
| Authentication | $0.004-$0.03 | Login codes |
| Service (user-initiated, within 24h) | FREE | Replies within customer service window |

**Cost-saving opportunities:**
- Utility templates sent within a customer service window are FREE
- Free entry point conversations: 72-hour free window when user initiates via click-to-chat or QR code
- OTPs/login codes up to 78% cheaper in LATAM vs. other regions

Source: [WhatsApp Platform Pricing](https://business.whatsapp.com/products/platform-pricing), [YCloud Pricing Update](https://www.ycloud.com/blog/whatsapp-api-pricing-update)

---

## 3. Restaurant Industry Regulations (Argentina)

### 3.1 Digital Queue Management

**There are no specific Argentine laws regulating digital queue management for restaurants.** However, several adjacent regulations apply:

- Municipal regulations in CABA and provinces may have specific rules about occupancy, fire safety, and crowd management that indirectly affect how queues are managed
- Health codes require restaurants to maintain safe capacity limits -- a digital waitlist can actually help compliance
- No prohibition on virtual/digital queuing systems exists

### 3.2 Consumer Protection (Ley 24.240)

Ley 24.240 (Defensa del Consumidor) applies to Meantime's operations in several ways:

**Key obligations:**
- **Right to information (Art. 4):** Consumers must receive clear, accurate, and detailed information about the services provided. Meantime must clearly communicate: estimated wait times, how the queue works, data usage
- **Service quality:** Services must be provided under the conditions offered. If you promise "your table in 15 minutes," there are consumer expectations implications
- **Complaint handling:** Must maintain a complaints register (libro de quejas) accessible to users
- **Digital commerce:** Electronic Commerce Law (Ley 26.951) ensures online consumers have the same rights as in-person consumers

**Risk mitigation for Meantime:**
- Always display estimated wait times as ranges, not guarantees ("approximately 15-25 minutes")
- Clearly state that wait times are estimates and subject to change
- Provide easy opt-out/cancellation from the waitlist
- Maintain a complaints channel

Source: [ICLG -- Consumer Protection Argentina](https://iclg.com/practice-areas/consumer-protection-laws-and-regulations/argentina)

### 3.3 Accessibility (Ley 26.378 + Ley 26.653)

**Ley 26.378** ratified the UN Convention on the Rights of Persons with Disabilities (CRPD) with constitutional status in Argentina.

**Ley 26.653** (2010) specifically mandates web accessibility:
- Applies to public sector websites and increasingly to private sector services
- Requires WCAG 2.0 compliance at levels A and AA
- While enforcement on private companies is limited, best practice is to comply

**For Meantime (WhatsApp-first):**
- WhatsApp itself handles most accessibility (screen readers, text-to-speech)
- Any web-based components (restaurant dashboard, admin panel) should follow WCAG 2.0 AA
- Consider offering alternative channels for users who cannot use WhatsApp (SMS fallback, phone call option)

Source: [Argentina.gob.ar -- Ley 26378](https://www.argentina.gob.ar/andis/convencion-sobre-los-derechos-de-las-personas-con-discapacidad-ley-26378)

---

## 4. Business Structure

### 4.1 SAS vs SRL

| Factor | SAS (Sociedad por Acciones Simplificada) | SRL (Sociedad de Responsabilidad Limitada) |
|---|---|---|
| Minimum partners | 1 (sole founder OK) | 2 |
| Registration time | ~24 hours (online) | ~30 days (notary required) |
| Cost to establish | ~ARS 50,000-100,000 | ~3x the cost of SAS |
| Books | Digital | Paper (must rubric) |
| CUIT registration | Automatic with registration | Separate AFIP step required |
| Flexibility | High (customizable bylaws) | More rigid structure |
| Investor-friendliness | High (easily issue new shares) | Lower (quota transfers need unanimous consent) |
| Capital requirement | Minimum 2 minimum wages | Minimum 2 minimum wages |

**Recommendation: SAS** -- Faster, cheaper, digital-first, sole-founder compatible, and preferred by investors/accelerators. Over 30,000 SAS companies have been created since the 2017 law, generating 47,000+ jobs.

**CAVEAT (2024-2025):** The Milei administration's DNU 70/2023 attempted to restrict new SAS creation. As of early 2026, check current status -- SAS creation may be restricted or require IGJ (Inspeccion General de Justicia) pre-approval in some jurisdictions. SRL may be the fallback if SAS is unavailable.

Source: [Contablix -- SAS Guide 2025](https://contablix.ar/blog/sas-en-argentina-todo-lo-que-necesitas-saber-antes-de-armar-una-sociedad-guia-completa-2025/)

### 4.2 Monotributo vs Responsable Inscripto

| Factor | Monotributo | Responsable Inscripto |
|---|---|---|
| Annual billing limit (2025) | Up to ~ARS 68M (Cat. K for services) | No limit |
| Tax payments | Fixed monthly fee (includes retirement + health) | IVA (21%) + Income Tax + Social Security |
| Invoice type | Factura C (no IVA discrimination) | Factura A (to other RI) or B (to consumers/monotributistas) |
| IVA credit | Cannot compute IVA credits | Can deduct IVA on expenses |
| Complexity | Very low | High (requires accountant) |
| Perception by clients | Less professional | More professional for B2B |

**For SaaS selling to restaurants (B2B):**
- Restaurants that are Responsable Inscripto prefer receiving Factura A (so they can deduct IVA)
- As a Monotributista, you can only issue Factura C (no IVA credit for the restaurant)
- This makes your service effectively 21% more expensive for RI restaurant clients

**Recommendation:**
- Start as Monotributo if you are in early pilot/validation phase and billing is under ARS 68M/year
- Transition to Responsable Inscripto (via SAS) once you have paying customers, to issue Factura A and appear more professional for B2B

### 4.3 Invoicing to Restaurants

| Your status | Restaurant is RI | Restaurant is Monotributo | Restaurant is Consumidor Final |
|---|---|---|---|
| You are RI | Factura A | Factura B | Factura B |
| You are Monotributo | Factura C | Factura C | Factura C |

**Electronic invoicing (factura electronica)** is mandatory through AFIP's systems.

### 4.4 Payment Collection

| Method | Pros | Cons | Fees |
|---|---|---|---|
| MercadoPago | Dominant in Argentina, easy integration, recurring billing support | Higher fees, complex fund withdrawal | ~4.5-6% + IVA per transaction |
| Stripe Argentina | Not fully available for Argentine entities (as of 2025) | Cannot receive payments as an Argentine company directly | N/A |
| Rebill | Designed for LATAM SaaS recurring billing | Newer platform, smaller ecosystem | Varies |
| Wire transfer (CBU/CVU) | Zero fees, immediate | No automated recurring billing | Free |
| Payway / Prisma | Major card processor in Argentina | Enterprise-oriented | ~2-3% |

**Recommendation:**
- **Primary:** MercadoPago for automated recurring billing (widely trusted, QR integration possible)
- **Secondary:** Direct bank transfer (CBU) for larger restaurant chains wanting to avoid transaction fees
- **Future:** Rebill if you need multi-country LATAM billing
- **For international revenue:** Consider Stripe Atlas or a US entity structure

Source: [Stripe -- Payments in Argentina](https://stripe.com/resources/more/payments-in-argentina), [Rebill Alternatives](https://www.rebill.com/en/blog/alternativas-a-mercado-pago)

---

## 5. Terms of Service Template Outline

### 5.1 Key Clauses Needed

**For the Restaurant (B2B -- the customer of Meantime):**

1. **Definitions** -- Service, Platform, Authorized Users, Customer Data, End Users (diners)
2. **Service Description** -- WhatsApp-based virtual waitlist management; what is and is not included
3. **Subscription Terms** -- Pricing tier, billing cycle, payment terms, automatic renewal
4. **Acceptable Use** -- No spam through the platform, compliance with WhatsApp policies, no discriminatory queue practices
5. **Data Processing Agreement (DPA)** -- Meantime as data processor, restaurant as data controller; compliant with Ley 25.326
6. **Intellectual Property** -- Meantime retains all IP; restaurant retains their customer data
7. **Confidentiality** -- Both parties protect confidential information
8. **Service Level Agreement (SLA)** -- Uptime commitment (e.g., 99.5%), planned maintenance windows
9. **Termination** -- For convenience (30 days notice), for cause (material breach, 15 days to cure)
10. **Data Portability** -- Restaurant can export their data upon termination
11. **Indemnification** -- Each party indemnifies the other for their own negligence/breach

**For the End User (Diner -- the person joining the waitlist):**

1. **Acceptance** -- By joining the waitlist via WhatsApp, user accepts terms
2. **Data Collection and Use** -- What data is collected, why, how long it is retained
3. **WhatsApp Messaging Consent** -- Explicit opt-in for waitlist notifications
4. **No Guarantee** -- Wait times are estimates; Meantime is not liable for restaurant delays
5. **User Rights** -- Access, rectify, delete personal data (per Ley 25.326)
6. **Age Restriction** -- Must be 16+ to use (or parental consent)

### 5.2 Limitation of Liability

Key provisions:
- Cap total liability at the fees paid in the prior 12 months (or last month for monthly billing)
- Exclude consequential, indirect, incidental, and punitive damages
- Explicitly disclaim liability for: restaurant service quality, food quality, wait time accuracy, WhatsApp platform outages, third-party service failures
- Note: Under Argentine consumer protection law (Ley 24.240), liability caps vis-a-vis consumers may not be fully enforceable. Draft carefully with local counsel.

### 5.3 Data Processing Agreement (DPA)

Must include:
- Roles: Meantime = Data Processor; Restaurant = Data Controller
- Data processing purposes: solely to provide the waitlist service
- Sub-processors: list Supabase, WhatsApp/Meta, any BSP
- Cross-border transfer safeguards (SCCs with Supabase)
- Security measures: encryption at rest and in transit, access controls
- Breach notification: within 48 hours of discovering a breach
- Data return/deletion upon contract termination
- Audit rights (limited to once per year, with reasonable notice)
- Compliance with Ley 25.326 and AAIP requirements

---
---

# PART 2: INVESTOR / PITCH DECK OUTLINE (12 Slides)

---

## Slide 1: COVER

**Tagline:** "Meantime -- Turn your wait into revenue"

**Sub-tagline:** "WhatsApp-first virtual waitlist for restaurants in Latin America"

**Visual:** Logo + clean design with WhatsApp green accent

**Talking points:**
- One-liner positioning: "We help restaurants keep walk-in customers instead of losing them to the wait"
- Founded in [Year], based in Buenos Aires, Argentina
- Pre-seed / Seed stage

---

## Slide 2: THE PROBLEM

**Headline:** "Restaurants lose 20-30% of walk-in customers because of wait times"

**Key data points to include:**
- 50% of restaurant customers do NOT make reservations (Toast, 2025)
- Only 12% of diners always make reservations; 33% rarely do
- During peak hours, restaurants experience 20-30% waitlist abandonment
- Average restaurant loses ~$1,500/week from walkaway customers (Toast Technology Report 2025)
- 30% of customers who leave a queue do not return within 30 days
- A mid-sized restaurant (200 walk-ins/week, 10% walkout, $45 avg spend) loses ~$46,800/year

**Pain points for restaurant owners:**
1. No visibility into how many customers they lose
2. Paper waitlists are chaotic and inaccurate
3. Customers leave without telling anyone
4. No way to communicate with waiting customers
5. Existing solutions (OpenTable, Resy) focus on reservations, not walk-ins

**In LATAM specifically:**
- Walk-in culture dominates (reservations are less common than in US/Europe)
- Restaurants lack affordable tech solutions
- No dominant player in digital waitlist management

Sources: [Carbonara App](https://www.carbonaraapp.com/how-many-customer-do-you-lose/), [QueueAway Stats](https://www.queueaway.co.uk/blog/hospitality-queue-statistics), [Toast Reservation Data 2025](https://pos.toasttab.com/blog/data/restaurant-wait-times-and-reservations-data)

---

## Slide 3: THE SOLUTION

**Headline:** "WhatsApp-first virtual waitlist -- no app download, no hardware"

**How it works (3 steps):**
1. **Guest scans QR code** at the restaurant entrance (or texts a keyword via WhatsApp)
2. **Meantime sends queue updates** via WhatsApp (position, estimated time)
3. **Restaurant notifies guest** when their table is ready -- guest returns

**Why WhatsApp:**
- 90-99% penetration in LATAM (Argentina 90%, Brazil 99%, Mexico 93%)
- No app download required -- zero friction for the guest
- Already the way people communicate in LATAM
- Rich media: can send menu, promotions, directions while waiting
- 98% message open rate vs. 20% for email, 45% for SMS

**Key differentiators:**
- Zero hardware needed (runs on restaurant's existing phone/tablet)
- No app download for guests
- Works in areas with poor WiFi (WhatsApp works on basic data connections)
- Spanish/Portuguese native -- built for LATAM from day one
- Restaurant dashboard for real-time queue management

**Value proposition for restaurants:**
- Reduce walkaways by 50-70%
- Recover $20,000-$50,000/year in lost revenue
- Improve guest experience and Google/TripAdvisor reviews
- Collect customer data for remarketing (with consent)

Sources: [Statista -- WhatsApp LATAM Penetration](https://www.statista.com/statistics/1323702/whatsapp-penetration-latin-american-countries/), [Infobip WhatsApp Stats](https://www.infobip.com/blog/whatsapp-statistics)

---

## Slide 4: PRODUCT DEMO

**Headline:** "Simple for guests. Powerful for restaurants."

**Guest flow (show screenshots/mockups):**
1. QR code scan at restaurant door
2. WhatsApp opens with pre-filled message: "Hi! I'd like to join the waitlist at [Restaurant Name]"
3. Bot asks: Name? Party size?
4. Confirmation: "You're #4 in line. Estimated wait: ~20 min. We'll message you when your table is ready!"
5. Update: "You're now #2! Almost there."
6. Alert: "Your table is ready! Please come to the host stand. You have 5 minutes."

**Restaurant dashboard (show mockups):**
- Real-time queue view (name, party size, wait time, status)
- One-click "table ready" notification
- Analytics: average wait time, walkaway rate, peak hours
- Customer history: returning guests flagged
- Multi-location support

**Talking point:** "Demo the product live if presenting in person. Show real WhatsApp interaction on your phone."

---

## Slide 5: MARKET SIZE

**Headline:** "A $15B+ restaurant tech opportunity across LATAM"

### TAM (Total Addressable Market) -- LATAM Restaurant Tech

| Market | Food Service Market Size (2025) | Estimated # Restaurants |
|---|---|---|
| Argentina | $15.8B | ~40,000 (FEHGRA data) |
| Brazil | $18.5-55.6B | ~1,000,000+ |
| Mexico | ~$30B+ | ~700,000+ |
| Colombia | ~$8B | ~100,000+ |
| Chile | ~$5B | ~50,000+ |
| **LATAM Total** | **~$100B+** | **~2,000,000+** |

**TAM:** If 2M LATAM restaurants each paid $50/month = $1.2B/year

### SAM (Serviceable Addressable Market)

Focus: Full-service restaurants with walk-in traffic in Argentina + Brazil + Mexico
- Estimated 500,000 relevant restaurants
- At $30/month avg = $180M/year

### SOM (Serviceable Obtainable Market) -- Year 1-3

- Year 1: 200 restaurants in Argentina (Buenos Aires focus) = $72K ARR
- Year 2: 2,000 restaurants (Argentina + Sao Paulo) = $720K ARR
- Year 3: 10,000 restaurants (Argentina + Brazil + Mexico) = $3.6M ARR

Sources: [IMARC -- Argentina Food Service](https://www.imarcgroup.com/argentina-food-service-market), [Mordor Intelligence -- Brazil Foodservice](https://www.mordorintelligence.com/industry-reports/brazil-foodservice-market), [Market Data Forecast -- LATAM Fast Food](https://www.marketdataforecast.com/market-reports/latin-america-fast-food-market)

---

## Slide 6: BUSINESS MODEL

**Headline:** "SaaS subscription + per-message revenue share"

### Pricing Tiers

| Tier | Price (USD/month) | Target | Includes |
|---|---|---|---|
| **Starter** | $19/mo | Single-location, <100 guests/month | 500 WhatsApp messages, basic dashboard, 1 user |
| **Pro** | $49/mo | Busy restaurants, 100-500 guests/month | 2,000 messages, analytics, 3 users, priority support |
| **Enterprise** | $99+/mo | Chains, multi-location | Unlimited messages, API access, custom integrations, dedicated support |

### Revenue Streams

1. **SaaS subscription** (primary) -- 70% of revenue
2. **WhatsApp message overage** -- charge above included messages at $0.02-0.05/msg -- 15% of revenue
3. **Premium features** -- SMS fallback, CRM integrations, marketing automation -- 10% of revenue
4. **Data insights** (anonymized, aggregated) -- foot traffic analytics sold to landlords/developers -- 5% of revenue (future)

### Unit Economics (Target at Scale)

- CAC: $50-100 (direct sales + referrals in restaurant clusters)
- LTV: $1,200-2,400 (24-48 month avg lifetime at $50/mo)
- LTV:CAC ratio: 12-24x
- Gross margin: 75-80% (primary cost is WhatsApp API messages)
- Monthly churn target: <3%

---

## Slide 7: TRACTION

**Headline:** "Validated with [X] restaurants at Chui pilot"

**Key metrics to show (fill with actual Chui pilot data):**

| Metric | Number |
|---|---|
| Pilot restaurants | [X] |
| Total guests managed | [X] |
| Avg walkaways reduced | [X]% |
| Messages sent | [X] |
| Guest satisfaction (NPS) | [X] |
| Restaurant retention | [X]% |
| Revenue (if any) | $[X] |

**Qualitative traction:**
- Testimonial quotes from Chui restaurant owners
- Before/after metrics (walkaway rate, avg wait time, table turns)
- Screenshots of real WhatsApp conversations (anonymized)
- Any press coverage or social media mentions

**Milestones to highlight:**
- MVP built and deployed
- WhatsApp Business API approved and operational
- First paying customer (if applicable)
- Partnership discussions with [restaurant associations, BSPs, etc.]

---

## Slide 8: COMPETITION

**Headline:** "No one owns WhatsApp-first waitlisting in LATAM"

### Competitive Landscape Map

**Axes:** X = Walk-in focus vs. Reservation focus | Y = LATAM-native vs. Global/US-centric

| Competitor | Focus | Region | Weakness vs. Meantime |
|---|---|---|---|
| OpenTable | Reservations | US/Global | Not walk-in focused; low LATAM penetration; requires app |
| Resy (American Express) | Reservations | US | No LATAM presence; premium market only |
| Yelp Waitlist | Waitlist | US | US-only; requires Yelp ecosystem |
| Carbonara App | Waitlist | Europe | No WhatsApp integration; SMS-based |
| TablesReady | Waitlist | US | SMS-based; no LATAM presence |
| CoverManager/Zenchef | Reservations + waitlist | Europe + LATAM | Expensive; enterprise-focused; not WhatsApp-first |
| Restorando (TheFork) | Reservations | LATAM | Acquired by TheFork; reservation-focused; declining in LATAM |
| Toast Waitlist | POS + waitlist | US | Tied to Toast POS; US-only |

**Meantime's positioning:** WhatsApp-native, walk-in first, affordable, built for LATAM

**Defensibility:**
- Network effects: more restaurants in a neighborhood = more guest familiarity
- WhatsApp template library optimized for Spanish/Portuguese restaurant context
- Local market knowledge and regulatory compliance
- First-mover advantage in WhatsApp-first waitlist for LATAM

Sources: [Tracxn -- Restaurant SaaS](https://tracxn.com/d/sectors/restaurant-saas/__hIeUshhrzVDyGjUDz_1tSxjcsXn_nn5vBOzgFs16xdg), [CoverManager + Zenchef merger](https://blog.zenchef.com/blog-post/zenchef-x-covermanager)

---

## Slide 9: GO-TO-MARKET

**Headline:** "City-by-city, neighborhood-by-neighborhood"

### Phase 1: Buenos Aires (Months 1-6)
- **Target:** Palermo, Recoleta, San Telmo restaurant corridors
- **Strategy:** Door-to-door sales; sign up 3-5 restaurants per block to create density
- **Pricing:** Free pilot (1 month) then $19-49/mo
- **Goal:** 50-200 restaurants

### Phase 2: Argentina Expansion (Months 6-12)
- **Target:** Cordoba, Rosario, Mendoza, Mar del Plata (seasonal)
- **Strategy:** Partner with local restaurant associations (FEHGRA affiliates), food delivery platforms
- **Goal:** 500-2,000 restaurants

### Phase 3: Brazil (Months 12-24)
- **Target:** Sao Paulo, Rio de Janeiro
- **Why Brazil:** 99% WhatsApp penetration, largest restaurant market in LATAM, 1M+ restaurants
- **Strategy:** Local hire, Portuguese localization, partner with iFood/Rappi ecosystems
- **Goal:** 2,000-5,000 restaurants

### Phase 4: Mexico + Colombia (Months 24-36)
- **Target:** Mexico City, Guadalajara, Monterrey, Bogota, Medellin
- **Strategy:** Franchise-like partner model; local operators
- **Goal:** 5,000-10,000 restaurants

### Growth Channels
1. **Direct sales** (restaurant corridors -- sign up entire blocks)
2. **Referral program** (restaurants refer restaurants, guests refer restaurants)
3. **Strategic partnerships** (POS systems, delivery platforms, payment processors)
4. **Content marketing** (restaurant management blog in Spanish/Portuguese)
5. **WhatsApp virality** (every guest who uses Meantime sees the brand)

---

## Slide 10: TEAM

**Headline:** "Built by operators who understand LATAM hospitality"

**What to include for each founder/key team member:**
- Photo
- Name and role
- Relevant experience (restaurant industry, SaaS, WhatsApp API, LATAM markets)
- Notable achievements
- LinkedIn URL

**Key roles investors want to see (or plans to hire):**
- CEO/Founder -- vision, sales, fundraising
- CTO -- product, WhatsApp API integration, Supabase architecture
- Head of Growth -- restaurant acquisition, LATAM expansion
- Advisors -- restaurant industry veterans, LATAM SaaS founders

**If solo founder:** Emphasize technical ability + domain knowledge. Show advisor board. Mention plans for first hires with use of funds.

---

## Slide 11: FINANCIALS

**Headline:** "Path to $3.6M ARR in 3 years"

### 3-Year Projection

| Metric | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Restaurants (paying) | 200 | 2,000 | 10,000 |
| Avg MRR per restaurant | $30 | $35 | $40 |
| MRR (end of year) | $6,000 | $70,000 | $400,000 |
| ARR (end of year) | $72,000 | $840,000 | $4,800,000 |
| Revenue (full year) | $36,000 | $420,000 | $2,400,000 |
| Gross margin | 70% | 75% | 80% |
| Burn rate (monthly) | $8,000 | $25,000 | $80,000 |
| Team size | 3 | 8 | 25 |
| Key markets | Argentina | Argentina + Brazil | Argentina + Brazil + Mexico |

### Key Assumptions
- 5% monthly growth in restaurant count after initial sales push
- 3% monthly churn
- ARPU increases with upselling to higher tiers and message overage
- WhatsApp API costs decrease as volume increases
- Gross margin improves with scale (bulk BSP pricing)

### Path to Profitability
- Break-even at ~5,000 restaurants ($200K MRR)
- Expected in Month 24-30
- Cash-flow positive by end of Year 3

### Comparable Valuations (Restaurant SaaS)
- Restaurant SaaS companies raised $323M in equity funding in 2025 across 26 rounds
- $4.97B invested in restaurant SaaS over the past 10 years
- Median SaaS revenue multiple: 7-10x ARR for early-stage
- Bootstrapped SaaS: ~4.8x ARR; equity-backed: ~5.3x ARR

Sources: [Tracxn -- Restaurant SaaS Funding](https://tracxn.com/d/sectors/restaurant-saas/__hIeUshhrzVDyGjUDz_1tSxjcsXn_nn5vBOzgFs16xdg), [SaaS Capital Index](https://www.saas-capital.com/blog-posts/saas-valuation-multiples-understanding-the-new-normal/)

---

## Slide 12: THE ASK

**Headline:** "Raising $[X] to dominate LATAM's WhatsApp waitlist market"

### Suggested Ask Structure (Pre-Seed)

**Raising:** $150,000-$300,000

**Use of funds:**

| Category | % | Amount ($250K raise) | Purpose |
|---|---|---|---|
| Product development | 40% | $100,000 | Full-time CTO/dev, WhatsApp API infrastructure, dashboard V2 |
| Sales & marketing | 30% | $75,000 | 2 sales reps for Buenos Aires door-to-door, QR materials, content |
| Operations & legal | 15% | $37,500 | AAIP registration, legal setup (SAS), accounting, compliance |
| Reserve / runway | 15% | $37,500 | 6-month buffer |

**Milestones this round will achieve:**
1. 200 paying restaurants in Buenos Aires
2. $6K MRR
3. Product-market fit validated
4. Ready for seed round to enter Brazil

### Suggested Ask Structure (Seed -- if further along)

**Raising:** $500,000-$1,000,000

**Use of funds:**
- 50% Product + Engineering (3-5 person dev team)
- 30% Sales expansion (Argentina + Brazil launch)
- 10% Operations + legal (Brazil entity, multi-country compliance)
- 10% Reserve

**Milestones:**
1. 2,000 restaurants across Argentina + Brazil
2. $70K MRR
3. Series A ready

---
---

# APPENDIX: KEY DATA POINTS SUMMARY

## Market Data Quick Reference

| Data Point | Value | Source |
|---|---|---|
| WhatsApp penetration -- Argentina | 90% | Statista 2025 |
| WhatsApp penetration -- Brazil | 99% | Statista 2025 |
| WhatsApp penetration -- Mexico | 93% | Statista 2025 |
| LATAM fast food market | $61.5B (2025) | Market Data Forecast |
| Argentina food service market | $15.8B (2024) | IMARC Group |
| Brazil foodservice market | $18.5-55.6B (2025) | Mordor Intelligence |
| Argentina restaurant count | ~40,000 | FEHGRA |
| Brazil restaurant count | ~1,000,000+ | Industry estimates |
| Walkaway rate during peak | 20-30% | QueueAway / Carbonara |
| Avg weekly revenue lost to walkaways | $1,500 | Toast 2025 |
| Annual revenue lost (mid-size restaurant) | $46,800 | QueueAway calculation |
| Diners who rarely/never reserve | 50%+ | Toast 2025 |
| Restaurant SaaS funding (2025) | $323M across 26 rounds | Tracxn |
| Restaurant SaaS total VC (10yr) | $4.97B | Tracxn |
| SaaS median revenue multiple | 7.0x ARR | SaaS Capital 2025 |
| Argentina SaaS ecosystem | 76 companies, $542.5M rev | Latka |
| Internet penetration Argentina | 89%+ (projected 95%+ by 2025) | Stripe/industry reports |
| Argentina ecommerce volume | $33B (2024), projected $50B (2027) | Stripe |

## Regulatory Quick Reference

| Requirement | Status | Action Needed |
|---|---|---|
| AAIP database registration | Mandatory | File via Portal TAD with AFIP clave fiscal |
| Privacy policy | Mandatory | Draft in Spanish, display before data collection |
| Cross-border data transfer consent | Mandatory (US servers) | Explicit consent + SCCs with Supabase |
| WhatsApp opt-in | Mandatory | Collect at QR scan / waitlist join |
| Consumer protection (Ley 24.240) | Applicable | Clear info, no wait-time guarantees, complaint channel |
| Accessibility (Ley 26.653) | Applicable to web | WCAG 2.0 AA for dashboard; WhatsApp handles guest-side |
| Business entity | Recommended: SAS | Check current SAS availability (DNU 70/2023 impact) |
| Tax regime | Start Monotributo, move to RI | Issue Factura A to RI restaurants when possible |
| Allergy data collection | Avoid | Health data = sensitive; let restaurant handle separately |

---

*This document is for informational and planning purposes. Consult with Argentine legal counsel (especialista en datos personales) before finalizing compliance strategy. Consult with a contador publico for tax structure decisions.*
