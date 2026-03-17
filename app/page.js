"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T, f, RESTAURANT, APP_NAME } from "../lib/tokens";
import MenuOverlay from "../components/MenuOverlay";

// ═══════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════
const Card = ({ children, style }) => (
  <div style={{
    background: T.card, borderRadius: T.radius, border: `1px solid ${T.cardBorder}`,
    boxShadow: T.shadow, padding: "28px", ...style,
  }}>{children}</div>
);

const Btn = ({ children, onClick, variant = "primary", disabled, style }) => {
  const styles = {
    primary: { background: T.accent, color: "#FFFFFF", border: "none" },
    outline: { background: "transparent", color: T.text, border: `1.5px solid ${T.border}` },
    ghost: { background: "transparent", color: T.textMed, border: "none" },
    gold: { background: T.gold, color: "#FFFFFF", border: "none" },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "16px", borderRadius: "14px", fontSize: "15px", fontWeight: "600",
      fontFamily: f.sans, cursor: disabled ? "default" : "pointer", letterSpacing: "0.01em",
      opacity: disabled ? 0.4 : 1, transition: "all 0.2s ease", ...s, ...style,
    }}>{children}</button>
  );
};

const Divider = () => (
  <div style={{ height: "1px", background: T.border, margin: "24px 0" }} />
);

const Header = () => (
  <div style={{ textAlign: "center", marginBottom: "16px" }}>
    <img src="/logo-dark.png" alt={RESTAURANT.name} style={{ height: "40px", objectFit: "contain", marginBottom: "6px" }} />
    <div style={{ fontSize: "12px", color: T.textLight, fontFamily: f.sans, letterSpacing: "0.08em", textTransform: "uppercase" }}>{RESTAURANT.address}</div>
  </div>
);

// ═══════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════
const OT_LINK = RESTAURANT.otLink;

const BAR_SUGGESTIONS = [
  { name: "Le Collins", desc: "Pastis, Lillet Blanc, lima, angostura, tonica", price: 13500 },
  { name: "Castagnoni", desc: "Beefeater, Campari, Carpano Rosso, caju", price: 14000 },
  { name: "Pacifico", desc: "Ron anejo, sandalo rojo, almibar especiado, anana", price: 14500 },
  { name: "Temporada Alta", desc: "Sake, Lillet Blanc, banana, muna muna, melon", price: 14500 },
  { name: "Peni x Chui", desc: "Johnnie Walker Black, miel de manzana, jengibre, limon", price: 14500 },
  { name: "Doble Magic", desc: "Brioche, girgolas, papas paille, salsa de chiles verdes", price: 14000 },
  { name: "Bao Frito", desc: "Melena de leon, tomate, lechuga, alioli de jalapeno", price: 13500 },
  { name: "Empanadas Ahumadas", desc: "Cebolla y queso ahumado con salsa yasgua", price: 7500 },
  { name: "Arancini de Hongos", desc: "Con salsa romesco", price: 9200 },
];

const COUNTRY_CODES = [
  { code: "+54", label: "AR +54" }, { code: "+52", label: "MX +52" }, { code: "+34", label: "ES +34" },
  { code: "+55", label: "BR +55" }, { code: "+1", label: "US +1" }, { code: "+56", label: "CL +56" },
  { code: "+57", label: "CO +57" }, { code: "+598", label: "UY +598" }, { code: "+44", label: "UK +44" },
  { code: "+33", label: "FR +33" }, { code: "+49", label: "DE +49" }, { code: "+39", label: "IT +39" },
];

const ALLERGY_OPTIONS = [
  { id: "nuts", label: "Frutos secos" }, { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Lacteos" }, { id: "egg", label: "Huevo" }, { id: "vegan", label: "Vegano" },
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
  const [returning, setReturning] = useState(false);

  // Restore returning customer
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meantime_customer");
      if (saved) {
        const c = JSON.parse(saved);
        if (c.name) setName(c.name);
        if (c.phone) setPhone(c.phone);
        if (c.countryCode) setCountryCode(c.countryCode);
        if (c.allergies) setAllergies(c.allergies);
        if (c.party) setParty(c.party);
        setReturning(true);
      }
    } catch {}
  }, []);

  const [entry, setEntry] = useState(null);
  const [position, setPosition] = useState(null);
  const [queueCount, setQueueCount] = useState(0);

  const [distance, setDistance] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const pushInterval = useRef(null);

  const [barSuggestion] = useState(() => getRandomSuggestion());
  const [atBar, setAtBar] = useState(false);

  // Push activity + distance to server every 15s
  const pushActivity = useCallback(async (activity, dist) => {
    if (!entry) return;
    const body = { id: entry.id, activity };
    if (dist !== null) body.distance_m = dist;
    try {
      await fetch("/api/waitlist", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {}
  }, [entry]);

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
      try { localStorage.setItem("meantime_customer", JSON.stringify({ name: name.trim(), phone: phone.trim(), countryCode, allergies, party })); } catch {}
      setEntry(data);
      setView("waiting");
    } catch { alert("Error de conexion"); }
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
    setWatchId(id);
    setView("walkAround");
    // Push activity every 15s
    pushActivity("paseando", distance);
    pushInterval.current = setInterval(() => {
      pushActivity("paseando", distance);
    }, 15000);
  };

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    if (pushInterval.current) clearInterval(pushInterval.current);
    pushInterval.current = null;
    pushActivity("esperando", null);
    setView("waiting");
  };

  // Push "en_barra" activity when user goes to bar
  useEffect(() => {
    if (atBar && entry) {
      pushActivity("en_barra", 0);
      const iv = setInterval(() => pushActivity("en_barra", 0), 15000);
      return () => clearInterval(iv);
    }
  }, [atBar, entry, pushActivity]);

  const handleCancel = async () => {
    if (!entry || !confirm("Seguro que queres salir de la fila?")) return;
    await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "cancelled" }) });
    setEntry(null); setView("welcome");
  };

  const inputStyle = {
    width: "100%", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${T.border}`,
    fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box",
    background: T.bg, color: T.text, transition: "border 0.2s",
  };

  const page = { minHeight: "100dvh", background: T.bgPage, padding: "56px 20px 40px", fontFamily: f.sans };

  // ═══════════════════════════════════════════════════
  // WELCOME
  // ═══════════════════════════════════════════════════
  if (view === "welcome") return (
    <div style={page}>
      <Header />
      <Card style={{ marginTop: "32px", textAlign: "center" }}>
        <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text, lineHeight: 1.25 }}>
          {returning ? `Hola de nuevo, ${name.split(" ")[0]}` : "Tu mesa se esta\npreparando"}
        </div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "10px", lineHeight: 1.6 }}>
          {returning ? "Un toque y estas en la fila." : "Anotate y te avisamos al celular cuando este lista."}
        </div>
      </Card>

      <div style={{
        marginTop: "16px", padding: "18px 20px", borderRadius: T.radius,
        background: T.goldLight, border: `1px solid ${T.gold}30`, textAlign: "center",
      }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: T.gold, letterSpacing: "0.04em", textTransform: "uppercase" }}>2x1 en barra</div>
        <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Cerveza tirada, copa de vino o vermut — al registrarte.</div>
      </div>

      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {returning ? (
          <>
            <Btn onClick={() => setView("form")}>Quiero mi mesa — {party} pers.</Btn>
            <Btn variant="ghost" onClick={() => { setReturning(false); setView("form"); }} style={{ fontSize: "13px" }}>Cambiar datos</Btn>
          </>
        ) : (
          <Btn onClick={() => setView("form")}>Quiero mi mesa</Btn>
        )}
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver el menu</Btn>
      </div>

      <div style={{ textAlign: "center", marginTop: "40px", fontSize: "11px", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>
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
      <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text, marginBottom: "24px" }}>Reserva tu lugar</div>
      <Card>
        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />

        <div style={{ height: "20px" }} />

        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cuantos son</label>
        <div style={{ display: "flex", gap: "6px" }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setParty(n)} style={{
              flex: 1, padding: "14px 0", borderRadius: "12px", fontSize: "16px", fontWeight: "600",
              background: party === n ? T.accent : "transparent", color: party === n ? "#fff" : T.text,
              border: party === n ? "none" : `1.5px solid ${T.border}`, cursor: "pointer",
              transition: "all 0.2s", fontFamily: f.sans,
            }}>{n}{n === 6 ? "+" : ""}</button>
          ))}
        </div>

        <div style={{ height: "20px" }} />

        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          WhatsApp <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: "0" }}>(para avisarte)</span>
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{
            padding: "14px 8px", borderRadius: "12px", border: `1.5px solid ${T.border}`,
            fontSize: "14px", fontFamily: f.sans, background: T.bg, outline: "none", width: "105px",
            color: T.text,
          }}>
            {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 2345 6789"
            type="tel" inputMode="numeric" style={{ ...inputStyle, width: "auto", flex: 1 }} />
        </div>

        <div style={{ height: "20px" }} />

        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Alergias o restricciones</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {ALLERGY_OPTIONS.map(a => {
            const sel = allergies.includes(a.id);
            return (
              <button key={a.id} onClick={() => setAllergies(sel ? allergies.filter(x=>x!==a.id) : [...allergies, a.id])} style={{
                padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                background: sel ? T.accent : "transparent", color: sel ? "#fff" : T.textMed,
                border: sel ? "none" : `1.5px solid ${T.border}`,
                cursor: "pointer", fontFamily: f.sans, transition: "all 0.2s",
              }}>{a.label}</button>
            );
          })}
        </div>
      </Card>

      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn onClick={handleJoin} disabled={!name.trim() || submitting}>{submitting ? "Anotando..." : "Confirmar"}</Btn>
        <Btn variant="ghost" onClick={() => setView("welcome")}>Volver</Btn>
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
        <Card style={{ marginTop: "28px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>modo paseo</div>
          <div style={{ fontFamily: f.display, fontSize: "22px", fontWeight: "700", color: T.text }}>Camina por el barrio tranquilo</div>
          <div style={{ fontSize: "14px", color: T.textMed, marginTop: "6px" }}>Te avisamos cuando tu mesa este lista.</div>

          <div style={{
            marginTop: "24px", padding: "24px", borderRadius: "14px",
            background: isNear ? T.successLight : T.warnLight,
          }}>
            <div style={{ fontFamily: f.display, fontSize: "42px", fontWeight: "700", color: isNear ? T.success : T.warn }}>
              {distance !== null ? `${distance}m` : "..."}
            </div>
            <div style={{ fontSize: "13px", color: isNear ? T.success : T.warn, marginTop: "4px", fontWeight: "600" }}>
              {isNear ? "Estas cerca" : `~${RESTAURANT.walkAroundMinutes} min caminando`}
            </div>
          </div>

          {position && (
            <div style={{ marginTop: "20px", fontSize: "14px", color: T.textMed }}>
              Posicion <strong style={{ color: T.accent, fontFamily: f.display, fontSize: "20px" }}>#{position}</strong> de {queueCount}
            </div>
          )}
        </Card>
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Btn onClick={stopTracking}>Volver a la espera</Btn>
          <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menu</Btn>
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
      <Card style={{ marginTop: "28px", textAlign: "center", maxWidth: "360px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: T.success, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>mesa lista</div>
        <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text }}>Tu mesa te espera</div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "10px", lineHeight: 1.5 }}>Acercate al hostess. Buen provecho.</div>
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

      <Card style={{ marginTop: "28px", textAlign: "center" }}>
        {isNotified ? (
          <>
            <div style={{ fontSize: "12px", fontWeight: "700", color: T.success, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>tu turno</div>
            <div style={{ fontFamily: f.display, fontSize: "24px", fontWeight: "700", color: T.text }}>Tu mesa esta lista</div>
            <div style={{ fontSize: "14px", color: T.textMed, marginTop: "10px" }}>Acercate al hostess para que te ubique.</div>
          </>
        ) : (
          <>
            <div style={{
              width: "110px", height: "110px", borderRadius: "50%", margin: "0 auto 20px",
              border: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center",
              background: T.accentSoft,
            }}>
              <div>
                <div style={{ fontFamily: f.display, fontSize: "38px", fontWeight: "700", color: T.accent }}>{position || "--"}</div>
                <div style={{ fontSize: "11px", color: T.textLight, fontFamily: f.sans, letterSpacing: "0.04em" }}>en la fila</div>
              </div>
            </div>
            <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700", color: T.text }}>{name}, estas en la fila</div>
            <div style={{ fontSize: "13px", color: T.textLight, marginTop: "8px" }}>
              {party} {party === 1 ? "persona" : "personas"} · {queueCount} en espera
            </div>
          </>
        )}
      </Card>

      {/* 2x1 bar upsell */}
      {!atBar && !isNotified && (
        <Card style={{ marginTop: "14px", background: T.goldLight, border: `1px solid ${T.gold}25` }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: T.gold, letterSpacing: "0.04em", textTransform: "uppercase" }}>2x1 en barra</div>
          <div style={{ fontSize: "13px", color: T.textMed, marginTop: "6px", lineHeight: 1.5 }}>Cerveza tirada, copa de vino o vermut — mientras te preparamos la mesa.</div>
          <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
            {["Cerveza tirada", "Copa de vino", "Vermut"].map(item => (
              <div key={item} style={{
                flex: 1, padding: "14px 6px", borderRadius: "12px", background: "#fff",
                textAlign: "center", border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: T.text }}>{item}</div>
                <div style={{ fontSize: "11px", color: T.gold, marginTop: "4px", fontWeight: "700" }}>2x1</div>
              </div>
            ))}
          </div>
          <button onClick={() => setAtBar(true)} style={{
            marginTop: "14px", width: "100%", padding: "14px", borderRadius: "12px",
            background: T.accent, color: "#fff", border: "none", fontSize: "14px",
            fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
          }}>Voy a la barra</button>
        </Card>
      )}
      {atBar && (
        <Card style={{ marginTop: "14px", background: T.goldLight, border: `1px solid ${T.gold}25`, textAlign: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: T.gold }}>Pedi tu 2x1 en la barra</div>
          <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Mostra esta pantalla</div>
        </Card>
      )}

      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menu</Btn>
        {!isNotified && <Btn variant="outline" onClick={startTracking}>Pasear por el barrio</Btn>}
      </div>

      {/* OpenTable */}
      <div style={{
        marginTop: "24px", padding: "24px", borderRadius: T.radius, background: T.accentSoft,
        textAlign: "center", border: `1px solid ${T.cardBorder}`,
      }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: T.text }}>No queres esperar la proxima?</div>
        <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Reserva tu mesa con anticipacion.</div>
        <a href={OT_LINK} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", marginTop: "14px", padding: "12px 32px", borderRadius: "12px",
          background: T.accent, color: "#fff", fontSize: "14px", fontWeight: "600",
          textDecoration: "none", fontFamily: f.sans,
        }}>Reservar en OpenTable</a>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Btn variant="ghost" onClick={handleCancel} style={{ color: T.danger, fontSize: "13px" }}>Salir de la fila</Btn>
      </div>

      <div style={{ textAlign: "center", marginTop: "28px", fontSize: "11px", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Powered by {APP_NAME}
      </div>

      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );
}
