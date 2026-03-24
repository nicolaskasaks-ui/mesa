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
          maxHeight: open ? 200 : 0,
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
// Page
// ───────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
            Fila virtual para restaurantes
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
            mesa esta lista. Sin app, sin fricciones.
          </p>
        </FadeIn>

        <FadeIn delay={0.32}>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={btnPrimary}>
              Empezar gratis
            </Link>
            <a href="#como-funciona" style={btnSecondary}>
              Ver demo
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

      {/* ─── PROBLEM ─── */}
      <section style={{ ...sectionAlt }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
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
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" style={section}>
        <FadeIn>
          <h2 style={{ ...heading, textAlign: "center", marginBottom: 12, fontSize: "clamp(24px, 4vw, 36px)" }}>
            Como funciona
          </h2>
          <p style={{ ...body, textAlign: "center", marginBottom: 56 }}>
            Tres pasos. Cero friccion.
          </p>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 40,
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
              desc: "Mientras espera: ve el menu, pide un 2x1 en barra, pasea por el barrio.",
            },
            {
              step: "03",
              title: "WhatsApp automatico",
              desc: "Le avisamos cuando su mesa esta lista. Sin app, sin descarga.",
            },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div>
                <span
                  style={{
                    fontFamily: f.display,
                    fontWeight: 700,
                    fontSize: 48,
                    color: T.accentLight,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {s.step}
                </span>
                <h3 style={{ ...subheading, fontSize: 20, marginBottom: 10 }}>{s.title}</h3>
                <p style={body}>{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={sectionAlt}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ ...heading, textAlign: "center", marginBottom: 56, fontSize: "clamp(24px, 4vw, 36px)" }}>
              Todo lo que necesitas
            </h2>
          </FadeIn>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {[
              { icon: "\ud83d\udccd", title: "GPS tracking en vivo", desc: "Sabe donde esta cada cliente y avisale cuando se acerca su turno." },
              { icon: "\ud83c\udf7a", title: "2x1 en barra", desc: "Monetiza la espera. Los clientes consumen mientras esperan su mesa." },
              { icon: "\ud83d\udcbb", title: "Dashboard para hostess", desc: "Vista en tiempo real de la fila, tiempos de espera y mesas disponibles." },
              { icon: "\ud83d\udcca", title: "Analytics en tiempo real", desc: "Metricas de rotacion, tiempo de espera, y tasa de abandono." },
              { icon: "\ud83d\udc65", title: "CRM de clientes", desc: "Conoce a tus clientes frecuentes. Nombre, visitas, preferencias." },
              { icon: "\ud83c\udf10", title: "Multi-idioma ES/EN", desc: "Perfecto para turistas. La fila virtual funciona en espanol e ingles." },
            ].map((feat, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.cardBorder}`,
                    borderRadius: T.radius,
                    padding: 28,
                  }}
                >
                  <span style={{ fontSize: 28, display: "block", marginBottom: 12 }}>{feat.icon}</span>
                  <h3 style={{ ...subheading, fontSize: 17, marginBottom: 8 }}>{feat.title}</h3>
                  <p style={{ ...body, fontSize: 15 }}>{feat.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
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
              Usado por restaurantes en Villa Crespo
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
                features: ["50 clientes/mes", "1 usuario", "WhatsApp basico", "QR personalizado"],
                cta: "Empezar gratis",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$29",
                period: "/mes",
                features: ["Clientes ilimitados", "Analytics avanzados", "CRM de clientes", "Referrals & loyalty", "Soporte prioritario"],
                cta: "Empezar gratis",
                highlight: true,
              },
              {
                name: "Growth",
                price: "$59",
                period: "/mes",
                features: ["Multi-ubicacion", "White-label", "API access", "Kiosk mode", "Onboarding dedicado"],
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
                          padding: "6px 0",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ color: T.success, fontSize: 16, fontWeight: 700 }}>{"\u2713"}</span>
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
              q="\u00bfNecesito instalar algo?"
              a="No. Meantime funciona 100% desde el navegador. No necesitas descargar ni instalar nada."
            />
            <FAQ
              q="\u00bfMis clientes necesitan una app?"
              a="No. Solo necesitan WhatsApp, que ya tienen. Escanean el QR y listo."
            />
            <FAQ
              q="\u00bfCuanto tarda el setup?"
              a="5 minutos. Creas tu cuenta, personalizas tu QR y empezas a recibir clientes."
            />
            <FAQ
              q="\u00bfPuedo probarlo gratis?"
              a="Si. El plan Free incluye 50 clientes por mes, gratis para siempre. Sin tarjeta de credito."
            />
            <FAQ
              q="\u00bfFunciona con mi sistema actual?"
              a="Si. Meantime no reemplaza tu POS ni tu sistema de reservas. Es una capa extra que gestiona la fila de espera."
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
