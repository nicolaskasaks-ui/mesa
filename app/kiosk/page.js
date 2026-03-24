"use client";
import { useState, useEffect } from "react";
import { T, f, RESTAURANT } from "../../lib/tokens";

// ── KIOSK PAGE — Full-screen self-check-in for iPad ──

const KioskBtn = ({ children, onClick, disabled, variant = "primary", style }) => {
  const s = {
    primary: { background: T.accent, color: "#fff", border: "none", boxShadow: "0 4px 20px rgba(26,26,26,0.18)" },
    outline: { background: "transparent", color: T.text, border: `2px solid ${T.border}` },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "24px", borderRadius: T.radiusSm || "14px", fontSize: "20px", fontWeight: "700",
      fontFamily: f.sans, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1, letterSpacing: "0.01em", ...s, ...style,
    }}>{children}</button>
  );
};

export default function KioskPage() {
  const [view, setView] = useState("home"); // home | form | confirmed
  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState(null);

  // Auto-reset to home after confirmation
  useEffect(() => {
    if (view !== "confirmed") return;
    const timer = setTimeout(() => {
      setView("home");
      setName("");
      setParty(2);
      setPosition(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [view]);

  const handleJoin = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name.trim(),
          party_size: party,
          source: "kiosk",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSubmitting(false);
        return;
      }
      // Calculate position
      setPosition(data.position || 1);
      setView("confirmed");
    } catch {}
    setSubmitting(false);
  };

  const pageStyle = {
    minHeight: "100dvh",
    background: T.bgPage,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: f.sans,
    padding: "40px",
    overflow: "hidden",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  const cardStyle = {
    background: T.card,
    borderRadius: T.radius,
    border: `1px solid ${T.cardBorder}`,
    boxShadow: T.shadow,
    padding: "48px 40px",
    width: "100%",
    maxWidth: "480px",
    textAlign: "center",
  };

  const inputStyle = {
    width: "100%",
    padding: "20px 24px",
    borderRadius: "14px",
    border: `2px solid ${T.border}`,
    fontSize: "22px",
    fontFamily: f.sans,
    outline: "none",
    boxSizing: "border-box",
    background: T.bg,
    color: T.text,
    textAlign: "center",
  };

  const labelStyle = {
    fontSize: "14px",
    fontWeight: "700",
    color: T.textLight,
    display: "block",
    marginBottom: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  // ── HOME ──
  if (view === "home") return (
    <div style={pageStyle}>
      <img src={RESTAURANT.logo} alt={RESTAURANT.name} style={{ height: "56px", objectFit: "contain", marginBottom: "12px" }} />
      <div style={{ fontSize: "14px", color: T.textLight, fontFamily: f.sans, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "48px" }}>
        {RESTAURANT.address}
      </div>
      <div style={cardStyle}>
        <div style={{ fontFamily: f.display, fontSize: "34px", fontWeight: "700", color: T.text, lineHeight: 1.2 }}>
          Unirme a la fila
        </div>
        <div style={{ fontSize: "16px", color: T.textMed, marginTop: "12px", lineHeight: 1.6 }}>
          Toca para anotarte y te avisamos cuando tu mesa este lista.
        </div>
        <div style={{ marginTop: "36px" }}>
          <KioskBtn onClick={() => setView("form")}>Unirme a la fila</KioskBtn>
        </div>
      </div>
    </div>
  );

  // ── FORM ──
  if (view === "form") return (
    <div style={pageStyle}>
      <img src={RESTAURANT.logo} alt={RESTAURANT.name} style={{ height: "48px", objectFit: "contain", marginBottom: "40px" }} />
      <div style={cardStyle}>
        <div style={{ fontFamily: f.display, fontSize: "28px", fontWeight: "700", color: T.text, marginBottom: "32px" }}>
          Tus datos
        </div>

        <label style={labelStyle}>Nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          autoFocus
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border}
        />

        <div style={{ height: "28px" }} />

        <label style={labelStyle}>Cuantos son</label>
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => setParty(n)} style={{
              flex: 1, padding: "20px 0", borderRadius: "14px", fontSize: "22px", fontWeight: "700",
              background: party === n ? T.accent : "transparent", color: party === n ? "#fff" : T.text,
              border: party === n ? "none" : `2px solid ${T.border}`, cursor: "pointer", fontFamily: f.sans,
            }}>{n}{n === 6 ? "+" : ""}</button>
          ))}
        </div>

        <div style={{ marginTop: "36px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <KioskBtn onClick={handleJoin} disabled={!name.trim() || submitting}>
            {submitting ? "Anotando..." : "Confirmar"}
          </KioskBtn>
          <KioskBtn variant="outline" onClick={() => { setView("home"); setName(""); setParty(2); }}>
            Volver
          </KioskBtn>
        </div>
      </div>
    </div>
  );

  // ── CONFIRMED ──
  return (
    <div style={pageStyle}>
      <img src={RESTAURANT.logo} alt={RESTAURANT.name} style={{ height: "48px", objectFit: "contain", marginBottom: "40px" }} />
      <div style={{ ...cardStyle, background: T.successLight, border: `1px solid ${T.success}30` }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: T.success, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
          Estas en la fila
        </div>
        <div style={{ fontFamily: f.display, fontSize: "80px", fontWeight: "800", color: T.success, lineHeight: 1 }}>
          #{position || "--"}
        </div>
        <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text, marginTop: "20px" }}>
          {name}, te avisamos cuando sea tu turno
        </div>
        <div style={{ fontSize: "16px", color: T.textMed, marginTop: "12px" }}>
          Te llamamos por nombre cuando tu mesa este lista.
        </div>
        <div style={{ marginTop: "32px", padding: "12px 24px", borderRadius: "10px", background: `${T.success}15`, display: "inline-block" }}>
          <div style={{ fontSize: "13px", color: T.success, fontWeight: "600" }}>
            Esta pantalla se reinicia automaticamente
          </div>
        </div>
      </div>
    </div>
  );
}
