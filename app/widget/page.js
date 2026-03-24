"use client";
import { useState, useEffect } from "react";
import { T, f, RESTAURANT } from "../../lib/tokens";

export default function WaitlistWidget() {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const res = await fetch("/api/waitlist");
      const data = await res.json();
      // API returns array of entries or object with entries
      const entries = Array.isArray(data) ? data : data.entries || [];
      const waiting = entries.filter(
        (e) => e.status === "waiting" || e.status === "notified" || e.status === "extended"
      );
      setCount(waiting.length);
    } catch {
      setCount(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  }, []);

  const estimatedMinutes = count !== null ? count * 12 : null;

  return (
    <div style={{
      minHeight: "100dvh",
      background: T.bgPage,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: f.sans,
    }}>
      <div style={{
        width: "100%",
        maxWidth: "380px",
        background: T.card,
        borderRadius: T.radius,
        border: `1px solid ${T.cardBorder}`,
        boxShadow: T.shadowLg,
        padding: "40px 28px",
        textAlign: "center",
      }}>
        {/* Logo + name */}
        <img
          src="/logo-dark.png"
          alt={RESTAURANT.name}
          style={{ height: "44px", objectFit: "contain", marginBottom: "8px" }}
        />
        <div style={{
          fontSize: "12px", color: T.textLight, fontFamily: f.sans,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          {RESTAURANT.address}
        </div>

        {/* Queue count */}
        <div style={{
          marginTop: "32px", padding: "24px",
          borderRadius: T.radiusSm, background: T.bgWarm,
        }}>
          {loading ? (
            <div style={{ fontSize: "14px", color: T.textMed }}>Cargando...</div>
          ) : count !== null ? (
            <>
              <div style={{
                fontFamily: f.display, fontSize: "48px", fontWeight: "800",
                color: T.accent, lineHeight: 1,
              }}>
                {count}
              </div>
              <div style={{
                fontSize: "14px", color: T.textMed, marginTop: "6px", fontWeight: "600",
              }}>
                {count === 1 ? "persona esperando" : "personas esperando"}
              </div>
              {estimatedMinutes !== null && estimatedMinutes > 0 && (
                <div style={{
                  display: "inline-block", marginTop: "12px",
                  padding: "6px 16px", borderRadius: "20px",
                  background: T.bg, border: `1px solid ${T.border}`,
                  fontSize: "13px", fontWeight: "600", color: T.textMed,
                }}>
                  Espera estimada: ~{estimatedMinutes}min
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: "14px", color: T.textMed }}>
              No se pudo cargar la fila
            </div>
          )}
        </div>

        {/* Join button */}
        <a
          href="/"
          style={{
            display: "block", marginTop: "24px", padding: "17px",
            borderRadius: T.radiusSm, background: T.accent, color: "#fff",
            fontSize: "15px", fontWeight: "700", fontFamily: f.sans,
            textDecoration: "none", textAlign: "center",
            boxShadow: "0 2px 12px rgba(26,26,26,0.15)",
            letterSpacing: "0.01em",
          }}
        >
          Unirme a la fila
        </a>

        {/* Powered by */}
        <div style={{
          marginTop: "32px", fontSize: "11px", color: T.textLight,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Powered by Meantime
        </div>
      </div>
    </div>
  );
}
