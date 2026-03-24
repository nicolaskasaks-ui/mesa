"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const S = {
  libre:        { label: "Libre",     color: "#fff", bg: "#2D7A4F", border: "#246B42" },
  sentado:      { label: "Sentado",   color: "#fff", bg: "#1A1A1A", border: "#333" },
  postre:       { label: "Postre",    color: "#fff", bg: "#D4942A", border: "#B87E20" },
  pidio_cuenta: { label: "Cuenta",    color: "#fff", bg: "#C93B3B", border: "#A83030" },
};
const STATUS_FLOW = ["libre", "sentado", "postre", "pidio_cuenta"];

const ACT = {
  esperando:  { label: "Esperando", color: T.textLight },
  en_barra:   { label: "En barra",  color: "#2D7A4F" },
  paseando:   { label: "Paseando",  color: "#3B7BC0" },
  confirmado: { label: "Llegando",  color: "#2D7A4F" },
};

function ago(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}

// Predict which table each queue entry will likely get
function predictTable(tables, queue) {
  const predictions = {};
  // Tables sorted by availability priority: libre > postre > pidio_cuenta
  const priority = { libre: 0, postre: 1, pidio_cuenta: 2 };
  const available = tables
    .filter(t => t.status === "libre" || t.status === "postre" || t.status === "pidio_cuenta")
    .sort((a, b) => {
      const pa = priority[a.status] ?? 9;
      const pb = priority[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.capacity - b.capacity;
    });

  const used = new Set();
  const waiting = queue.filter(e => e.status === "waiting" || e.status === "extended");

  for (const entry of waiting) {
    // Find best table: exact capacity match first, then smallest that fits
    let best = null;
    for (const t of available) {
      if (used.has(t.id) || t.capacity < entry.party_size) continue;
      if (!best || Math.abs(t.capacity - entry.party_size) < Math.abs(best.capacity - entry.party_size)) {
        best = t;
        if (t.capacity === entry.party_size) break; // exact match
      }
    }
    if (best) {
      predictions[entry.id] = { tableId: best.id, status: best.status, capacity: best.capacity };
      used.add(best.id);
    }
  }
  return predictions;
}

function getCandidates(queue, capacity) {
  return queue
    .filter(e => e.status === "waiting" && e.party_size <= capacity)
    .sort((a, b) => {
      const diffA = capacity - a.party_size;
      const diffB = capacity - b.party_size;
      if (diffA !== diffB) return diffA - diffB;
      return new Date(a.joined_at) - new Date(b.joined_at);
    });
}

const HOST_PIN = "1250"; // Loyola 1250 — easy to remember for staff

export default function HostDashboard() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [tables, setTables] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [confirmAssign, setConfirmAssign] = useState(null);
  const [seatedToday, setSeatedToday] = useState(0);
  const [undoTable, setUndoTable] = useState(null);
  const [profileEntry, setProfileEntry] = useState(null);
  const [waitEstimates, setWaitEstimates] = useState({}); // { entryId: { estimated_minutes, confidence, range } }
  const longPressTimer = useRef(null);

  // Check if already authed from session + set host title
  useEffect(() => {
    document.title = "Meantime — Panel Hostess";
    try {
      if (sessionStorage.getItem("meantime_host_auth") === "1") setAuthed(true);
    } catch {}
  }, []);

  const fetchAll = async () => {
    if (!supabase) return;
    const [t, q] = await Promise.all([
      supabase.from("tables").select("*, waitlist(guest_name, party_size)").order("id"),
      supabase.from("waitlist")
        .select("*, customers(id, name, phone, allergies, visit_count, trust_level, no_show_count, last_visit)")
        .in("status", ["waiting", "notified", "extended"])
        .order("joined_at", { ascending: true }),
    ]);
    if (t.data) setTables(t.data);
    if (q.data) setQueue(q.data);
    // Count seated today
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase.from("waitlist")
      .select("id", { count: "exact", head: true })
      .eq("status", "seated")
      .gte("seated_at", `${today}T00:00:00`);
    setSeatedToday(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    if (!supabase) return;
    const ch1 = supabase.channel("host-tables").on("postgres_changes", { event: "*", schema: "public", table: "tables" }, fetchAll).subscribe();
    const ch2 = supabase.channel("host-queue").on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, fetchAll).subscribe();
    // Tick every 5s to update times + countdowns
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); clearInterval(tick); };
  }, []);

  const cycleTable = async (table) => {
    // Libre → show picker if candidates, else cycle
    if (table.status === "libre") {
      const candidates = getCandidates(queue, table.capacity);
      if (candidates.length > 0) { setPicker({ table, candidates }); return; }
    }

    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(table.status) + 1) % STATUS_FLOW.length];
    await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: table.id, status: next }) });

    // Libre or pidio_cuenta → show picker (mesa is becoming available)
    if (next === "libre" || next === "pidio_cuenta") {
      const candidates = getCandidates(queue, table.capacity);
      if (candidates.length > 0) {
        setPicker({ table: { ...table, status: next }, candidates });
      }
    }
  };

  const doNotify = async (entry) => {
    const phone = entry.customers?.phone?.replace(/\D/g, "");
    await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, status: "notified" }) });
    if (phone) {
      try {
        const res = await window.fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone, guestName: entry.guest_name, type: "ready", arrivalMinutes: 10 }) });
        const data = await res.json();
        if (!data.success) {
          const msg = encodeURIComponent(`${entry.guest_name}, tu mesa en Chuí esta lista! Te la guardamos 10 min.\nLoyola 1250.`);
          window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
        }
      } catch {
        const msg = encodeURIComponent(`${entry.guest_name}, tu mesa en Chuí esta lista! Te la guardamos 10 min.\nLoyola 1250.`);
        window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
      }
    }
  };

  const notifyFromPicker = async (entry) => { await doNotify(entry); setPicker(null); fetchAll(); };
  const seatDirect = async (entry) => {
    await doNotify(entry);
    try { await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, status: "seated" }) }); } catch {}
    setPicker(null); fetchAll();
  };
  const undoSeat = async (table) => {
    // Revert table to libre and revert waitlist entry to waiting
    await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: table.id, status: "libre" }) });
    if (table.waitlist_id) {
      await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: table.waitlist_id, status: "waiting" }) });
    }
    setUndoTable(null);
    fetchAll();
  };

  const handleLongPressStart = (table) => {
    if (table.status === "libre") return; // nothing to undo on free tables
    longPressTimer.current = setTimeout(() => {
      setUndoTable(table);
    }, 600); // 600ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const clearQueue = async (mode) => {
    const label = mode === "all" ? "toda la fila" : "los de mas de 5 horas";
    if (!confirm(`Limpiar ${label}?`)) return;
    try {
      const res = await window.fetch(`/api/waitlist?mode=${mode}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }
      alert(`${data.cancelled} cancelados`);
      fetchAll();
    } catch { alert("Error de conexion"); }
  };

  const setStatus = async (id, status) => {
    try {
      const res = await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }
      fetchAll();
    } catch { alert("Error de conexion"); }
  };

  // Fetch ML wait time predictions for queue entries
  useEffect(() => {
    if (queue.length === 0) { setWaitEstimates({}); return; }
    const waitingEntries = queue.filter(e => e.status === "waiting" || e.status === "extended");
    let cancelled = false;
    (async () => {
      const newEstimates = {};
      for (let i = 0; i < waitingEntries.length; i++) {
        if (cancelled) break;
        const e = waitingEntries[i];
        try {
          const res = await window.fetch(`/api/predict-wait?party_size=${e.party_size}&queue_position=${i + 1}`);
          const data = await res.json();
          if (!cancelled) newEstimates[e.id] = data;
        } catch {}
      }
      if (!cancelled) setWaitEstimates(newEstimates);
    })();
    return () => { cancelled = true; };
  }, [queue.length]);

  const libre = tables.filter(t => t.status === "libre").length;
  const waiting = queue.filter(q => q.status === "waiting").length;
  const predictions = predictTable(tables, queue);

  // Recently seated (< 2h) shown at top with prominent timer
  const recentlySeated = tables
    .filter(t => t.status !== "libre" && t.seated_at && (Date.now() - new Date(t.seated_at).getTime()) < 2 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.seated_at) - new Date(a.seated_at));
  const recentIds = new Set(recentlySeated.map(t => t.id));

  // Rest: libre > postre > cuenta > sentado (excluding recently seated)
  const sortedTables = [...tables].filter(t => !recentIds.has(t.id)).sort((a, b) => {
    const priority = { libre: 0, postre: 1, pidio_cuenta: 2, sentado: 3 };
    const pa = priority[a.status] ?? 9;
    const pb = priority[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    if (a.seated_at && b.seated_at) return new Date(a.seated_at) - new Date(b.seated_at);
    return 0;
  });

  const seatedCount = tables.filter(t => t.status !== "libre").length;

  // PIN screen
  if (!authed) return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: f.sans }}>
      <div style={{ textAlign: "center", width: "280px" }}>
        <img src="/logo-dark.png" alt="Chui" style={{ height: "32px", objectFit: "contain", marginBottom: "20px" }} />
        <div style={{ fontSize: "14px", color: T.textMed, marginBottom: "20px" }}>Ingresa el PIN del hostess</div>
        <input
          type="tel" inputMode="numeric" maxLength={4}
          value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(false); }}
          onKeyDown={e => {
            if (e.key === "Enter" && pin.length === 4) {
              if (pin === HOST_PIN) {
                try { sessionStorage.setItem("meantime_host_auth", "1"); } catch {}
                setAuthed(true);
              } else { setPinError(true); setPin(""); }
            }
          }}
          placeholder="••••"
          style={{
            width: "100%", padding: "16px", borderRadius: "14px", fontSize: "28px", fontWeight: "700",
            fontFamily: f.display, textAlign: "center", letterSpacing: "0.3em", outline: "none",
            border: `2px solid ${pinError ? T.danger : T.border}`, background: T.bg, color: T.text,
            boxSizing: "border-box",
          }}
          autoFocus
        />
        {pinError && <div style={{ fontSize: "13px", color: T.danger, marginTop: "10px" }}>PIN incorrecto</div>}
        <button onClick={() => {
          if (pin === HOST_PIN) {
            try { sessionStorage.setItem("meantime_host_auth", "1"); } catch {}
            setAuthed(true);
          } else { setPinError(true); setPin(""); }
        }} disabled={pin.length < 4} style={{
          width: "100%", padding: "16px", borderRadius: "14px", marginTop: "16px",
          background: pin.length === 4 ? T.accent : T.border, color: "#fff", border: "none",
          fontSize: "15px", fontWeight: "600", cursor: pin.length === 4 ? "pointer" : "default",
          fontFamily: f.sans, opacity: pin.length === 4 ? 1 : 0.5,
        }}>Entrar</button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight, fontFamily: f.sans }}>
      Cargando...
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans, color: T.text }}>

      {/* ── UNDO TABLE (long-press) ── */}
      {undoTable && (
        <div className="glass-overlay" style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setUndoTable(null); }}>
          <div style={{
            background: T.card, borderRadius: "20px", padding: "28px 24px", width: "calc(100% - 48px)", maxWidth: "340px",
            boxShadow: T.shadowLg || "0 12px 48px rgba(0,0,0,0.15)", textAlign: "center",
          }} className="modal-enter">
            <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700", color: T.text }}>Mesa {undoTable.id}</div>
            <div style={{ fontSize: "13px", color: T.textMed, marginTop: "6px" }}>
              {undoTable.waitlist?.guest_name ? `${undoTable.waitlist.guest_name} · ` : ""}{S[undoTable.status]?.label || undoTable.status} · {undoTable.capacity}p
            </div>
            <div style={{ fontSize: "14px", color: T.textMed, marginTop: "16px" }}>Liberar esta mesa?</div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setUndoTable(null)} style={{
                flex: 1, padding: "14px", borderRadius: "12px", background: T.bgPage,
                color: T.textMed, border: `1px solid ${T.border}`, fontSize: "14px",
                fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Cancelar</button>
              <button onClick={() => undoSeat(undoTable)} style={{
                flex: 1, padding: "14px", borderRadius: "12px", background: S.pidio_cuenta.bg,
                color: "#fff", border: "none", fontSize: "14px",
                fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Liberar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── GUEST PROFILE DRAWER ── */}
      {profileEntry && (() => {
        const c = profileEntry.customers;
        const trustNames = { 0: "Nuevo", 1: "Verificado", 2: "Confiable", 3: "Habitual" };
        const trustColors = { 0: T.textLight, 1: S.libre.bg, 2: S.libre.bg, 3: T.gold };
        return (
          <div className="glass-overlay" style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setProfileEntry(null); }}>
            <div style={{
              background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: "480px",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.1)", maxHeight: "70vh", overflowY: "auto",
            }}>
              <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: T.border, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontFamily: f.display, fontSize: "24px", fontWeight: "700" }}>{profileEntry.guest_name}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", background: `${trustColors[c?.trust_level || 0]}15`, color: trustColors[c?.trust_level || 0] }}>
                    {trustNames[c?.trust_level || 0]}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "6px", background: T.bgPage, color: T.textMed }}>
                    {c?.visit_count || 1} visitas
                  </span>
                  {(c?.no_show_count || 0) > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "6px", background: `${S.pidio_cuenta.bg}15`, color: S.pidio_cuenta.bg }}>
                      {c.no_show_count} no-show{c.no_show_count > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div style={{ padding: "12px", borderRadius: "12px", background: T.bgPage, textAlign: "center" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>Grupo</div>
                  <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700", marginTop: "4px" }}>{profileEntry.party_size}p</div>
                </div>
                <div style={{ padding: "12px", borderRadius: "12px", background: T.bgPage, textAlign: "center" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>Espera</div>
                  <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700", marginTop: "4px" }}>{ago(profileEntry.joined_at)}</div>
                </div>
              </div>

              {c?.phone && (
                <div style={{ padding: "12px 16px", borderRadius: "12px", background: T.bgPage, marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>WhatsApp</div>
                    <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "2px" }}>{c.phone}</div>
                  </div>
                  <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", fontWeight: "700", color: S.libre.bg, textDecoration: "none", padding: "8px 14px", borderRadius: "8px", background: `${S.libre.bg}10` }}>Abrir</a>
                </div>
              )}


              {c?.allergies?.length > 0 && (
                <div style={{ padding: "12px 16px", borderRadius: "12px", background: T.bgPage, marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Alergias</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {c.allergies.map(a => <span key={a} style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", background: `${S.pidio_cuenta.bg}15`, color: S.pidio_cuenta.bg, fontWeight: "600" }}>{a}</span>)}
                  </div>
                </div>
              )}

              {c?.last_visit && (
                <div style={{ padding: "12px 16px", borderRadius: "12px", background: T.bgPage, marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ultima visita</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "2px" }}>{new Date(c.last_visit).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
              )}

              {profileEntry.source && (
                <div style={{ padding: "12px 16px", borderRadius: "12px", background: T.bgPage, marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase" }}>Fuente</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "2px" }}>{profileEntry.source === "qr" ? "QR en local" : profileEntry.source === "whatsapp_bot" ? "WhatsApp" : profileEntry.source === "walkin" ? "Walk-in" : profileEntry.source}</div>
                </div>
              )}

              <button onClick={() => setProfileEntry(null)} style={{
                width: "100%", padding: "14px", borderRadius: "12px", marginTop: "8px",
                background: T.accent, color: "#fff", border: "none", fontSize: "14px",
                fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Cerrar</button>
            </div>
          </div>
        );
      })()}

      {/* ── SEAT PICKER ── */}
      {picker && (
        <div className="glass-overlay" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPicker(null); }}>
          <div style={{
            background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: "480px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.1)", maxHeight: "75vh", overflowY: "auto",
          }}>
            <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: T.border, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700" }}>Mesa {picker.table.id}</div>
                <div style={{ fontSize: "13px", color: T.textMed, marginTop: "2px" }}>
                  {picker.table.capacity} comensales · {picker.candidates.length} en espera
                </div>
              </div>
              <button onClick={() => setPicker(null)} style={{
                width: "32px", height: "32px", borderRadius: "50%", background: T.bgPage,
                border: `1px solid ${T.border}`, cursor: "pointer", fontSize: "14px", color: T.textLight,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>x</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {picker.candidates.map((entry, i) => {
                const c = entry.customers;
                const act = ACT[entry.activity] || ACT.esperando;
                const isExact = entry.party_size === picker.table.capacity;
                return (
                  <div key={entry.id} style={{
                    background: i === 0 ? T.bgWarm : T.bgPage, borderRadius: "14px", padding: "16px",
                    border: `1px solid ${i === 0 ? S.libre.border : T.cardBorder}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {i === 0 && <span style={{ fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: S.libre.bg, color: "#fff" }}>RECOMENDADO</span>}
                        <span style={{ fontSize: "16px", fontWeight: "700" }}>{entry.guest_name}</span>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: isExact ? S.libre.color : T.textMed }}>{entry.party_size}p · {ago(entry.joined_at)}</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: "600", padding: "2px 6px", borderRadius: "4px", background: `${act.color}12`, color: act.color }}>{act.label}</span>
                      {isExact && <span style={{ fontSize: "10px", fontWeight: "600", padding: "2px 6px", borderRadius: "4px", background: S.libre.bg, color: S.libre.color }}>Match exacto</span>}
                      {c?.allergies?.map(a => <span key={a} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: S.pidio_cuenta.bg, color: S.pidio_cuenta.color }}>{a}</span>)}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button onClick={() => notifyFromPicker(entry)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: T.accent, color: "#fff", border: "none", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans }}>Avisar</button>
                      <button onClick={() => seatDirect(entry)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: T.bgPage, color: T.textMed, border: `1px solid ${T.border}`, fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans }}>Sentar directo</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setPicker(null)} style={{ width: "100%", padding: "14px", marginTop: "14px", borderRadius: "12px", background: "transparent", color: T.textLight, border: "none", fontSize: "13px", cursor: "pointer", fontFamily: f.sans }}>No sentar a nadie</button>
          </div>
        </div>
      )}

      {/* ── STICKY HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, padding: "16px 20px", background: T.card, borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo-dark.png" alt="Chui" style={{ height: "28px", objectFit: "contain" }} />
            <span style={{ fontSize: "11px", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "600" }}>Hostess</span>
          </div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: f.display, fontSize: "24px", fontWeight: "700", color: S.libre.bg }}>{libre}</div>
              <div style={{ fontSize: "10px", color: T.textLight, fontWeight: "600", letterSpacing: "0.04em" }}>libres</div>
            </div>
            <div style={{ width: "1px", height: "28px", background: T.border }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: f.display, fontSize: "24px", fontWeight: "700", color: waiting > 0 ? S.pidio_cuenta.bg : T.text }}>{waiting}</div>
              <div style={{ fontSize: "10px", color: T.textLight, fontWeight: "600", letterSpacing: "0.04em" }}>en fila</div>
            </div>
            <div style={{ width: "1px", height: "28px", background: T.border }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: f.display, fontSize: "24px", fontWeight: "700", color: T.text }}>{seatedToday}</div>
              <div style={{ fontSize: "10px", color: T.textLight, fontWeight: "600", letterSpacing: "0.04em" }}>hoy</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "16px" }}>
        <style>{`
          .host-columns { display: flex; flex-direction: column; gap: 16px; }
          @media (min-width: 768px) {
            .host-columns { flex-direction: row; align-items: flex-start; }
            .host-col-queue { width: 40%; flex-shrink: 0; }
            .host-col-tables { width: 60%; flex-shrink: 0; }
          }
        `}</style>
        <div className="host-columns">

          {/* ══════════ LEFT COLUMN: QUEUE / FILA ══════════ */}
          <div className="host-col-queue">
            <div style={{ background: T.card, borderRadius: T.radius, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow, overflow: "hidden" }}>
              {/* Queue header */}
              <div style={{ padding: "16px", borderBottom: `1px solid ${T.cardBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: T.text, fontFamily: f.display }}>
                    Fila ({queue.length})
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button onClick={() => clearQueue("old")} style={{
                      padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                      background: T.bgPage, color: T.textLight, border: `1px solid ${T.border}`,
                      cursor: "pointer", fontFamily: f.sans,
                    }}>Limpiar viejos</button>
                    <button onClick={() => clearQueue("all")} style={{
                      padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                      background: S.pidio_cuenta.bg, color: S.pidio_cuenta.color, border: `1px solid ${S.pidio_cuenta.border}`,
                      cursor: "pointer", fontFamily: f.sans,
                    }}>Vaciar fila</button>
                    <button onClick={async () => {
                      if (!confirm("RESET TOTAL: Liberar TODAS las mesas y vaciar la fila? Esto es para fin de turno.")) return;
                      await window.fetch("/api/reset", { method: "POST" });
                      fetchAll();
                    }} style={{
                      padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                      background: T.danger, color: "#fff", border: "none",
                      cursor: "pointer", fontFamily: f.sans,
                    }}>Reset turno</button>
                  </div>
                </div>
              </div>

              {/* Queue entries */}
              {queue.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: T.textLight, fontSize: "13px" }}>
                  No hay nadie en fila
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                  {queue.map((entry, i) => {
                    const c = entry.customers;
                    const isNotified = entry.status === "notified";
                    const isExtended = entry.status === "extended";
                    const act = ACT[entry.activity] || ACT.esperando;
                    const pred = predictions[entry.id];

                    return (
                      <div key={entry.id} style={{
                        padding: "14px 16px",
                        borderBottom: i < queue.length - 1 ? `1px solid ${T.cardBorder}` : "none",
                        borderLeft: isNotified ? `3px solid ${S.pidio_cuenta.bg}` : isExtended ? `3px solid ${S.sentado.bg}` : `3px solid transparent`,
                      }}>
                        {/* Row 1: name + location + time */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            <span style={{ fontFamily: f.display, fontSize: "14px", color: T.textLight, fontWeight: "600" }}>#{i+1}</span>
                            <span onClick={() => setProfileEntry(entry)} style={{ fontFamily: f.display, fontSize: "17px", fontWeight: "700", cursor: "pointer", textDecoration: "underline", textDecorationColor: T.border, textUnderlineOffset: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.guest_name}</span>
                            {c?.trust_level >= 1 && <span style={{ fontSize: "10px", fontWeight: "700", color: c.trust_level >= 3 ? T.gold : c.trust_level >= 2 ? S.libre.bg : S.libre.bg }}>{c.trust_level >= 3 ? "★" : "✓"}</span>}
                            <span style={{ fontSize: "13px", color: T.textMed }}>{entry.party_size}p</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            {/* Location pill */}
                            {(() => {
                              const dist = entry.distance_m;
                              const inBar = entry.activity === "en_barra";
                              const atChui = dist != null && dist <= 50;
                              const label = inBar ? "BARRA" : atChui ? "CHUI" : dist != null && dist > 0 ? `${dist}m` : null;
                              const bg = inBar ? T.gold : atChui ? S.libre.bg : dist != null && dist < 300 ? "#2D7A4F" : dist != null && dist < 800 ? "#D4942A" : dist != null ? "#C93B3B" : null;
                              return label ? (
                                <span style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px", background: bg, color: "#fff", letterSpacing: "0.04em" }}>{label}</span>
                              ) : null;
                            })()}
                            {/* Wait time pill */}
                            {(() => {
                              const waitMin = Math.floor((now - new Date(entry.joined_at).getTime()) / 60000);
                              const wBg = waitMin >= 45 ? "#C93B3B" : waitMin >= 31 ? "#D4942A" : waitMin >= 15 ? "#E8A735" : "#2D7A4F";
                              return (
                                <span style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px", background: wBg, color: "#fff" }}>
                                  ⏱{ago(entry.joined_at)}
                                </span>
                              );
                            })()}
                            {/* Source pill */}
                            {entry.source && entry.source !== "qr" && (
                              <span style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "9px", fontWeight: "700", padding: "3px 6px", borderRadius: "4px", background: T.border, color: T.textMed, letterSpacing: "0.04em" }}>
                                {entry.source === "whatsapp_bot" ? "WA" : entry.source === "walkin" ? "WALK-IN" : entry.source.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: tags + notified timer */}
                        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          {isNotified && entry.notified_at ? (() => {
                            const elapsed = Math.floor((now - new Date(entry.notified_at).getTime()) / 1000);
                            const remaining = Math.max(0, 600 - elapsed); // 10 min
                            const grace = Math.max(0, 900 - elapsed); // 10 + 5 min
                            const mins = Math.floor(remaining / 60);
                            const secs = remaining % 60;
                            const expired = remaining === 0;
                            const graceExpired = grace === 0;
                            return (
                              <>
                                <span style={{
                                  fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px",
                                  fontFamily: "'Futura', 'Outfit', sans-serif",
                                  background: graceExpired ? S.pidio_cuenta.bg : expired ? S.pidio_cuenta.bg : S.libre.bg,
                                  color: "#fff",
                                }}>
                                  {graceExpired ? "VENCIDO" : expired ? `+${Math.floor((elapsed - 600) / 60)}:${String((elapsed - 600) % 60).padStart(2, "0")} gracia` : `${mins}:${secs.toString().padStart(2, "0")}`}
                                </span>
                              </>
                            );
                          })() : (
                            entry.activity !== "en_barra" ? (
                              <span style={{
                                fontSize: "10px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px",
                                background: isExtended ? S.sentado.bg : `${act.color}10`,
                                color: isExtended ? S.sentado.color : act.color,
                              }}>
                                {isExtended ? "Paso turno" : act.label}
                              </span>
                            ) : null
                          )}
                          {c?.allergies?.map(a => (
                            <span key={a} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", background: S.pidio_cuenta.bg, color: S.pidio_cuenta.color }}>{a}</span>
                          ))}
                          {entry.activity === "en_barra" && (
                            <span style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: T.goldLight, color: T.gold }}>{entry.id?.slice(0, 8).toUpperCase()}</span>
                          )}
                          {c?.trust_level >= 2 && (
                            <span style={{ fontSize: "10px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: "#E8F5EE", color: "#2D7A4F" }}>
                              {c.trust_level >= 3 ? "Habitual" : "Confiable"}
                            </span>
                          )}
                        </div>

                        {/* ML wait estimate */}
                        {(() => {
                          const est = waitEstimates[entry.id];
                          if (!est || est.confidence === "fallback" || isNotified) return null;
                          const dot = est.confidence === "high" ? T.success : est.confidence === "medium" ? T.warn : T.danger;
                          return (
                            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0 }} />
                              <span style={{ fontSize: "12px", fontWeight: "700", color: T.text, fontFamily: f.display }}>~{est.estimated_minutes}min</span>
                              {est.range && (
                                <span style={{ fontSize: "11px", color: T.textLight }}>({est.range.min}-{est.range.max})</span>
                              )}
                              {est.factors?.velocity && (
                                <span style={{ fontSize: "10px", color: T.textLight, marginLeft: "auto" }}>{est.factors.velocity}</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Table prediction */}
                        {pred && !isNotified && (
                          confirmAssign?.entryId === entry.id ? (
                            <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                              <button onClick={() => { doNotify(entry); fetchAll(); setConfirmAssign(null); }} style={{
                                flex: 1, padding: "12px", borderRadius: "8px", background: S.libre.bg, color: "#fff",
                                border: "none", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: f.sans,
                              }}>Mesa {pred.tableId}</button>
                              <button onClick={() => setConfirmAssign(null)} style={{
                                padding: "12px 16px", borderRadius: "8px", background: T.bgPage, color: T.textLight,
                                border: `1px solid ${T.border}`, fontSize: "13px", cursor: "pointer", fontFamily: f.sans,
                              }}>No</button>
                            </div>
                          ) : (
                            <button onClick={() => {
                              if (pred.status === "libre") setConfirmAssign({ entryId: entry.id, tableId: pred.tableId });
                            }} style={{
                              marginTop: "10px", padding: "10px 14px", borderRadius: "8px", width: "100%",
                              background: pred.status === "libre" ? S.libre.bg : T.bgPage,
                              border: pred.status === "libre" ? "none" : `1px solid ${T.cardBorder}`,
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              cursor: pred.status === "libre" ? "pointer" : "default",
                            }}>
                              <span style={{ fontSize: "11px", fontWeight: "600", color: pred.status === "libre" ? "#fff" : T.textLight }}>
                                {pred.status === "libre" ? "Asignar mesa" : pred.status === "postre" ? "Proxima mesa" : "Siguiente en liberar"}
                              </span>
                              <span style={{ fontFamily: f.display, fontSize: "14px", fontWeight: "700", color: pred.status === "libre" ? "#fff" : T.text }}>
                                {pred.tableId} <span style={{ fontSize: "11px", fontWeight: "500", color: pred.status === "libre" ? "rgba(255,255,255,0.7)" : T.textLight }}>({pred.capacity}p)</span>
                              </span>
                            </button>
                          )
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          {!isNotified && !isExtended && (
                            <button onClick={() => doNotify(entry)} style={{
                              flex: 1, padding: "11px", borderRadius: "10px", background: T.bgPage,
                              color: T.text, border: `1px solid ${T.border}`,
                              fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                            }}>Avisar</button>
                          )}
                          {(isNotified || isExtended) && (
                            <button onClick={() => setStatus(entry.id, "waiting")} style={{
                              padding: "11px 14px", borderRadius: "10px", background: T.bgPage,
                              color: T.textLight, border: `1px solid ${T.border}`,
                              fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                            }}>Deshacer</button>
                          )}
                          <button onClick={() => setStatus(entry.id, "seated")} style={{
                            flex: 1, padding: "11px", borderRadius: "10px", background: T.accent,
                            color: "#fff", border: "none",
                            fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                          }}>Sentar</button>
                          <button onClick={() => setStatus(entry.id, "cancelled")} style={{
                            padding: "11px 14px", borderRadius: "10px", background: S.pidio_cuenta.bg,
                            color: S.pidio_cuenta.color, border: `1px solid ${S.pidio_cuenta.border}`,
                            fontSize: "13px", cursor: "pointer", fontFamily: f.sans,
                          }}>x</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ RIGHT COLUMN: TABLES / MESAS ══════════ */}
          <div className="host-col-tables">
            <div style={{ background: T.card, borderRadius: T.radius, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow, overflow: "hidden" }}>
              {/* Tables header */}
              <div style={{ padding: "16px", borderBottom: `1px solid ${T.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: T.text, fontFamily: f.display }}>
                  Mesas
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: S.libre.bg }}>{libre} libres</span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: T.textLight }}>{seatedCount} sentados</span>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: "16px", justifyContent: "center", padding: "10px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
                {Object.entries(S).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: T.textLight }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: v.bg }} /> {v.label}
                  </div>
                ))}
              </div>

              {/* Recently seated — prominent at top */}
              {recentlySeated.length > 0 && (
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "10px" }}>
                    Recién sentados ({recentlySeated.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {recentlySeated.map(table => {
                      const cfg = S[table.status] || S.sentado;
                      const guestName = table.waitlist?.guest_name;
                      const mins = Math.floor((Date.now() - new Date(table.seated_at).getTime()) / 60000);
                      const timeStr = mins < 1 ? "ahora" : mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`;
                      return (
                        <button key={table.id} onClick={() => cycleTable(table)}
                          onTouchStart={() => handleLongPressStart(table)} onTouchEnd={handleLongPressEnd} onTouchCancel={handleLongPressEnd}
                          onMouseDown={() => handleLongPressStart(table)} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
                          onContextMenu={(e) => e.preventDefault()}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: "12px", background: cfg.bg, border: "none",
                            cursor: "pointer", WebkitTouchCallout: "none", userSelect: "none",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ fontFamily: f.display, fontSize: "16px", fontWeight: "800", color: cfg.color }}>{table.id}</div>
                            <div style={{ fontSize: "12px", color: cfg.color, opacity: 0.8 }}>{table.capacity}p · {cfg.label}</div>
                            {guestName && <div style={{ fontSize: "12px", color: cfg.color, opacity: 0.9, fontWeight: "600" }}>{guestName}</div>}
                          </div>
                          <div style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "13px", fontWeight: "700", color: cfg.color, opacity: 0.9 }}>{timeStr}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Table grid */}
              <div style={{ padding: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
                  {sortedTables.map(table => {
                    const cfg = S[table.status] || S.libre;
                    const time = table.seated_at ? ago(table.seated_at) : "";
                    const guestName = table.waitlist?.guest_name;
                    const isSeated = table.status === "sentado";
                    const seatedMin = table.seated_at ? Math.floor((Date.now() - new Date(table.seated_at).getTime()) / 60000) : 0;
                    const alertColor = isSeated && seatedMin >= 180 ? S.pidio_cuenta.bg : isSeated && seatedMin >= 120 ? S.postre.bg : null;

                    return (
                      <button key={table.id}
                        onClick={() => cycleTable(table)}
                        onTouchStart={() => handleLongPressStart(table)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                        onMouseDown={() => handleLongPressStart(table)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={`Mesa ${table.id} - ${cfg.label} - ${table.capacity} personas${guestName ? ` - ${guestName}` : ""}${time ? ` - ${time}` : ""}`}
                        style={{
                          padding: isSeated ? "10px 8px" : "14px 8px 12px",
                          borderRadius: T.radius, border: "none",
                          background: cfg.bg, cursor: "pointer", textAlign: "center",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          minHeight: isSeated ? "72px" : "100px",
                          WebkitTouchCallout: "none", userSelect: "none",
                          opacity: isSeated ? 0.85 : 1,
                        }}>
                        <div style={{ fontFamily: f.display, fontSize: isSeated ? "16px" : "22px", fontWeight: "800", color: cfg.color, lineHeight: 1 }}>{table.id}</div>
                        <div style={{ fontSize: isSeated ? "10px" : "11px", color: cfg.color, marginTop: "3px", fontWeight: "600", opacity: 0.8 }}>{cfg.label}</div>
                        <div style={{ fontSize: "10px", color: cfg.color, marginTop: "2px", opacity: 0.6 }}>{table.capacity}p</div>
                        {guestName && (
                          <div style={{ fontSize: "10px", color: cfg.color, marginTop: "3px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "600", opacity: 0.85, padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.15)" }}>
                            {guestName}
                          </div>
                        )}
                        {time && (
                          <div style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "10px", color: alertColor || cfg.color, marginTop: "2px", fontWeight: alertColor ? "700" : "500", opacity: alertColor ? 1 : 0.6 }}>
                            {time}{isSeated && seatedMin >= 120 ? " !" : ""}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
