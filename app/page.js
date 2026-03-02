"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, f, RESTAURANT } from "../lib/tokens";
import MenuOverlay from "../components/MenuOverlay";

// ═══════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════
const Card = ({ children, style }) => (
  <div style={{ background: T.card, borderRadius: T.radius, boxShadow: T.shadow, padding: "20px", ...style }}>{children}</div>
);
const Btn = ({ children, onClick, variant = "primary", disabled, style }) => {
  const bg = variant === "primary" ? T.accent : variant === "outline" ? "transparent" : T.bgPage;
  const color = variant === "primary" ? "#fff" : variant === "outline" ? T.accent : T.text;
  const border = variant === "outline" ? `2px solid ${T.accent}` : "none";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "15px", borderRadius: "12px", fontSize: "16px", fontWeight: "600",
      fontFamily: f.sans, background: bg, color, border, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.5 : 1, transition: "all 0.15s", ...style,
    }}>{children}</button>
  );
};
const Logo = ({ light }) => (
  <div style={{ textAlign: "center", marginBottom: "8px" }}>
    <img src={light ? "/logo-light.png" : "/logo-dark.png"} alt="Chuí" style={{ height: "40px", objectFit: "contain", marginBottom: "4px" }} />
    <div style={{ fontSize: "13px", color: light ? "#aaa" : T.textLight }}>{RESTAURANT.address}</div>
  </div>
);

// Phone country codes
const COUNTRY_CODES = [
  { code: "+54", flag: "🇦🇷", country: "AR" },
  { code: "+52", flag: "🇲🇽", country: "MX" },
  { code: "+34", flag: "🇪🇸", country: "ES" },
  { code: "+55", flag: "🇧🇷", country: "BR" },
  { code: "+1", flag: "🇺🇸", country: "US" },
  { code: "+56", flag: "🇨🇱", country: "CL" },
  { code: "+57", flag: "🇨🇴", country: "CO" },
  { code: "+598", flag: "🇺🇾", country: "UY" },
  { code: "+44", flag: "🇬🇧", country: "UK" },
  { code: "+33", flag: "🇫🇷", country: "FR" },
  { code: "+49", flag: "🇩🇪", country: "DE" },
  { code: "+39", flag: "🇮🇹", country: "IT" },
];

// ═══════════════════════════════════════════════════
// GPS HELPERS
// ═══════════════════════════════════════════════════
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function MesaCustomer() {
  // App state
  const [view, setView] = useState("welcome"); // welcome | form | waiting | walkAround
  const [showMenu, setShowMenu] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+54");
  const [allergies, setAllergies] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Queue
  const [entry, setEntry] = useState(null); // our waitlist row
  const [position, setPosition] = useState(null);
  const [queueCount, setQueueCount] = useState(0);

  // GPS
  const [distance, setDistance] = useState(null);
  const [watchId, setWatchId] = useState(null);

  // Allergies options
  const allergyOptions = [
    { id: "nuts", label: "🥜 Frutos secos" },
    { id: "gluten", label: "🌾 Gluten" },
    { id: "dairy", label: "🥛 Lácteos" },
    { id: "egg", label: "🥚 Huevo" },
    { id: "vegan", label: "🌱 Vegano" },
  ];

  // ── Submit to queue ──
  const handleJoin = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name.trim(), party_size: party,
          allergies, phone: phone.trim() ? `${countryCode}${phone.trim().replace(/^0+/,"")}` : null, source: "qr",
        }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setSubmitting(false); return; }
      setEntry(data);
      setView("waiting");
    } catch (e) { alert("Error de conexión"); }
    setSubmitting(false);
  };

  // ── Realtime subscription ──
  useEffect(() => {
    if (!entry || !supabase) return;

    // Fetch position initially
    const fetchPosition = async () => {
      const { data } = await supabase
        .from("waitlist")
        .select("id")
        .in("status", ["waiting", "notified", "extended"])
        .order("joined_at", { ascending: true });
      if (data) {
        const idx = data.findIndex(r => r.id === entry.id);
        setPosition(idx >= 0 ? idx + 1 : null);
        setQueueCount(data.length);
      }
    };
    fetchPosition();

    // Subscribe to changes
    const channel = supabase
      .channel("waitlist-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, (payload) => {
        // If our entry was updated (seated, notified, etc)
        if (payload.new?.id === entry.id) {
          setEntry(payload.new);
          if (payload.new.status === "seated") {
            // Could show celebration screen
          }
        }
        fetchPosition(); // recalc position on any change
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [entry]);

  // ── GPS tracking for walk-around ──
  const startTracking = () => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const d = getDistance(pos.coords.latitude, pos.coords.longitude, RESTAURANT.lat, RESTAURANT.lng);
        setDistance(Math.round(d));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setWatchId(id);
    setView("walkAround");
  };

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setView("waiting");
  };

  // ── Cancel ──
  const handleCancel = async () => {
    if (!entry) return;
    if (!confirm("¿Seguro que querés salir de la fila?")) return;
    await fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "cancelled" }),
    });
    setEntry(null);
    setView("welcome");
  };

  // ═══════════════════════════════════════════════════
  // VIEWS
  // ═══════════════════════════════════════════════════

  // ── WELCOME ──
  if (view === "welcome") return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "60px 20px 40px", fontFamily: f.sans }}>
      <Logo />
      <Card style={{ marginTop: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: "700", color: T.text }}>Todas las mesas ocupadas</div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "4px" }}>
          Anotate y te avisamos al celular cuando tu mesa esté lista.
        </div>
      </Card>
      <div style={{ marginTop: "24px" }}>
        <Btn onClick={() => setView("form")}>Anotarme en la fila</Btn>
      </div>
      <div style={{ marginTop: "12px" }}>
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menú mientras esperás</Btn>
      </div>
      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );

  // ── FORM ──
  if (view === "form") return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "40px 20px", fontFamily: f.sans }}>
      <div style={{ fontSize: "22px", fontWeight: "700", color: T.text, marginBottom: "20px" }}>Anotarme en la fila</div>

      <Card>
        {/* Name */}
        <label style={{ fontSize: "14px", fontWeight: "600", color: T.text, display: "block", marginBottom: "6px" }}>Tu nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", border: `1px solid ${T.border}`, fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box", marginBottom: "16px" }} />

        {/* Party size */}
        <label style={{ fontSize: "14px", fontWeight: "600", color: T.text, display: "block", marginBottom: "6px" }}>¿Cuántos son?</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setParty(n)} style={{
              flex: 1, padding: "12px 0", borderRadius: "10px", fontSize: "16px", fontWeight: "600",
              background: party === n ? T.accent : T.bgPage, color: party === n ? "#fff" : T.text,
              border: "none", cursor: "pointer",
            }}>{n}{n === 6 ? "+" : ""}</button>
          ))}
        </div>

        {/* Phone with country code */}
        <label style={{ fontSize: "14px", fontWeight: "600", color: T.text, display: "block", marginBottom: "6px" }}>
          WhatsApp <span style={{ fontWeight: "400", color: T.textLight }}>(para avisarte cuando la mesa esté lista)</span>
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{
            padding: "14px 8px", borderRadius: "12px", border: `1px solid ${T.border}`,
            fontSize: "16px", fontFamily: f.sans, background: T.bg, outline: "none",
            width: "110px", flexShrink: 0,
          }}>
            {COUNTRY_CODES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 2345 6789"
            type="tel" inputMode="numeric" style={{
              flex: 1, padding: "14px", borderRadius: "12px", border: `1px solid ${T.border}`,
              fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box",
            }} />
        </div>

        {/* Allergies */}
        <label style={{ fontSize: "14px", fontWeight: "600", color: T.text, display: "block", marginBottom: "8px" }}>¿Alguna alergia o restricción?</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
          {allergyOptions.map(a => {
            const sel = allergies.includes(a.id);
            return (
              <button key={a.id} onClick={() => setAllergies(sel ? allergies.filter(x=>x!==a.id) : [...allergies, a.id])} style={{
                padding: "8px 14px", borderRadius: "20px", fontSize: "14px",
                background: sel ? T.accentLight : T.bgPage, color: sel ? T.accent : T.textMed,
                border: sel ? `1.5px solid ${T.accent}` : `1.5px solid transparent`,
                cursor: "pointer", fontFamily: f.sans,
              }}>{a.label}</button>
            );
          })}
        </div>
      </Card>

      <div style={{ marginTop: "20px" }}>
        <Btn onClick={handleJoin} disabled={!name.trim() || submitting}>
          {submitting ? "Anotando..." : "Confirmar"}
        </Btn>
      </div>
      <div style={{ marginTop: "10px" }}>
        <Btn variant="ghost" onClick={() => setView("welcome")}>← Volver</Btn>
      </div>
    </div>
  );

  // ── WALK AROUND ──
  if (view === "walkAround") {
    const isNear = distance !== null && distance <= RESTAURANT.walkAroundRadius;
    return (
      <div style={{ minHeight: "100vh", background: T.bgPage, padding: "40px 20px", fontFamily: f.sans }}>
        <Logo />
        <Card style={{ marginTop: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🚶</div>
          <div style={{ fontSize: "18px", fontWeight: "700", color: T.text }}>Modo paseo activado</div>
          <div style={{ fontSize: "14px", color: T.textMed, marginTop: "4px" }}>
            Podés caminar por el barrio. Te avisamos cuando sea tu turno.
          </div>
          <div style={{ marginTop: "20px", padding: "16px", borderRadius: "12px", background: isNear ? T.accentLight : "#FFF8E8" }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: isNear ? T.accent : T.warn }}>
              {distance !== null ? `${distance}m` : "Calculando..."}
            </div>
            <div style={{ fontSize: "13px", color: isNear ? T.accent : T.warn, marginTop: "4px" }}>
              {isNear ? "✓ Estás cerca de Chuí" : `A ${RESTAURANT.walkAroundMinutes} min caminando — volvé a tiempo`}
            </div>
          </div>
          {position && (
            <div style={{ marginTop: "16px", fontSize: "14px", color: T.textMed }}>
              Tu posición: <strong style={{ color: T.accent }}>#{position}</strong> de {queueCount}
            </div>
          )}
        </Card>
        <div style={{ marginTop: "20px" }}>
          <Btn onClick={stopTracking}>Volver a la espera</Btn>
        </div>
        <div style={{ marginTop: "10px" }}>
          <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menú</Btn>
        </div>
        {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
      </div>
    );
  }

  // ── WAITING ──
  const isNotified = entry?.status === "notified";
  const isSeated = entry?.status === "seated";

  if (isSeated) return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "60px 20px", fontFamily: f.sans, textAlign: "center" }}>
      <Logo />
      <Card style={{ marginTop: "24px" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>🎉</div>
        <div style={{ fontSize: "20px", fontWeight: "700", color: T.text }}>¡Tu mesa está lista!</div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "8px" }}>Acercate al hostess. Buen provecho.</div>
      </Card>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "40px 20px", fontFamily: f.sans }}>
      <Logo />

      {/* Position ring */}
      <Card style={{ marginTop: "20px", textAlign: "center" }}>
        {isNotified ? (
          <>
            <div style={{ fontSize: "20px", fontWeight: "700", color: T.accent, marginBottom: "8px" }}>🔔 ¡Es tu turno!</div>
            <div style={{ fontSize: "14px", color: T.textMed }}>Acercate al hostess para que te ubique.</div>
          </>
        ) : (
          <>
            <div style={{
              width: "100px", height: "100px", borderRadius: "50%", margin: "0 auto 16px",
              border: `4px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center",
              background: T.accentSoft,
            }}>
              <div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: T.accent }}>{position || "—"}</div>
                <div style={{ fontSize: "11px", color: T.textLight }}>en la fila</div>
              </div>
            </div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: T.text }}>{name}, estás en la fila</div>
            <div style={{ fontSize: "13px", color: T.textLight, marginTop: "4px" }}>
              🪑 {party} {party === 1 ? "persona" : "personas"} · {queueCount} en espera
            </div>
          </>
        )}
      </Card>

      {/* Actions */}
      <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn variant="outline" onClick={() => setShowMenu(true)}>📖 Ver menú</Btn>
        {!isNotified && (
          <Btn variant="outline" onClick={startTracking}>🚶 Pasear por el barrio</Btn>
        )}
        <Btn variant="ghost" onClick={handleCancel} style={{ color: T.danger, fontSize: "14px" }}>
          Salir de la fila
        </Btn>
      </div>

      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );
}
