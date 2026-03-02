"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, f, RESTAURANT, APP_NAME } from "../lib/tokens";
import MenuOverlay from "../components/MenuOverlay";

// ═══════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════
const Card = ({ children, style }) => (
  <div style={{ background: T.card, borderRadius: T.radius, boxShadow: T.shadow, padding: "24px", ...style }}>{children}</div>
);

const Btn = ({ children, onClick, variant = "primary", disabled, style }) => {
  const styles = {
    primary: { background: T.accent, color: "#fff", border: "none" },
    outline: { background: "transparent", color: T.accent, border: `1.5px solid ${T.accent}` },
    ghost: { background: "transparent", color: T.textMed, border: "none" },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "16px", borderRadius: "14px", fontSize: "15px", fontWeight: "600",
      fontFamily: f.sans, cursor: disabled ? "default" : "pointer", letterSpacing: "-0.01em",
      opacity: disabled ? 0.5 : 1, transition: "all 0.2s ease", ...s, ...style,
    }}>{children}</button>
  );
};

const Header = () => (
  <div style={{ textAlign: "center", marginBottom: "12px" }}>
    <img src="/logo-dark.png" alt={RESTAURANT.name} style={{ height: "44px", objectFit: "contain", marginBottom: "6px" }} />
    <div style={{ fontSize: "13px", color: T.textLight, fontFamily: f.sans, letterSpacing: "0.02em" }}>{RESTAURANT.address}</div>
  </div>
);

// ═══════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════
const OT_LINK = RESTAURANT.otLink;

const BAR_SUGGESTIONS = [
  { emoji: "🍹", name: "Le Collins", desc: "Pastis, Lillet Blanc, lima, angostura, tónica", price: 13500 },
  { emoji: "🥃", name: "Castagnoni", desc: "Beefeater, Campari, Carpano Rosso, cajú", price: 14000 },
  { emoji: "🌊", name: "Pacífico", desc: "Ron añejo, sándalo rojo, almíbar especiado, ananá", price: 14500 },
  { emoji: "🥂", name: "Temporada Alta", desc: "Sake, Lillet Blanc, banana, muña muña, melón", price: 14500 },
  { emoji: "🥃", name: "Peni x Chuí", desc: "Johnnie Walker Black, miel de manzana, jengibre, limón", price: 14500 },
  { emoji: "🍔", name: "Doble Magic", desc: "Brioche, gírgolas, papas paille, salsa de chiles verdes", price: 14000 },
  { emoji: "🥟", name: "Bao Frito", desc: "Melena de león, tomate, lechuga, alioli de jalapeño", price: 13500 },
  { emoji: "🧀", name: "Empanadas Ahumadas", desc: "Cebolla y queso ahumado con salsa yasgua", price: 7500 },
  { emoji: "🍄", name: "Arancini de Hongos", desc: "Con salsa romesco", price: 9200 },
];

const COUNTRY_CODES = [
  { code: "+54", flag: "🇦🇷" }, { code: "+52", flag: "🇲🇽" }, { code: "+34", flag: "🇪🇸" },
  { code: "+55", flag: "🇧🇷" }, { code: "+1", flag: "🇺🇸" }, { code: "+56", flag: "🇨🇱" },
  { code: "+57", flag: "🇨🇴" }, { code: "+598", flag: "🇺🇾" }, { code: "+44", flag: "🇬🇧" },
  { code: "+33", flag: "🇫🇷" }, { code: "+49", flag: "🇩🇪" }, { code: "+39", flag: "🇮🇹" },
];

const ALLERGY_OPTIONS = [
  { id: "nuts", label: "🥜 Frutos secos" }, { id: "gluten", label: "🌾 Gluten" },
  { id: "dairy", label: "🥛 Lácteos" }, { id: "egg", label: "🥚 Huevo" }, { id: "vegan", label: "🌱 Vegano" },
];

function getRandomSuggestion() { return BAR_SUGGESTIONS[Math.floor(Math.random() * BAR_SUGGESTIONS.length)]; }

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
export default function MeantimeCustomer() {
  const [view, setView] = useState("welcome");
  const [showMenu, setShowMenu] = useState(false);

  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+54");
  const [allergies, setAllergies] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [entry, setEntry] = useState(null);
  const [position, setPosition] = useState(null);
  const [queueCount, setQueueCount] = useState(0);

  const [distance, setDistance] = useState(null);
  const [watchId, setWatchId] = useState(null);

  const [barSuggestion] = useState(() => getRandomSuggestion());
  const [atBar, setAtBar] = useState(false);

  // ── Actions ──
  const handleJoin = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name.trim(), party_size: party,
          allergies, phone: phone.trim() ? `${countryCode}${phone.trim().replace(/^0+/,"")}` : null, source: "qr",
        }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setSubmitting(false); return; }
      setEntry(data);
      setView("waiting");
    } catch { alert("Error de conexión"); }
    setSubmitting(false);
  };

  useEffect(() => {
    if (!entry || !supabase) return;
    const fetchPosition = async () => {
      const { data } = await supabase.from("waitlist").select("id")
        .in("status", ["waiting", "notified", "extended"]).order("joined_at", { ascending: true });
      if (data) { setPosition(data.findIndex(r => r.id === entry.id) + 1); setQueueCount(data.length); }
    };
    fetchPosition();
    const channel = supabase.channel("waitlist-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, (payload) => {
        if (payload.new?.id === entry.id) setEntry(payload.new);
        fetchPosition();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entry]);

  const startTracking = () => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setDistance(Math.round(getDistance(pos.coords.latitude, pos.coords.longitude, RESTAURANT.lat, RESTAURANT.lng))),
      () => {}, { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setWatchId(id); setView("walkAround");
  };

  const stopTracking = () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); setWatchId(null); setView("waiting"); };

  const handleCancel = async () => {
    if (!entry || !confirm("¿Seguro que querés salir de la fila?")) return;
    await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "cancelled" }) });
    setEntry(null); setView("welcome");
  };

  const page = { minHeight: "100dvh", background: T.bgPage, padding: "56px 20px 40px", fontFamily: f.sans };

  // ═══════════════════════════════════════════════════
  // WELCOME
  // ═══════════════════════════════════════════════════
  if (view === "welcome") return (
    <div style={page}>
      <Header />
      <Card style={{ marginTop: "28px", textAlign: "center" }}>
        <div style={{ fontFamily: f.display, fontSize: "22px", color: T.text, lineHeight: 1.3 }}>
          Estamos preparando algo<br/>especial para vos
        </div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "8px", lineHeight: 1.5 }}>
          Anotate en la fila y te avisamos al celular cuando tu mesa esté lista.
        </div>
      </Card>
      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn onClick={() => setView("form")}>Quiero mi mesa</Btn>
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver el menú</Btn>
      </div>
      <div style={{ textAlign: "center", marginTop: "32px", fontSize: "11px", color: T.textLight, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Powered by {APP_NAME}
      </div>
      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );

  // ═══════════════════════════════════════════════════
  // FORM
  // ═══════════════════════════════════════════════════
  if (view === "form") return (
    <div style={page}>
      <div style={{ fontFamily: f.display, fontSize: "24px", color: T.text, marginBottom: "24px" }}>Reservá tu lugar</div>
      <Card>
        <label style={{ fontSize: "13px", fontWeight: "600", color: T.text, display: "block", marginBottom: "6px", letterSpacing: "0.02em" }}>Tu nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
          style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${T.border}`,
            fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box", marginBottom: "20px",
            transition: "border 0.2s", }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />

        <label style={{ fontSize: "13px", fontWeight: "600", color: T.text, display: "block", marginBottom: "6px", letterSpacing: "0.02em" }}>¿Cuántos son?</label>
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setParty(n)} style={{
              flex: 1, padding: "14px 0", borderRadius: "12px", fontSize: "16px", fontWeight: "600",
              background: party === n ? T.accent : "transparent", color: party === n ? "#fff" : T.text,
              border: party === n ? "none" : `1.5px solid ${T.border}`, cursor: "pointer", transition: "all 0.2s",
            }}>{n}{n === 6 ? "+" : ""}</button>
          ))}
        </div>

        <label style={{ fontSize: "13px", fontWeight: "600", color: T.text, display: "block", marginBottom: "6px", letterSpacing: "0.02em" }}>
          WhatsApp <span style={{ fontWeight: "400", color: T.textLight }}>(te avisamos cuando la mesa esté lista)</span>
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{
            padding: "14px 8px", borderRadius: "12px", border: `1.5px solid ${T.border}`,
            fontSize: "15px", fontFamily: f.sans, background: T.bg, outline: "none", width: "100px",
          }}>
            {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 2345 6789"
            type="tel" inputMode="numeric" style={{
              flex: 1, padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${T.border}`,
              fontSize: "16px", fontFamily: f.sans, outline: "none",
            }} />
        </div>

        <label style={{ fontSize: "13px", fontWeight: "600", color: T.text, display: "block", marginBottom: "8px", letterSpacing: "0.02em" }}>Alergias o restricciones</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {ALLERGY_OPTIONS.map(a => {
            const sel = allergies.includes(a.id);
            return (
              <button key={a.id} onClick={() => setAllergies(sel ? allergies.filter(x=>x!==a.id) : [...allergies, a.id])} style={{
                padding: "8px 14px", borderRadius: "20px", fontSize: "13px",
                background: sel ? T.accentLight : "transparent", color: sel ? T.accent : T.textMed,
                border: sel ? `1.5px solid ${T.accent}` : `1.5px solid ${T.border}`,
                cursor: "pointer", fontFamily: f.sans, transition: "all 0.2s",
              }}>{a.label}</button>
            );
          })}
        </div>
      </Card>
      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn onClick={handleJoin} disabled={!name.trim() || submitting}>{submitting ? "Anotando..." : "Confirmar"}</Btn>
        <Btn variant="ghost" onClick={() => setView("welcome")}>← Volver</Btn>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // WALK AROUND
  // ═══════════════════════════════════════════════════
  if (view === "walkAround") {
    const isNear = distance !== null && distance <= RESTAURANT.walkAroundRadius;
    return (
      <div style={page}>
        <Header />
        <Card style={{ marginTop: "24px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🚶</div>
          <div style={{ fontFamily: f.display, fontSize: "20px", color: T.text }}>Modo paseo</div>
          <div style={{ fontSize: "14px", color: T.textMed, marginTop: "6px" }}>
            Caminá por el barrio tranquilo. Te avisamos.
          </div>
          <div style={{ marginTop: "20px", padding: "20px", borderRadius: "14px", background: isNear ? T.accentLight : "#FFF8EE" }}>
            <div style={{ fontFamily: f.display, fontSize: "36px", color: isNear ? T.accent : T.warn }}>
              {distance !== null ? `${distance}m` : "..."}
            </div>
            <div style={{ fontSize: "13px", color: isNear ? T.accent : T.warn, marginTop: "4px" }}>
              {isNear ? "Estás cerca de Chuí" : `~${RESTAURANT.walkAroundMinutes} min caminando`}
            </div>
          </div>
          {position && (
            <div style={{ marginTop: "16px", fontSize: "14px", color: T.textMed }}>
              Posición: <strong style={{ color: T.accent, fontFamily: f.display, fontSize: "18px" }}>#{position}</strong> de {queueCount}
            </div>
          )}
        </Card>
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Btn onClick={stopTracking}>Volver a la espera</Btn>
          <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menú</Btn>
        </div>
        {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // SEATED
  // ═══════════════════════════════════════════════════
  if (entry?.status === "seated") return (
    <div style={{ ...page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <Header />
      <Card style={{ marginTop: "24px", textAlign: "center", maxWidth: "360px" }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🌿</div>
        <div style={{ fontFamily: f.display, fontSize: "24px", color: T.text }}>Tu mesa te espera</div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "8px" }}>Acercate al hostess. Buen provecho.</div>
      </Card>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // WAITING
  // ═══════════════════════════════════════════════════
  const isNotified = entry?.status === "notified";

  return (
    <div style={page}>
      <Header />

      <Card style={{ marginTop: "24px", textAlign: "center" }}>
        {isNotified ? (
          <>
            <div style={{ fontFamily: f.display, fontSize: "22px", color: T.accent }}>¡Es tu turno!</div>
            <div style={{ fontSize: "14px", color: T.textMed, marginTop: "8px" }}>Acercate al hostess para que te ubique.</div>
          </>
        ) : (
          <>
            <div style={{
              width: "110px", height: "110px", borderRadius: "50%", margin: "0 auto 16px",
              border: `3px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center",
              background: T.accentSoft,
            }}>
              <div>
                <div style={{ fontFamily: f.display, fontSize: "36px", color: T.accent }}>{position || "—"}</div>
                <div style={{ fontSize: "11px", color: T.textLight, fontFamily: f.sans }}>en la fila</div>
              </div>
            </div>
            <div style={{ fontFamily: f.display, fontSize: "18px", color: T.text }}>{name}, estás en la fila</div>
            <div style={{ fontSize: "13px", color: T.textLight, marginTop: "6px" }}>
              {party} {party === 1 ? "persona" : "personas"} · {queueCount} en espera
            </div>
          </>
        )}
      </Card>

      {/* Bar upsell */}
      {!atBar && !isNotified && (
        <Card style={{ marginTop: "14px", background: "#FFFBF5", border: `1px solid #F0E6D4` }}>
          <div style={{ fontSize: "15px", fontWeight: "600", color: T.text }}>¿Esperás en la barra?</div>
          <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Pedite algo mientras te preparamos la mesa.</div>
          <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "#fff", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "28px" }}>{barSuggestion.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: T.text }}>{barSuggestion.name}</div>
              <div style={{ fontSize: "12px", color: T.textLight }}>{barSuggestion.desc}</div>
            </div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: T.accent }}>${barSuggestion.price.toLocaleString()}</div>
          </div>
          <button onClick={() => setAtBar(true)} style={{
            marginTop: "12px", width: "100%", padding: "12px", borderRadius: "12px",
            background: T.warn, color: "#fff", border: "none", fontSize: "14px",
            fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
          }}>Sí, voy a la barra</button>
        </Card>
      )}
      {atBar && (
        <Card style={{ marginTop: "14px", background: "#FFFBF5", border: `1px solid #F0E6D4`, textAlign: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "600", color: T.warn }}>🍸 Estás en la barra — te avisamos desde ahí</div>
        </Card>
      )}

      <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menú</Btn>
        {!isNotified && <Btn variant="outline" onClick={startTracking}>🚶 Pasear por el barrio</Btn>}
      </div>

      {/* OpenTable education */}
      <div style={{ marginTop: "20px", padding: "20px", borderRadius: T.radius, background: T.accentSoft, textAlign: "center", border: `1px solid ${T.accentLight}` }}>
        <div style={{ fontSize: "14px", fontWeight: "600", color: T.text }}>¿No querés esperar la próxima?</div>
        <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Reservá tu mesa con anticipación.</div>
        <a href={OT_LINK} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", marginTop: "12px", padding: "10px 28px", borderRadius: "12px",
          background: T.accent, color: "#fff", fontSize: "14px", fontWeight: "600",
          textDecoration: "none", fontFamily: f.sans, letterSpacing: "-0.01em",
        }}>Reservar en OpenTable →</a>
      </div>

      <div style={{ marginTop: "14px" }}>
        <Btn variant="ghost" onClick={handleCancel} style={{ color: T.danger, fontSize: "13px" }}>Salir de la fila</Btn>
      </div>

      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: T.textLight, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Powered by {APP_NAME}
      </div>

      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );
}
