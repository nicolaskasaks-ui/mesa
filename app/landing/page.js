"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { T, f, APP_NAME } from "@/lib/tokens";

// ───────────────────────────────────────────────
// Shared styles
// ───────────────────────────────────────────────
const section = {
  padding: "96px 24px",
  maxWidth: 1120,
  margin: "0 auto",
};

const sectionAlt = {
  ...section,
  background: T.bgPage,
  maxWidth: "100%",
  padding: "96px 24px",
};

const heading = {
  fontFamily: f.display,
  fontWeight: 700,
  fontSize: "clamp(28px, 5vw, 44px)",
  lineHeight: 1.15,
  color: T.accent,
  margin: 0,
};

const subheading = {
  fontFamily: f.display,
  fontWeight: 600,
  fontSize: "clamp(20px, 3vw, 28px)",
  color: T.accent,
  margin: 0,
};

const body = {
  fontFamily: f.sans,
  fontSize: 17,
  lineHeight: 1.65,
  color: T.textMed,
  margin: 0,
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: f.display,
  fontWeight: 600,
  fontSize: 16,
  padding: "14px 32px",
  background: T.success,
  color: "#fff",
  border: "none",
  borderRadius: T.radiusSm,
  cursor: "pointer",
  textDecoration: "none",
  transition: "transform 0.15s, box-shadow 0.15s",
};

const btnSecondary = {
  ...btnPrimary,
  background: "transparent",
  color: T.accent,
  border: `1.5px solid ${T.border}`,
};

// ───────────────────────────────────────────────
// Animate-on-scroll wrapper
// ───────────────────────────────────────────────
function FadeIn({ children, style, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────
// FAQ Item
// ───────────────────────────────────────────────
function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "20px 0",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          all: "unset",
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontFamily: f.display,
          fontWeight: 600,
          fontSize: 17,
          color: T.accent,
        }}
      >
        {q}
        <span
          style={{
            fontSize: 22,
            transform: open ? "rotate(45deg)" : "rotate(0)",
            transition: "transform 0.25s",
            marginLeft: 16,
            flexShrink: 0,
          }}
        >
          +
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 300 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease",
        }}
      >
        <p style={{ ...body, paddingTop: 12 }}>{a}</p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Feature Tab Categories
// ───────────────────────────────────────────────
const FEATURE_CATEGORIES = [
  {
    id: "core",
    label: "Core",
    features: [
      { icon: "\u{1F4F1}", title: "Registro QR en 10 segundos", desc: "El cliente escanea, ingresa su nombre y numero. Sin descargar app, sin crear cuenta." },
      { icon: "\u{1F4AC}", title: "WhatsApp bidireccional", desc: "Notificaciones de mesa lista, actualizaciones de posicion, y mensajeria 2-way con el restaurante." },
      { icon: "\u{1F5A5}", title: "Dashboard hostess en tiempo real", desc: "Grilla de mesas, estado de fila, tiempos estimados, todo en una sola pantalla." },
      { icon: "\u{1F5C2}", title: "Drag & drop para sentar", desc: "Arrastra un grupo a una mesa en el grid. Asignacion visual e instantanea." },
    ],
  },
  {
    id: "intelligence",
    label: "Inteligencia",
    features: [
      { icon: "\u{1F9E0}", title: "Prediccion ML de espera", desc: "Modelo que cruza clima, dia, hora, tamanio del grupo y velocidad de rotacion para estimar tiempos." },
      { icon: "\u{2B50}", title: "Trust scoring de clientes", desc: "Clasifica automaticamente: Nuevo, Verificado, Confiable, Habitual. Prioriza a los que siempre vienen." },
      { icon: "\u{1F4A1}", title: "Sugerencia inteligente de mesa", desc: "Recomienda la mejor mesa segun tamanio del grupo y disponibilidad actual." },
      { icon: "\u{1F9F9}", title: "Auto-cleanup de mesas zombie", desc: "Detecta mesas que excedieron su tiempo estimado y alerta a la hostess para liberar espacio." },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    features: [
      { icon: "\u{1F37A}", title: "Promo 2x1 en barra", desc: "Los clientes que esperan reciben una promo de barra. Monetiza cada minuto de espera." },
      { icon: "\u{1F374}", title: "Pre-order desde la fila", desc: "El cliente puede pedir del menu de barra mientras espera. Listos para consumir al sentarse." },
      { icon: "\u{1F4B3}", title: "Bar POS lite para barman", desc: "Interfaz simplificada para que el barman confirme y cobre pedidos de la fila." },
    ],
  },
  {
    id: "experience",
    label: "Experiencia",
    features: [
      { icon: "\u{1F4CD}", title: "GPS walk-around mode", desc: "El cliente pasea por el barrio. Meantime trackea su distancia en vivo y lo alerta al acercarse su turno." },
      { icon: "\u{23F1}", title: "ETA al confirmar llegada", desc: "Cuando el cliente dice que viene en camino, mostramos su tiempo estimado de arribo." },
      { icon: "\u{1F310}", title: "Multi-idioma ES/EN", desc: "Deteccion automatica del idioma del celular. Perfecto para turistas." },
      { icon: "\u{1F517}", title: "Programa de referidos", desc: "Los clientes invitan amigos y ganan beneficios. Crece tu base organicamente." },
      { icon: "\u{1F4D6}", title: "Menu browsing en la espera", desc: "El cliente navega tu carta mientras espera. Llega a la mesa ya sabiendo que pedir." },
    ],
  },
  {
    id: "operations",
    label: "Operaciones",
    features: [
      { icon: "\u{1F4CA}", title: "Analytics con KPIs", desc: "Rotacion, tiempo de espera promedio, tasa de abandono, revenue de barra, todo en un dashboard." },
      { icon: "\u{1F465}", title: "CRM con historial completo", desc: "Nombre, visitas, preferencias, alergias, gasto promedio. Conoce a cada cliente." },
      { icon: "\u{1F50D}", title: "Source tracking", desc: "Sabe si el cliente vino por Meantime, walk-in o derivado de OpenTable. Medi tus canales." },
      { icon: "\u{1F4F2}", title: "Modo kiosk para self check-in", desc: "Tablet en la puerta para que los clientes se anoten solos sin intervenir la hostess." },
      { icon: "\u26A0\uFE0F", title: "Alertas de alergia al sentar", desc: "Cuando sentas un cliente con alergias registradas, la hostess recibe un aviso automatico." },
    ],
  },
];

// ───────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState("core");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeCategory = FEATURE_CATEGORIES.find((c) => c.id === activeTab);

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      {/* ─── HEADER ─── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 64,
          background: scrolled ? "rgba(255,255,255,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        <span
          style={{
            fontFamily: f.display,
            fontWeight: 700,
            fontSize: 22,
            color: T.accent,
            letterSpacing: "-0.02em",
          }}
        >
          {APP_NAME}
        </span>
        <Link
          href="/signup"
          style={{
            ...btnPrimary,
            padding: "10px 22px",
            fontSize: 14,
          }}
        >
          Empezar gratis
        </Link>
      </header>

      {/* ─── HERO ─── */}
      <section
        style={{
          ...section,
          paddingTop: 160,
          paddingBottom: 80,
          textAlign: "center",
        }}
      >
        <FadeIn>
          <p
            style={{
              fontFamily: f.display,
              fontWeight: 600,
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: T.success,
              marginBottom: 20,
            }}
          >
            Fila virtual inteligente para restaurantes
          </p>
        </FadeIn>

        <FadeIn delay={0.08}>
          <h1 style={{ ...heading, fontSize: "clamp(36px, 6vw, 64px)", marginBottom: 20 }}>
            Tu restaurante siempre lleno
          </h1>
        </FadeIn>

        <FadeIn delay={0.16}>
          <p
            style={{
              fontFamily: f.display,
              fontWeight: 500,
              fontSize: "clamp(18px, 3vw, 24px)",
              color: T.gold,
              maxWidth: 600,
              margin: "0 auto 24px",
              lineHeight: 1.4,
            }}
          >
            La fila virtual que convierte espera en facturacion
          </p>
        </FadeIn>

        <FadeIn delay={0.24}>
          <p style={{ ...body, maxWidth: 560, margin: "0 auto 40px", fontSize: 18 }}>
            Tus clientes se anotan con un QR, les avisas por WhatsApp cuando su
            mesa esta lista. Prediccion ML, revenue de barra, GPS tracking. Sin app, sin fricciones.
          </p>
        </FadeIn>

        <FadeIn delay={0.32}>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={btnPrimary}>
              Empezar gratis
            </Link>
            <a href="#como-funciona" style={btnSecondary}>
              Ver como funciona
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={0.4}>
          <p
            style={{
              ...body,
              fontSize: 14,
              color: T.textLight,
              marginTop: 24,
            }}
          >
            Setup en 5 minutos &middot; Sin tarjeta &middot; Cancelar cuando quieras
          </p>
        </FadeIn>
      </section>

      {/* ─── TRUSTED BY ─── */}
      <section style={{ background: T.bgPage, padding: "48px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
          <FadeIn>
            <p
              style={{
                fontFamily: f.display,
                fontWeight: 600,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: T.textLight,
                marginBottom: 28,
              }}
            >
              Restaurantes que confian en {APP_NAME}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 48,
                flexWrap: "wrap",
                opacity: 0.45,
              }}
            >
              {["Chui", "La Cabrera", "Sarkis", "Oviedo", "Don Julio", "Elena"].map((name) => (
                <span
                  key={name}
                  style={{
                    fontFamily: f.display,
                    fontWeight: 700,
                    fontSize: 20,
                    color: T.accent,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section style={{ ...section }}>
        <FadeIn>
          <h2 style={{ ...heading, textAlign: "center", marginBottom: 56, fontSize: "clamp(24px, 4vw, 36px)" }}>
            El 30% de tus clientes se va cuando ve la fila
          </h2>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 32,
          }}
        >
          {[
            { icon: "\ud83d\udeb6", title: "Clientes se van a otro restaurante", desc: "Cada persona que se va es una mesa vacia y plata que no vuelve." },
            { icon: "\u23f0", title: "La hostess pierde tiempo gestionando la espera", desc: "Anotar nombres en papel, gritar turnos, buscar clientes en la calle." },
            { icon: "\ud83d\udcc9", title: "Mesas vacias en hora pico = plata perdida", desc: "Sin gestion inteligente, las rotaciones bajan y la facturacion cae." },
          ].map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: T.radius,
                  padding: 32,
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 40, display: "block", marginBottom: 16 }}>{p.icon}</span>
                <h3 style={{ ...subheading, fontSize: 18, marginBottom: 10 }}>{p.title}</h3>
                <p style={body}>{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS (expanded) ─── */}
      <section id="como-funciona" style={sectionAlt}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ ...heading, textAlign: "center", marginBottom: 12, fontSize: "clamp(24px, 4vw, 36px)" }}>
              Como funciona
            </h2>
            <p style={{ ...body, textAlign: "center", marginBottom: 56 }}>
              Del QR a la mesa, en piloto automatico.
            </p>
          </FadeIn>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 32,
            }}
          >
            {[
              {
                step: "01",
                title: "QR en la puerta",
                desc: "El cliente escanea y se anota en 10 segundos. Sin descargas, sin registro.",
              },
              {
                step: "02",
                title: "Espera inteligente",
                desc: "Ve el menu, pide un 2x1 en barra, pasea por el barrio con GPS tracking.",
              },
              {
                step: "03",
                title: "Prediccion ML",
                desc: "Nuestro modelo predice el tiempo de espera cruzando clima, dia, hora y velocidad de rotacion.",
              },
              {
                step: "04",
                title: "WhatsApp automatico",
                desc: "Le avisamos cuando su mesa esta lista. Mensajeria bidireccional, sin app.",
              },
              {
                step: "05",
                title: "Drag & drop",
                desc: "La hostess arrastra al grupo a la mesa en el grid. Alertas de alergia incluidas.",
              },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div>
                  <span
                    style={{
                      fontFamily: f.display,
                      fontWeight: 700,
                      fontSize: 44,
                      color: T.accentLight,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    {s.step}
                  </span>
                  <h3 style={{ ...subheading, fontSize: 19, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ ...body, fontSize: 15 }}>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES (tabbed) ─── */}
      <section style={{ ...section }}>
        <FadeIn>
          <h2 style={{ ...heading, textAlign: "center", marginBottom: 12, fontSize: "clamp(24px, 4vw, 36px)" }}>
            Todo lo que necesitas
          </h2>
          <p style={{ ...body, textAlign: "center", marginBottom: 40 }}>
            21 funcionalidades pensadas para que tu restaurante facture mas.
          </p>
        </FadeIn>

        {/* Tab bar */}
        <FadeIn delay={0.05}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 40,
              flexWrap: "wrap",
            }}
          >
            {FEATURE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                style={{
                  all: "unset",
                  fontFamily: f.display,
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "10px 20px",
                  borderRadius: 100,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: activeTab === cat.id ? T.accent : T.accentSoft,
                  color: activeTab === cat.id ? "#fff" : T.textMed,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Feature grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {activeCategory &&
            activeCategory.features.map((feat, i) => (
              <FadeIn key={`${activeTab}-${i}`} delay={i * 0.05}>
                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.cardBorder}`,
                    borderRadius: T.radius,
                    padding: 28,
                    transition: "box-shadow 0.2s",
                  }}
                >
                  <span style={{ fontSize: 28, display: "block", marginBottom: 12 }}>{feat.icon}</span>
                  <h3 style={{ ...subheading, fontSize: 17, marginBottom: 8 }}>{feat.title}</h3>
                  <p style={{ ...body, fontSize: 15 }}>{feat.desc}</p>
                </div>
              </FadeIn>
            ))}
        </div>
      </section>

      {/* ─── VS COMPETITORS ─── */}
      <section style={sectionAlt}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ ...heading, textAlign: "center", marginBottom: 12, fontSize: "clamp(24px, 4vw, 36px)" }}>
              Por que {APP_NAME}
            </h2>
            <p style={{ ...body, textAlign: "center", marginBottom: 48 }}>
              Lo que nosotros tenemos y la competencia no.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontFamily: f.sans,
                  fontSize: 15,
                  background: T.card,
                  borderRadius: T.radius,
                  overflow: "hidden",
                  border: `1px solid ${T.cardBorder}`,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontFamily: f.display, fontWeight: 600, color: T.accent, borderBottom: `1px solid ${T.cardBorder}` }}>
                      Funcionalidad
                    </th>
                    <th style={{ padding: "16px 20px", fontFamily: f.display, fontWeight: 700, color: T.success, borderBottom: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
                      {APP_NAME}
                    </th>
                    <th style={{ padding: "16px 20px", fontFamily: f.display, fontWeight: 600, color: T.textLight, borderBottom: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
                      Otros
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["QR signup sin app", true, true],
                    ["WhatsApp nativo (no SMS)", true, false],
                    ["GPS tracking en vivo", true, false],
                    ["Revenue de barra durante espera", true, false],
                    ["Trust scoring de clientes", true, false],
                    ["Prediccion ML de espera", true, false],
                    ["Pre-order desde la fila", true, false],
                    ["Dashboard hostess real-time", true, true],
                    ["Multi-idioma automatico", true, false],
                    ["CRM con historial completo", true, "Parcial"],
                    ["Alertas de alergia al sentar", true, false],
                    ["Modo kiosk", true, "Parcial"],
                  ].map(([feature, us, them], i) => (
                    <tr key={i}>
                      <td style={{ padding: "12px 20px", borderBottom: `1px solid ${T.cardBorder}`, color: T.text }}>
                        {feature}
                      </td>
                      <td style={{ padding: "12px 20px", borderBottom: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
                        {us === true ? (
                          <span style={{ color: T.success, fontWeight: 700, fontSize: 18 }}>{"\u2713"}</span>
                        ) : (
                          <span style={{ color: T.textLight }}>{us}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 20px", borderBottom: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
                        {them === true ? (
                          <span style={{ color: T.success, fontWeight: 700, fontSize: 18 }}>{"\u2713"}</span>
                        ) : them === false ? (
                          <span style={{ color: T.danger, fontWeight: 700, fontSize: 18 }}>{"\u2717"}</span>
                        ) : (
                          <span style={{ color: T.warn, fontSize: 13, fontWeight: 600 }}>{them}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section style={section}>
        <FadeIn>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
            <p
              style={{
                fontFamily: f.display,
                fontWeight: 600,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: T.success,
                marginBottom: 16,
              }}
            >
              Social proof
            </p>
            <h2 style={{ ...heading, fontSize: "clamp(24px, 4vw, 36px)", marginBottom: 32 }}>
              Usado por restaurantes en Buenos Aires
            </h2>
            <div
              style={{
                background: T.accentSoft,
                borderRadius: T.radius,
                padding: "40px 32px",
                fontStyle: "italic",
                ...body,
                fontSize: 18,
              }}
            >
              &ldquo;Desde que usamos {APP_NAME}, la fila no nos asusta. Los clientes
              esperan contentos y consumiendo. Facturamos un 20% mas en hora pico.&rdquo;
              <p
                style={{
                  fontStyle: "normal",
                  fontWeight: 600,
                  marginTop: 16,
                  color: T.accent,
                  fontSize: 15,
                }}
              >
                &mdash; Restaurante, Villa Crespo
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ─── PRICING ─── */}
      <section style={sectionAlt}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ ...heading, textAlign: "center", marginBottom: 12, fontSize: "clamp(24px, 4vw, 36px)" }}>
              Precios simples
            </h2>
            <p style={{ ...body, textAlign: "center", marginBottom: 56 }}>
              Empeza gratis. Escala cuando quieras.
            </p>
          </FadeIn>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
              alignItems: "start",
            }}
          >
            {[
              {
                name: "Free",
                price: "$0",
                period: "para siempre",
                features: [
                  "50 clientes/mes",
                  "1 usuario hostess",
                  "QR personalizado",
                  "WhatsApp basico",
                  "Dashboard en tiempo real",
                  "Multi-idioma ES/EN",
                ],
                cta: "Empezar gratis",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$29",
                period: "/mes",
                features: [
                  "Clientes ilimitados",
                  "Prediccion ML de espera",
                  "Trust scoring",
                  "GPS walk-around mode",
                  "Promo 2x1 en barra",
                  "Pre-order desde la fila",
                  "CRM con historial",
                  "Analytics con KPIs",
                  "Source tracking",
                  "Programa de referidos",
                  "Alertas de alergia",
                  "Soporte prioritario",
                ],
                cta: "Empezar gratis",
                highlight: true,
              },
              {
                name: "Growth",
                price: "$59",
                period: "/mes",
                features: [
                  "Todo Pro incluido",
                  "Multi-ubicacion",
                  "White-label branding",
                  "Bar POS lite",
                  "Modo kiosk self check-in",
                  "API access",
                  "Auto-cleanup mesas zombie",
                  "Onboarding dedicado",
                ],
                cta: "Contactar ventas",
                highlight: false,
              },
            ].map((plan, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div
                  style={{
                    background: T.card,
                    border: plan.highlight ? `2px solid ${T.success}` : `1px solid ${T.cardBorder}`,
                    borderRadius: T.radius,
                    padding: 36,
                    position: "relative",
                    boxShadow: plan.highlight ? T.shadowLg : "none",
                  }}
                >
                  {plan.highlight && (
                    <span
                      style={{
                        position: "absolute",
                        top: -13,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: T.success,
                        color: "#fff",
                        fontFamily: f.display,
                        fontWeight: 600,
                        fontSize: 12,
                        padding: "4px 16px",
                        borderRadius: 20,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Popular
                    </span>
                  )}
                  <h3
                    style={{
                      ...subheading,
                      fontSize: 18,
                      marginBottom: 8,
                      color: plan.highlight ? T.success : T.accent,
                    }}
                  >
                    {plan.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                    <span style={{ fontFamily: f.display, fontWeight: 700, fontSize: 42, color: T.accent }}>
                      {plan.price}
                    </span>
                    <span style={{ ...body, fontSize: 15 }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
                    {plan.features.map((feat, j) => (
                      <li
                        key={j}
                        style={{
                          ...body,
                          fontSize: 15,
                          padding: "5px 0",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ color: T.success, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{"\u2713"}</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.name === "Growth" ? "mailto:hola@meantime.ar" : "/signup"}
                    style={{
                      ...btnPrimary,
                      width: "100%",
                      background: plan.highlight ? T.success : "transparent",
                      color: plan.highlight ? "#fff" : T.accent,
                      border: plan.highlight ? "none" : `1.5px solid ${T.border}`,
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={section}>
        <FadeIn>
          <h2 style={{ ...heading, textAlign: "center", marginBottom: 48, fontSize: "clamp(24px, 4vw, 36px)" }}>
            Preguntas frecuentes
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <FAQ
              q={"\u00bfNecesito instalar algo?"}
              a="No. Meantime funciona 100% desde el navegador. No necesitas descargar ni instalar nada. Tus clientes tampoco: solo necesitan WhatsApp."
            />
            <FAQ
              q={"\u00bfMis clientes necesitan una app?"}
              a="No. Solo necesitan WhatsApp, que ya tienen. Escanean el QR y listo. Todo funciona desde el navegador del celular."
            />
            <FAQ
              q={"\u00bfComo funciona la prediccion ML de espera?"}
              a="Nuestro modelo analiza en tiempo real el clima, dia de la semana, hora, tamanio del grupo y la velocidad de rotacion actual de tus mesas. Con esos datos genera una estimacion precisa del tiempo de espera para cada cliente."
            />
            <FAQ
              q={"\u00bfCuanto cuestan los mensajes de WhatsApp?"}
              a="Los mensajes de WhatsApp estan incluidos en todos los planes. Meantime usa la API oficial de WhatsApp Business. No hay costos extra por mensaje dentro de tu plan."
            />
            <FAQ
              q={"\u00bfFunciona en ingles para turistas?"}
              a="Si. Meantime detecta automaticamente el idioma del celular del cliente y muestra toda la interfaz en espanol o ingles. Perfecto para zonas turisticas."
            />
            <FAQ
              q={"\u00bfCuanto tarda el setup?"}
              a="5 minutos. Creas tu cuenta, configuras tus mesas, personalizas tu QR y empezas a recibir clientes."
            />
            <FAQ
              q={"\u00bfPuedo probarlo gratis?"}
              a="Si. El plan Free incluye 50 clientes por mes, gratis para siempre. Sin tarjeta de credito. Cuando quieras escalar, upgradeas."
            />
            <FAQ
              q={"\u00bfFunciona con mi sistema actual?"}
              a="Si. Meantime no reemplaza tu POS ni tu sistema de reservas. Es una capa extra que gestiona la fila de espera e integra source tracking con OpenTable y walk-ins."
            />
            <FAQ
              q={"\u00bfQue pasa si el cliente se aleja del restaurante?"}
              a="Con GPS walk-around mode, trackeamos la distancia del cliente en tiempo real. Si se aleja demasiado o se acerca su turno, le enviamos un aviso por WhatsApp."
            />
          </div>
        </FadeIn>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section
        style={{
          background: T.accent,
          padding: "96px 24px",
          textAlign: "center",
        }}
      >
        <FadeIn>
          <h2
            style={{
              ...heading,
              color: "#fff",
              marginBottom: 16,
              fontSize: "clamp(28px, 5vw, 44px)",
            }}
          >
            Empeza hoy. Tu primer mes es gratis.
          </h2>
          <p
            style={{
              ...body,
              color: "rgba(255,255,255,0.65)",
              marginBottom: 36,
              fontSize: 18,
            }}
          >
            Unite a los restaurantes que ya usan {APP_NAME} para llenar sus mesas.
          </p>
          <Link
            href="/signup"
            style={{
              ...btnPrimary,
              background: T.success,
              fontSize: 18,
              padding: "16px 40px",
            }}
          >
            Empezar gratis
          </Link>
          <p
            style={{
              ...body,
              color: "rgba(255,255,255,0.45)",
              fontSize: 14,
              marginTop: 20,
            }}
          >
            O contactanos:{" "}
            <a
              href="mailto:hola@meantime.ar"
              style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}
            >
              hola@meantime.ar
            </a>
          </p>
        </FadeIn>
      </section>

      {/* ─── FOOTER ─── */}
      <footer
        style={{
          padding: "32px 24px",
          textAlign: "center",
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <p style={{ ...body, fontSize: 14, color: T.textLight }}>
          &copy; {new Date().getFullYear()} {APP_NAME}. Hecho en Buenos Aires.
        </p>
      </footer>
    </div>
  );
}
