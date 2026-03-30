"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";
import { useTenant } from "../../lib/use-tenant";

const CC = [
  { code: "+54", label: "AR +54" }, { code: "+52", label: "MX +52" }, { code: "+34", label: "ES +34" },
  { code: "+55", label: "BR +55" }, { code: "+1", label: "US +1" }, { code: "+56", label: "CL +56" },
  { code: "+57", label: "CO +57" }, { code: "+598", label: "UY +598" }, { code: "+44", label: "UK +44" },
  { code: "+33", label: "FR +33" }, { code: "+49", label: "DE +49" }, { code: "+39", label: "IT +39" },
];
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

export default function HostDashboard() {
  const { tenant } = useTenant();
  const HOST_PIN = tenant?.pin || "1250";
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
  const [waitEstimates, setWaitEstimates] = useState({});
  const [sourceModal, setSourceModal] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [seatSource, setSeatSource] = useState(null); // "walkin" | "opentable" — then ask name
  const [seatTable, setSeatTable] = useState(null);
  const [seatName, setSeatName] = useState("");
  const [seatParty, setSeatParty] = useState(0);
  const [manualForm, setManualForm] = useState(null);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCC, setManualCC] = useState("+54");
  const [manualParty, setManualParty] = useState(2);
  const longPressTimer = useRef(null);

  // Check if already authed from session + set host title
  useEffect(() => {
    document.title = "Meantime — Panel Hostess";
    try {
      if (sessionStorage.getItem("meantime_host_auth") === "1") setAuthed(true);
    } catch {}
  }, []);

  const fetchAll = async () => {
    try {
    const [tablesRes, queueRes] = await Promise.all([
      fetch("/api/tables").then(r => r.json()),
      fetch("/api/waitlist").then(r => r.json()),
    ]);
    if (Array.isArray(tablesRes)) setTables(tablesRes);
    else if (tablesRes && !tablesRes.error) setTables(tablesRes);
    if (Array.isArray(queueRes)) setQueue(queueRes);
    else if (queueRes && !queueRes.error) setQueue(queueRes);
    } catch (e) { console.error("fetchAll:", e); }
    // Count seated today
    if (!supabase) return;
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

  // Fetch Google Calendar events
  const fetchCalendar = async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/calendar/events?range=today");
      const data = await res.json();
      if (data.ok && data.events) {
        setCalendarEvents(data.events);
        setCalendarError(null);
      } else if (data.error) {
        setCalendarError(data.error);
        setCalendarEvents([]);
      }
    } catch {
      setCalendarError("No se pudo conectar");
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    fetchCalendar();
    const interval = setInterval(fetchCalendar, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const cycleTable = async (table) => {
    // Libre → show picker if candidates, else ask source (Walk-in/OpenTable)
    if (table.status === "libre") {
      const candidates = getCandidates(queue, table.capacity);
      if (candidates.length > 0) { setPicker({ table, candidates }); return; }
      // No candidates — ask Walk-in or OpenTable
      setSourceModal({ table });
      return;
    }

    // If about to become libre, ask for confirmation
    if (table.status === "pidio_cuenta") {
      setUndoTable(table); // reuse undo modal as "liberar mesa?"
      return;
    }

    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(table.status) + 1) % STATUS_FLOW.length];
    await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: table.id, status: next }) });
    fetchAll();
  };

  const confirmSeatWithName = async () => {
    if (!seatTable || !seatSource) return;
    const name = seatName.trim() || (seatSource === "opentable" ? "Reserva OT" : "Mesa directa");
    const party = seatParty || seatTable.capacity;
    // Create entry directly as seated (skip the queue)
    const res = await window.fetch("/api/waitlist/direct-seat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest_name: name, party_size: party, source: seatSource, table_id: seatTable.id }) });
    setSeatSource(null); setSeatTable(null); setSeatName(""); setSeatParty(0);
    fetchAll();
  };

  const addToQueue = async () => {
    if (!manualName.trim()) return;
    const phone = manualPhone.trim() ? `${manualCC}${manualPhone.trim().replace(/^0+/,"")}` : null;
    const res = await window.fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest_name: manualName.trim(), party_size: manualParty, phone, source: "host" }) });
    const entry = await res.json();
    if (entry.error) { alert(entry.error); return; }
    setManualForm(null); setManualName(""); setManualPhone(""); setManualCC("+54"); setManualParty(2);
    fetchAll();
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
          const msg = encodeURIComponent(`${entry.guest_name}, tu mesa esta lista! Te la guardamos 10 min.\n${tenant?.address || ""}`);
          window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
        }
      } catch {
        const msg = encodeURIComponent(`${entry.guest_name}, tu mesa esta lista! Te la guardamos 10 min.\n${tenant?.address || ""}`);
        window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
      }
    }
  };

  const notifyFromPicker = async (entry) => { await doNotify(entry); setPicker(null); fetchAll(); };
  const seatDirect = async (entry) => {
    // Find best table first
    const free = tables.filter(t => t.status === "libre" && t.capacity >= entry.party_size).sort((a,b) => a.capacity - b.capacity);
    if (!free[0]) {
      // No free table — try any free table regardless of capacity
      const anyFree = tables.filter(t => t.status === "libre").sort((a,b) => b.capacity - a.capacity);
      if (!anyFree[0]) { alert("No hay mesas libres"); return; }
      free[0] = anyFree[0];
    }
    // Seat waitlist entry
    await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, status: "seated" }) });
    // Occupy the table with waitlist link
    await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: free[0].id, status: "sentado", waitlist_id: entry.id }) });
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
  // All occupied tables: cuenta first, then postre, then sentado. Within each: longest first (most urgent)
  const recentlySeated = tables
    .filter(t => t.status !== "libre")
    .sort((a, b) => {
      const pri = { pidio_cuenta: 0, postre: 1, sentado: 2 };
      const pa = pri[a.status] ?? 3, pb = pri[b.status] ?? 3;
      if (pa !== pb) return pa - pb;
      // Longest seated first (oldest seated_at = most time elapsed = most urgent)
      return new Date(a.seated_at || 0) - new Date(b.seated_at || 0);
    });
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
        <img src={tenant?.logo_url || tenant?.logo || "/logo-dark.png"} alt={tenant?.name || "Meantime"} style={{ height: "32px", objectFit: "contain", marginBottom: "20px" }} />
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

      {/* ── SOURCE MODAL (Walk-in / OpenTable) ── */}
      {sourceModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSourceModal(null); }}>
          <div className="modal-enter" style={{ background: T.card, borderRadius: "20px", padding: "28px 24px", width: "calc(100% - 48px)", maxWidth: "340px", boxShadow: T.shadowLg, textAlign: "center" }}>
            <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700", color: T.text }}>Mesa {sourceModal.table.id}</div>
            <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px", marginBottom: "20px" }}>{sourceModal.table.capacity}p · Libre</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => { setSeatSource("walkin"); setSeatTable(sourceModal.table); setSourceModal(null); }} style={{
                padding: "16px", borderRadius: "14px", background: T.accent, color: "#fff",
                border: "none", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: f.sans,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: T.success }} />
                Walk-in
              </button>
              <button onClick={() => { setSeatSource("opentable"); setSeatTable(sourceModal.table); setSourceModal(null); }} style={{
                padding: "16px", borderRadius: "14px", background: T.accent, color: "#fff",
                border: "none", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: f.sans,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: T.danger }} />
                OpenTable
              </button>
              <button onClick={() => setSourceModal(null)} style={{
                padding: "14px", borderRadius: "14px", background: T.bgPage, color: T.textMed,
                border: `1px solid ${T.border}`, fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEAT NAME FORM (Walk-in / OpenTable → ask name + party) ── */}
      {seatSource && seatTable && (
        <div style={{ position: "fixed", inset: 0, zIndex: 265, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSeatSource(null); setSeatTable(null); setSeatName(""); } }}>
          <div className="modal-enter" style={{ background: T.card, borderRadius: "20px", padding: "28px 24px", width: "calc(100% - 48px)", maxWidth: "340px", boxShadow: T.shadowLg }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: seatSource === "opentable" ? T.danger : T.success }} />
                <span style={{ fontFamily: f.display, fontSize: "18px", fontWeight: "700", color: T.text }}>{seatSource === "opentable" ? "OpenTable" : "Walk-in"}</span>
              </div>
              <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Mesa {seatTable.id} · {seatTable.capacity}p</div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Nombre</label>
              <input value={seatName} onChange={e => setSeatName(e.target.value)} placeholder="Nombre de la reserva"
                autoFocus
                style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${T.border}`, fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box", background: T.bg, color: T.text }}
                onKeyDown={e => { if (e.key === "Enter") confirmSeatWithName(); }}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Personas</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setSeatParty(n)} style={{
                    flex: 1, padding: "12px 0", borderRadius: "10px", fontSize: "15px", fontWeight: "600",
                    background: (seatParty || seatTable.capacity) === n ? T.accent : "transparent",
                    color: (seatParty || seatTable.capacity) === n ? "#fff" : T.text,
                    border: (seatParty || seatTable.capacity) === n ? "none" : `1.5px solid ${T.border}`, cursor: "pointer", fontFamily: f.sans,
                  }}>{n}{n === 6 ? "+" : ""}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setSeatSource(null); setSeatTable(null); setSeatName(""); }} style={{
                flex: 1, padding: "14px", borderRadius: "12px", background: T.bgPage, color: T.textMed,
                border: `1px solid ${T.border}`, fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Cancelar</button>
              <button onClick={confirmSeatWithName} style={{
                flex: 1, padding: "14px", borderRadius: "12px",
                background: seatSource === "opentable" ? T.danger : T.success,
                color: "#fff", border: "none", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: f.sans,
              }}>Sentar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL ENTRY FORM (add to queue via host) ── */}
      {manualForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setManualForm(null); setManualName(""); setManualPhone(""); } }}>
          <div className="modal-enter" style={{ background: T.card, borderRadius: "20px", padding: "28px 24px", width: "calc(100% - 48px)", maxWidth: "340px", boxShadow: T.shadowLg }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "700", color: T.text }}>Agregar a la fila</div>
              <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Registro manual por el hostess</div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Nombre</label>
              <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nombre del cliente"
                autoFocus
                style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${T.border}`, fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box", background: T.bg, color: T.text }}
                onKeyDown={e => { if (e.key === "Enter" && manualName.trim()) addToQueue(); }}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>WhatsApp <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: "0" }}>(para avisarle)</span></label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <select value={manualCC} onChange={e => setManualCC(e.target.value)} style={{
                  padding: "14px 6px", borderRadius: "12px", border: `1.5px solid ${T.border}`,
                  fontSize: "13px", fontFamily: f.sans, background: T.bg, outline: "none", width: "95px", color: T.text,
                }}>{CC.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
                <input value={manualPhone} onChange={e => setManualPhone(e.target.value.replace(/[^\d]/g, ""))} placeholder="11 2345 6789"
                  type="tel" inputMode="numeric"
                  style={{ flex: 1, padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${T.border}`, fontSize: "16px", fontFamily: f.sans, outline: "none", boxSizing: "border-box", background: T.bg, color: T.text }}
                />
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Personas</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setManualParty(n)} style={{
                    flex: 1, padding: "12px 0", borderRadius: "10px", fontSize: "15px", fontWeight: "600",
                    background: manualParty === n ? T.accent : "transparent", color: manualParty === n ? "#fff" : T.text,
                    border: manualParty === n ? "none" : `1.5px solid ${T.border}`, cursor: "pointer", fontFamily: f.sans,
                  }}>{n}{n === 6 ? "+" : ""}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setManualForm(null); setManualName(""); setManualPhone(""); }} style={{
                flex: 1, padding: "14px", borderRadius: "12px", background: T.bgPage, color: T.textMed,
                border: `1px solid ${T.border}`, fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Cancelar</button>
              <button onClick={addToQueue} disabled={!manualName.trim()} style={{
                flex: 1, padding: "14px", borderRadius: "12px", background: manualName.trim() ? T.gold : T.border,
                color: "#fff", border: "none", fontSize: "14px", fontWeight: "700", cursor: manualName.trim() ? "pointer" : "default",
                fontFamily: f.sans, opacity: manualName.trim() ? 1 : 0.5,
              }}>Agregar a la fila</button>
            </div>
          </div>
        </div>
      )}

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
                    <button onClick={async () => {
                      // Seat directly on this table
                      await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, status: "seated" }) });
                      await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: picker.table.id, status: "sentado", waitlist_id: entry.id }) });
                      setPicker(null); fetchAll();
                    }} style={{ width: "100%", padding: "14px", marginTop: "12px", borderRadius: "10px", background: T.gold, color: "#fff", border: "none", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: f.sans }}>
                      Sentar en mesa {picker.table.id}
                    </button>
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
            <img src={tenant?.logo_url || tenant?.logo || "/logo-dark.png"} alt={tenant?.name || "Meantime"} style={{ height: "28px", objectFit: "contain" }} />
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
            .host-columns { flex-direction: row; align-items: flex-start; flex-wrap: wrap; }
            .host-col-queue { width: 33%; flex-shrink: 0; }
            .host-col-tables { width: 64%; flex-shrink: 0; }
          }
          @media (min-width: 1200px) {
            .host-col-queue { width: 25%; }
            .host-col-tables { width: 50%; }
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
                    <button onClick={() => setManualForm({ queue: true })} style={{
                      padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                      background: T.gold, color: "#fff", border: "none",
                      cursor: "pointer", fontFamily: f.sans,
                    }}>+ Agregar</button>
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
                          <button onClick={async () => {
                            const free = tables.filter(t => t.status === "libre" && t.capacity >= entry.party_size).sort((a,b) => a.capacity - b.capacity);
                            await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, status: "seated" }) });
                            if (free[0]) {
                              await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: free[0].id, status: "sentado", waitlist_id: entry.id }) });
                            }
                            fetchAll();
                          }} style={{
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

          {/* ══════════ CALENDAR RESERVATIONS ══════════ */}
          {!calendarError && (
            <div className="host-col-queue">
              <div style={{ background: T.card, borderRadius: T.radius, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow, overflow: "hidden" }}>
                <div style={{ padding: "16px", borderBottom: `1px solid ${T.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: T.text, fontFamily: f.display }}>
                    DJs Hoy ({calendarEvents.length})
                  </div>
                  <button onClick={fetchCalendar} style={{
                    padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                    background: T.bgPage, color: T.textLight, border: `1px solid ${T.border}`,
                    cursor: "pointer", fontFamily: f.sans,
                  }}>{calendarLoading ? "..." : "Actualizar"}</button>
                </div>
                {calendarEvents.length === 0 ? (
                  <div style={{ padding: "30px 16px", textAlign: "center", color: T.textLight, fontSize: "13px" }}>
                    {calendarLoading ? "Cargando agenda..." : "No hay DJs programados hoy"}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {calendarEvents.map((event, i) => {
                      const startTime = event.start ? new Date(event.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";
                      const endTime = event.end ? new Date(event.end).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
                      const isPast = event.end && new Date(event.end) < new Date();
                      const isLive = event.start && event.end && new Date(event.start) <= new Date() && new Date(event.end) > new Date();
                      const isSoon = event.start && !isPast && !isLive && (new Date(event.start) - new Date()) < 60 * 60 * 1000;
                      return (
                        <div key={event.id} style={{
                          padding: "14px 16px",
                          borderBottom: i < calendarEvents.length - 1 ? `1px solid ${T.cardBorder}` : "none",
                          opacity: isPast ? 0.45 : 1,
                          borderLeft: isLive ? `3px solid ${T.gold}` : isSoon ? `3px solid ${S.libre.bg}` : `3px solid transparent`,
                          background: isLive ? `${T.gold}08` : "transparent",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{
                                fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "13px", fontWeight: "700",
                                color: isLive ? T.gold : isSoon ? S.libre.bg : isPast ? T.textLight : T.text,
                              }}>{startTime}</span>
                              <span style={{ fontFamily: f.display, fontSize: "17px", fontWeight: "700", color: isLive ? T.gold : T.text }}>{event.title}</span>
                            </div>
                            {endTime && (
                              <span style={{ fontSize: "11px", color: T.textLight }}>hasta {endTime}</span>
                            )}
                          </div>
                          {event.description && (
                            <div style={{ fontSize: "12px", color: T.textMed, marginTop: "4px" }}>{event.description}</div>
                          )}
                          <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px",
                              background: T.accent, color: "#fff", letterSpacing: "0.03em",
                            }}>VINILOS</span>
                            {isLive && (
                              <span style={{
                                fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px",
                                background: T.gold, color: "#fff", letterSpacing: "0.03em",
                              }}>EN VIVO</span>
                            )}
                            {isSoon && (
                              <span style={{
                                fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px",
                                background: S.libre.bg, color: "#fff", letterSpacing: "0.03em",
                              }}>PRONTO</span>
                            )}
                            {isPast && (
                              <span style={{
                                fontSize: "10px", fontWeight: "600", padding: "3px 8px", borderRadius: "4px",
                                background: T.bgPage, color: T.textLight,
                              }}>TERMINADO</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
                    Sentados ({recentlySeated.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {recentlySeated.map(table => {
                      const cfg = S[table.status] || S.sentado;
                      const guestName = table.waitlist?.guest_name;
                      const source = table.waitlist?.source;
                      const sourceColor = source === "opentable" ? T.danger : source === "walkin" ? T.success : source === "qr" || source === "whatsapp" || source === "whatsapp_bot" || source === "host" ? T.gold : "#888";
                      const sourceLabel = source === "opentable" ? "OT" : source === "walkin" ? "WI" : source === "qr" || source === "whatsapp" || source === "whatsapp_bot" || source === "kiosk" || source === "host" ? "M" : "";
                      const allergies = table.waitlist?.customers?.allergies;
                      const mins = Math.floor((Date.now() - new Date(table.seated_at).getTime()) / 60000);
                      const timeStr = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`;
                      // Estimated duration based on party size: 2p=60min, 4p=75min, 6p=90min
                      const capacity = table.waitlist?.party_size || table.capacity || 2;
                      const estDuration = capacity <= 2 ? 60 : capacity <= 4 ? 75 : 90;
                      const maxTime = Math.max(estDuration * 1.5, mins); // scale extends if overtime
                      const progress = mins / maxTime; // how far along the full bar
                      const estMark = estDuration / maxTime; // where the estimated marker sits
                      const overTime = mins > estDuration;
                      const ratio = mins / estDuration;
                      // Color: green < 60%, amber 60-85%, red > 85%
                      const barColor = ratio > 0.85 ? T.danger : ratio > 0.6 ? S.postre.bg : T.success;
                      return (
                        <div key={table.id} style={{ display: "flex", alignItems: "stretch", gap: "0", width: "100%" }}>
                          {/* Status circle — outside the bar, changes color with state */}
                          <div style={{
                            width: "24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <div style={{
                              width: "18px", height: "18px", borderRadius: "50%", background: cfg.bg,
                              border: `3px solid ${cfg.bg}`, boxShadow: `0 0 0 2px #fff, 0 0 8px ${cfg.bg}80`,
                            }} />
                          </div>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <button onClick={() => cycleTable(table)}
                            onTouchStart={() => handleLongPressStart(table)} onTouchEnd={handleLongPressEnd} onTouchCancel={handleLongPressEnd}
                            onMouseDown={() => handleLongPressStart(table)} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
                            onContextMenu={(e) => e.preventDefault()}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              borderRadius: "12px 12px 0 0", overflow: "hidden",
                              border: "none", cursor: "pointer", WebkitTouchCallout: "none", userSelect: "none", width: "100%",
                              background: T.accent, padding: "10px 12px",
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ fontFamily: f.display, fontSize: "15px", fontWeight: "800", color: "#fff" }}>{table.id}</div>
                              <div style={{ fontSize: "11px", color: "#fff", opacity: 0.5 }}>{capacity}p</div>
                              {guestName && <div style={{ fontSize: "11px", color: "#fff", opacity: 0.85, fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>{guestName}</div>}
                              {sourceLabel && <span style={{ fontSize: "8px", fontWeight: "700", padding: "2px 4px", borderRadius: "3px", background: sourceColor, color: "#fff" }}>{sourceLabel}</span>}
                              {allergies?.length > 0 && allergies.map(a => (
                                <span key={a} style={{ fontSize: "8px", fontWeight: "700", padding: "2px 4px", borderRadius: "3px", background: T.danger, color: "#fff" }}>{a}</span>
                              ))}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                              <span style={{ fontSize: "10px", color: "#fff", opacity: 0.5 }}>{cfg.label}</span>
                              <div style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "13px", fontWeight: "700", color: overTime ? T.danger : "#fff" }}>
                                {timeStr}{overTime ? " !" : ""}
                              </div>
                            </div>
                          </button>
                          {/* Progress bar at bottom */}
                          <div style={{ position: "relative", height: "6px", background: "#2a2a2a", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                            {/* Elapsed time bar */}
                            <div style={{
                              position: "absolute", left: 0, top: 0, bottom: 0,
                              width: `${progress * 100}%`,
                              background: barColor,
                              transition: "width 5s linear, background 1s ease",
                            }} />
                            {/* ML estimated duration marker — bright white tick */}
                            <div style={{
                              position: "absolute", top: "-2px", bottom: "-2px", width: "3px",
                              left: `calc(${estMark * 100}% - 1px)`,
                              background: "#fff", borderRadius: "2px",
                              boxShadow: "0 0 4px rgba(255,255,255,0.8)",
                            }} />
                          </div>
                          </div>
                        </div>
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
// force redeploy 1774410754
