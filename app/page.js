"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T, f, RESTAURANT, APP_NAME } from "../lib/tokens";
import MenuOverlay from "../components/MenuOverlay";

// ── UI ──
const Card = ({ children, style, className = "" }) => (
  <div className={`card-enter ${className}`} style={{ background: T.card, borderRadius: T.radius, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow, padding: "28px", ...style }}>{children}</div>
);

const Btn = ({ children, onClick, variant = "primary", disabled, style }) => {
  const s = {
    primary: { background: T.accent, color: "#fff", border: "none", boxShadow: "0 2px 12px rgba(26,26,26,0.15)" },
    outline: { background: "transparent", color: T.text, border: `1.5px solid ${T.border}` },
    ghost: { background: "transparent", color: T.textMed, border: "none" },
    success: { background: T.success, color: "#fff", border: "none", boxShadow: "0 2px 12px rgba(45,122,79,0.25)" },
    danger: { background: "transparent", color: T.danger, border: `1.5px solid ${T.danger}40` },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "17px", borderRadius: T.radiusSm || "14px", fontSize: "15px", fontWeight: "700",
      fontFamily: f.sans, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1, letterSpacing: "0.01em", ...s, ...style,
    }}>{children}</button>
  );
};

const Header = () => (
  <div style={{ textAlign: "center", marginBottom: "16px" }}>
    <img src="/logo-dark.png" alt={RESTAURANT.name} style={{ height: "40px", objectFit: "contain", marginBottom: "6px" }} />
    <div style={{ fontSize: "12px", color: T.textLight, fontFamily: f.sans, letterSpacing: "0.08em", textTransform: "uppercase" }}>{RESTAURANT.address}</div>
  </div>
);

// ── DATA ──
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
const ARRIVAL_MINUTES = 10;

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── MAIN ──
export default function MeantimeCustomer() {
  const [view, setView] = useState("welcome");
  const [showMenu, setShowMenu] = useState(false);
  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+54");
  const [allergies, setAllergies] = useState([]);
  const [birthday, setBirthday] = useState("");
  const [referralCode, setReferralCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);

  const [entry, setEntry] = useState(null);
  const [position, setPosition] = useState(null);
  const [prevPosition, setPrevPosition] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [distance, setDistance] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const pushInterval = useRef(null);
  const [atBar, setAtBar] = useState(false);
  const [barRedeemed, setBarRedeemed] = useState(false);
  const [arrivalCountdown, setArrivalCountdown] = useState(null);

  // Restore returning customer + check referral code
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
        if (c.birthday) setBirthday(c.birthday);
        setReturning(true);
      }
    } catch {}
    // Check for referral in URL
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) setReferralCode(ref);
    } catch {}
  }, []);

  // Push activity
  const pushActivity = useCallback(async (activity, dist) => {
    if (!entry) return;
    const body = { id: entry.id, activity };
    if (dist !== null) body.distance_m = dist;
    try { await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch {}
  }, [entry]);

  // Join queue
  const handleJoin = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name.trim(), party_size: party, allergies,
          phone: phone.trim() ? `${countryCode}${phone.trim().replace(/^0+/,"")}` : null,
          source: referralCode ? "referral" : "qr",
          ...(birthday ? { birthday } : {}),
          ...(referralCode ? { referral_code: referralCode } : {}),
        }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setSubmitting(false); return; }
      try { localStorage.setItem("meantime_customer", JSON.stringify({ name: name.trim(), phone: phone.trim(), countryCode, allergies, party, birthday })); } catch {}
      setEntry(data);
      setView("waiting");
    } catch { alert("Error de conexion"); }
    setSubmitting(false);
  };

  // Realtime position tracking + WhatsApp position updates
  useEffect(() => {
    if (!entry || !supabase) return;
    const fetchPosition = async () => {
      const { data } = await supabase.from("waitlist").select("id")
        .in("status", ["waiting", "notified", "extended"]).order("joined_at", { ascending: true });
      if (data) {
        const newPos = data.findIndex(r => r.id === entry.id) + 1;
        setQueueCount(data.length);
        setPosition(prev => {
          if (prev !== null && prev !== newPos && newPos > 0) {
            setPrevPosition(prev);
          }
          return newPos;
        });
      }
    };
    fetchPosition();
    const channel = supabase.channel("waitlist-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, (payload) => {
        if (payload.new?.id === entry.id) setEntry(payload.new);
        fetchPosition();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entry]);

  // Always track distance to Chuí and push every 15s
  useEffect(() => {
    if (!entry || !navigator.geolocation) return;
    const updateDist = (pos) => {
      const d = Math.round(getDistance(pos.coords.latitude, pos.coords.longitude, RESTAURANT.lat, RESTAURANT.lng));
      setDistance(d);
    };
    const geoId = navigator.geolocation.watchPosition(updateDist, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
    // Push distance every 15s
    const pushId = setInterval(() => {
      if (distance !== null) {
        const body = { id: entry.id, distance_m: distance };
        fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
      }
    }, 15000);
    return () => { navigator.geolocation.clearWatch(geoId); clearInterval(pushId); };
  }, [entry, distance]);

  // Arrival countdown + vibrate + flash title when notified
  useEffect(() => {
    if (entry?.status !== "notified" || !entry?.notified_at) { setArrivalCountdown(null); return; }
    // Vibrate
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    // Flash tab title
    const originalTitle = document.title;
    let flash = true;
    const titleIv = setInterval(() => {
      document.title = flash ? "🔔 Tu mesa esta lista!" : originalTitle;
      flash = !flash;
    }, 1000);
    // Countdown
    const deadline = new Date(entry.notified_at).getTime() + ARRIVAL_MINUTES * 60000;
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setArrivalCountdown(left);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => { clearInterval(iv); clearInterval(titleIv); document.title = originalTitle; };
  }, [entry?.status, entry?.notified_at]);

  // Walk tracking
  const startTracking = () => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setDistance(Math.round(getDistance(pos.coords.latitude, pos.coords.longitude, RESTAURANT.lat, RESTAURANT.lng))),
      () => {}, { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setWatchId(id); setView("walkAround");
    pushActivity("paseando", distance);
    pushInterval.current = setInterval(() => pushActivity("paseando", distance), 15000);
  };

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    if (pushInterval.current) clearInterval(pushInterval.current);
    pushInterval.current = null;
    pushActivity("esperando", null);
    setView("waiting");
  };

  // Bar activity push
  useEffect(() => {
    if (atBar && entry) {
      pushActivity("en_barra", 0);
      const iv = setInterval(() => pushActivity("en_barra", 0), 15000);
      return () => clearInterval(iv);
    }
  }, [atBar, entry, pushActivity]);

  // Redeem 2x1
  const redeemBar = async (item) => {
    if (!entry) return;
    try {
      await fetch("/api/bar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlist_id: entry.id, customer_id: entry.customer_id, guest_name: entry.guest_name, item }),
      });
      setBarRedeemed(true);
    } catch {}
  };

  // Notified actions
  const confirmArrival = async () => {
    if (!entry) return;
    await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, activity: "confirmado" }) });
  };

  const skipTurn = async () => {
    if (!entry) return;
    await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "extended", extra_minutes: 10 }) });
  };

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

  // ── WELCOME ──
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
      <div style={{ marginTop: "16px", padding: "18px 20px", borderRadius: T.radius, background: T.goldLight, border: `1px solid ${T.gold}30`, textAlign: "center" }}>
        <div style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "12px", fontWeight: "700", color: T.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>2x1 en barra</div>
        <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Cerveza tirada, copa de vino o vermut — al registrarte.</div>
      </div>
      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {returning ? (
          <>
            <Btn onClick={() => setView("form")}>Quiero mi mesa — {party} pers.</Btn>
            <Btn variant="outline" onClick={() => { setReturning(false); setView("form"); }}>Cambiar mis datos</Btn>
          </>
        ) : (
          <Btn onClick={() => setView("form")}>Quiero mi mesa</Btn>
        )}
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver el menu</Btn>
      </div>
      <div style={{ textAlign: "center", marginTop: "40px", fontSize: "11px", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>Powered by <a href="https://mesa-xi.vercel.app" aria-label="Meantime — Sistema de espera inteligente" style={{ color: "inherit", textDecoration: "none" }}>{APP_NAME}</a></div>
      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );

  // ── FORM ──
  if (view === "form") return (
    <div style={page}>
      <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text, marginBottom: "24px" }}>Reserva tu lugar</div>
      <Card>
        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle}
          onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
        <div style={{ height: "20px" }} />

        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cuantos son</label>
        <div style={{ display: "flex", gap: "6px" }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setParty(n)} style={{
              flex: 1, padding: "14px 0", borderRadius: "12px", fontSize: "16px", fontWeight: "600",
              background: party === n ? T.accent : "transparent", color: party === n ? "#fff" : T.text,
              border: party === n ? "none" : `1.5px solid ${T.border}`, cursor: "pointer", fontFamily: f.sans,
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
            fontSize: "14px", fontFamily: f.sans, background: T.bg, outline: "none", width: "105px", color: T.text,
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
                border: sel ? "none" : `1.5px solid ${T.border}`, cursor: "pointer", fontFamily: f.sans,
              }}>{a.label}</button>
            );
          })}
        </div>
        <div style={{ height: "20px" }} />

        <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, display: "block", marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Cumpleaños <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: "0" }}>(opcional — te regalamos postre)</span>
        </label>
        <input value={birthday} onChange={e => setBirthday(e.target.value)} type="date"
          style={{ ...inputStyle, colorScheme: "light" }}
          onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
      </Card>
      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn onClick={handleJoin} disabled={!name.trim() || submitting}>{submitting ? "Anotando..." : "Confirmar"}</Btn>
        <Btn variant="ghost" onClick={() => setView("welcome")}>Volver</Btn>
      </div>
    </div>
  );

  // ── WALK AROUND ──
  if (view === "walkAround") {
    const isNear = distance !== null && distance <= RESTAURANT.walkAroundRadius;
    return (
      <div style={page}>
        <Header />
        <Card style={{ marginTop: "28px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>modo paseo</div>
          <div style={{ fontFamily: f.display, fontSize: "22px", fontWeight: "700", color: T.text }}>Camina por el barrio</div>
          <div style={{ marginTop: "24px", padding: "24px", borderRadius: "14px", background: isNear ? T.successLight : T.warnLight }}>
            <div style={{ fontFamily: f.display, fontSize: "42px", fontWeight: "700", color: isNear ? T.success : T.warn }}>{distance !== null ? `${distance}m` : "..."}</div>
            <div style={{ fontSize: "13px", color: isNear ? T.success : T.warn, marginTop: "4px", fontWeight: "600" }}>{isNear ? "Estas cerca" : `~${RESTAURANT.walkAroundMinutes} min`}</div>
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

  // ── SEATED ──
  if (entry?.status === "seated") return (
    <div style={{ ...page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <Header />
      <Card style={{ marginTop: "28px", textAlign: "center", maxWidth: "360px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: T.success, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>mesa lista</div>
        <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text }}>Tu mesa te espera</div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "10px" }}>Acercate al hostess. Buen provecho.</div>
      </Card>
    </div>
  );

  // ── NOTIFIED ──
  const isNotified = entry?.status === "notified";
  if (isNotified) {
    const mins = arrivalCountdown !== null ? Math.floor(arrivalCountdown / 60) : ARRIVAL_MINUTES;
    const secs = arrivalCountdown !== null ? arrivalCountdown % 60 : 0;
    const urgent = arrivalCountdown !== null && arrivalCountdown < 120;

    return (
      <div style={page}>
        <Header />
        <Card style={{ marginTop: "28px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: T.success, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>tu turno</div>
          <div style={{ fontFamily: f.display, fontSize: "26px", fontWeight: "700", color: T.text }}>{name}, tu mesa esta lista</div>

          {/* Countdown — Live Activity style */}
          <div style={{
            marginTop: "20px", padding: "24px", borderRadius: "18px",
            background: urgent ? `linear-gradient(135deg, ${T.warnLight}, #FFF0E0)` : `linear-gradient(135deg, ${T.successLight}, #D4F0E0)`,
            animation: "countdownPulse 2s ease-in-out infinite",
            position: "relative", overflow: "hidden",
          }}>
            {/* Progress ring */}
            <div style={{ position: "relative", width: "100px", height: "100px", margin: "0 auto" }}>
              <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                <circle cx="50" cy="50" r="44" fill="none" stroke={urgent ? `${T.warn}20` : `${T.success}20`} strokeWidth="6" />
                <circle cx="50" cy="50" r="44" fill="none" stroke={urgent ? T.warn : T.success} strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - (arrivalCountdown || 0) / (ARRIVAL_MINUTES * 60))}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s linear" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                <div style={{ fontFamily: f.display, fontSize: "28px", fontWeight: "800", color: urgent ? T.warn : T.success, lineHeight: 1 }}>
                  {mins}:{secs.toString().padStart(2, "0")}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "14px", color: urgent ? T.warn : T.success, marginTop: "12px", fontWeight: "600" }}>
              {urgent ? "Apurate, se te acaba el tiempo" : "para llegar a tu mesa"}
            </div>
          </div>

          <div style={{ fontSize: "14px", color: T.textMed, marginTop: "16px" }}>Loyola 1250, Villa Crespo</div>
        </Card>

        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Btn variant="success" onClick={confirmArrival}>Ya estoy llegando</Btn>
          <Btn variant="outline" onClick={skipTurn}>Dejar pasar un turno</Btn>
          <Btn variant="danger" onClick={handleCancel}>Cancelar</Btn>
        </div>

        {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
      </div>
    );
  }

  // ── WAITING ──
  return (
    <div style={page}>
      <Header />

      <Card className="card-enter-delay-1" style={{ marginTop: "28px", textAlign: "center" }}>
        {/* Position ring — Apple Watch style */}
        <div style={{ position: "relative", width: "130px", height: "130px", margin: "0 auto 20px" }}>
          <svg viewBox="0 0 130 130" style={{ width: "100%", height: "100%" }}>
            <circle cx="65" cy="65" r="58" fill="none" stroke={`${T.accent}15`} strokeWidth="8" />
            <circle cx="65" cy="65" r="58" fill="none" stroke={T.accent} strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 58}`}
              strokeDashoffset={`${2 * Math.PI * 58 * (1 - (position ? 1 / Math.max(position, 1) : 0))}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)", transform: "rotate(-90deg)", transformOrigin: "center" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div style={{ fontFamily: f.display, fontSize: "42px", fontWeight: "800", color: T.accent, lineHeight: 1 }}>{position || "--"}</div>
            <div style={{ fontSize: "11px", color: T.textLight, fontFamily: f.sans, marginTop: "2px", fontWeight: "600" }}>en la fila</div>
          </div>
        </div>
        <div style={{ fontFamily: f.display, fontSize: "22px", fontWeight: "700", color: T.text }}>{name}, estas en la fila</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px" }}>
          <div style={{ padding: "6px 14px", borderRadius: "10px", background: T.bgPage, fontSize: "13px", color: T.textMed, fontWeight: "600" }}>
            {party} {party === 1 ? "persona" : "personas"}
          </div>
          <div style={{ padding: "6px 14px", borderRadius: "10px", background: T.bgPage, fontSize: "13px", color: T.textMed, fontWeight: "600" }}>
            {queueCount} en espera
          </div>
        </div>
        {/* Position change notification — animated */}
        {prevPosition !== null && prevPosition !== position && position > 0 && (
          <div className="card-enter" style={{ marginTop: "14px", fontSize: "13px", color: T.success, fontWeight: "700", padding: "8px 16px", borderRadius: "10px", background: T.successLight, display: "inline-block" }}>
            Avanzaste del #{prevPosition} al #{position}
          </div>
        )}
      </Card>

      {/* 2x1 bar */}
      {!atBar && (
        <Card style={{ marginTop: "14px", background: T.goldLight, border: `1px solid ${T.gold}25` }}>
          <div style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "12px", fontWeight: "700", color: T.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>2x1 en barra</div>
          <div style={{ fontSize: "13px", color: T.textMed, marginTop: "6px" }}>Cerveza tirada, copa de vino o vermut.</div>
          <button onClick={() => setAtBar(true)} style={{
            marginTop: "14px", width: "100%", padding: "14px", borderRadius: "12px",
            background: T.accent, color: "#fff", border: "none", fontSize: "14px",
            fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
          }}>Voy a la barra</button>
        </Card>
      )}
      {atBar && !barRedeemed && (
        <Card style={{ marginTop: "14px", background: T.goldLight, border: `1px solid ${T.gold}25`, textAlign: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: T.gold, marginBottom: "14px" }}>Elegi tu 2x1</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {["Cerveza tirada", "Copa de vino", "Vermut"].map(item => (
              <button key={item} onClick={() => redeemBar(item)} style={{
                padding: "16px", borderRadius: "12px", background: "#fff",
                border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: f.sans,
                fontSize: "15px", fontWeight: "600", color: T.text,
              }}>{item}</button>
            ))}
          </div>
          <div style={{ fontSize: "11px", color: T.textMed, marginTop: "12px" }}>Mostra el codigo al barman</div>
        </Card>
      )}
      {barRedeemed && (
        <Card style={{ marginTop: "14px", background: T.successLight, border: `1px solid ${T.success}25`, textAlign: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: T.success }}>2x1 registrado</div>
          <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Mostra esta pantalla en la barra</div>
          {/* QR-like verification code */}
          <div style={{
            marginTop: "14px", padding: "16px", borderRadius: "12px", background: T.bg,
            border: `1px solid ${T.border}`, fontFamily: "monospace", fontSize: "18px",
            fontWeight: "700", color: T.accent, letterSpacing: "0.1em",
          }}>
            {entry?.id?.slice(0, 8).toUpperCase() || "----"}
          </div>
          <div style={{ fontSize: "11px", color: T.textLight, marginTop: "6px" }}>{name} · {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
        </Card>
      )}

      {/* Pre-order — pedi algo mientras esperas */}
      <Card style={{ marginTop: "14px" }}>
        <div style={{ fontFamily: f.display, fontSize: "15px", fontWeight: "700", color: T.text }}>Pedí algo para cuando te sientes</div>
        <div style={{ fontSize: "12px", color: T.textMed, marginTop: "4px" }}>Te lo preparamos y esta listo cuando llegues a la mesa</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "14px" }}>
          {[
            { name: "Empanadas (3)", price: 4500 },
            { name: "Provoleta", price: 5200 },
            { name: "Tabla de fiambres", price: 8900 },
            { name: "Agua con gas", price: 1800 },
          ].map(item => (
            <button key={item.name} onClick={async () => {
              if (!entry) return;
              try {
                await fetch("/api/preorder", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ waitlist_id: entry.id, customer_id: entry.customer_id, guest_name: entry.guest_name, items: [{ name: item.name, price: item.price, quantity: 1 }] }),
                });
                alert(`${item.name} pedido! Te lo preparamos.`);
              } catch { alert("Error al pedir"); }
            }} style={{
              padding: "12px 8px", borderRadius: "12px", background: T.bgPage,
              border: `1px solid ${T.cardBorder}`, cursor: "pointer", fontFamily: f.sans,
              textAlign: "center",
            }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: T.text }}>{item.name}</div>
              <div style={{ fontSize: "11px", color: T.textMed, marginTop: "2px" }}>${item.price.toLocaleString("es-AR")}</div>
            </button>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Btn variant="outline" onClick={() => setShowMenu(true)}>Ver menu</Btn>
        <Btn variant="outline" onClick={startTracking}>Pasear por el barrio</Btn>
      </div>

      {/* Referral — share with friends */}
      {entry?.customer_id && (
        <Card style={{ marginTop: "14px", background: T.accentSoft, border: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: T.text }}>Invita a un amigo</div>
          <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Compartile tu link y los dos ganan un postre</div>
          <button onClick={async () => {
            try {
              const res = await fetch(`/api/referral?customer_id=${entry.customer_id}`);
              const data = await res.json();
              if (data.link && navigator.share) {
                navigator.share({ title: "Chui - Reserva tu mesa", text: "Veni a Chui! Usa mi link para anotarte y nos regalan un postre a los dos.", url: data.link });
              } else if (data.link) {
                navigator.clipboard?.writeText(data.link);
                alert("Link copiado!");
              } else if (data.error) {
                alert(data.error);
              }
            } catch { alert("Error al generar link"); }
          }} style={{
            marginTop: "14px", padding: "12px 24px", borderRadius: "12px",
            background: T.accent, color: "#fff", border: "none", fontSize: "14px",
            fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
          }}>Compartir link</button>
        </Card>
      )}

      {/* OpenTable */}
      <div style={{ marginTop: "24px", padding: "24px", borderRadius: T.radius, background: T.accentSoft, textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: T.text }}>No queres esperar la proxima?</div>
        <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Reserva tu mesa con anticipacion.</div>
        <a href={RESTAURANT.otLink} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", marginTop: "14px", padding: "12px 32px", borderRadius: "12px",
          background: T.accent, color: "#fff", fontSize: "14px", fontWeight: "600",
          textDecoration: "none", fontFamily: f.sans,
        }}>Reservar en OpenTable</a>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Btn variant="ghost" onClick={handleCancel} style={{ color: T.danger, fontSize: "13px" }}>Salir de la fila</Btn>
      </div>
      <div style={{ textAlign: "center", marginTop: "28px", fontSize: "11px", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>Powered by <a href="https://mesa-xi.vercel.app" aria-label="Meantime — Sistema de espera inteligente" style={{ color: "inherit", textDecoration: "none" }}>{APP_NAME}</a></div>
      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );
}
