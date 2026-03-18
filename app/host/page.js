"use client";
import { useState, useEffect } from "react";
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
  return `${Math.floor(m/60)}h${m%60}m`;
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
  const [tables, setTables] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [confirmAssign, setConfirmAssign] = useState(null);
  const [seatedToday, setSeatedToday] = useState(0);

  const fetchAll = async () => {
    if (!supabase) return;
    const [t, q] = await Promise.all([
      supabase.from("tables").select("*, waitlist(guest_name, party_size)").order("id"),
      supabase.from("waitlist")
        .select("*, customers(name, phone, allergies, visit_count, trust_level)")
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

  const libre = tables.filter(t => t.status === "libre").length;
  const waiting = queue.filter(q => q.status === "waiting").length;
  const predictions = predictTable(tables, queue);

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight, fontFamily: f.sans }}>
      Cargando...
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans, color: T.text }}>

      {/* ── SEAT PICKER ── */}
      {picker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
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

      {/* ── HEADER ── */}
      <div style={{ padding: "16px 20px", background: T.card, borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo-dark.png" alt="Chuí" style={{ height: "28px", objectFit: "contain" }} />
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

      {/* ── TABLE GRID ── */}
      {(() => {
        const active = tables.filter(t => t.status !== "sentado");
        const seated = tables.filter(t => t.status === "sentado");
        return (
          <div style={{ padding: "20px 16px 8px" }}>
            {/* Active tables: libre, postre, cuenta — large tiles */}
            {active.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
                {active.map(table => {
                  const cfg = S[table.status] || S.libre;
                  const time = table.seated_at ? ago(table.seated_at) : "";
                  const guestName = table.waitlist?.guest_name;
                  return (
                    <button key={table.id} onClick={() => cycleTable(table)} style={{
                      padding: "18px 8px 14px", borderRadius: T.radius, border: "none",
                      background: cfg.bg, cursor: "pointer", textAlign: "center",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                      minHeight: "110px",
                    }}>
                      <div style={{ fontFamily: f.display, fontSize: "22px", fontWeight: "800", color: cfg.color, lineHeight: 1 }}>{table.id}</div>
                      <div style={{ fontSize: "11px", color: cfg.color, marginTop: "5px", fontWeight: "600", opacity: 0.8 }}>{cfg.label}</div>
                      <div style={{ fontSize: "10px", color: cfg.color, marginTop: "4px", opacity: 0.6 }}>{table.capacity}p</div>
                      <div style={{ fontSize: "11px", color: cfg.color, marginTop: "3px", fontWeight: "500", opacity: time ? 0.7 : 0, height: "14px" }}>{time || "-"}</div>
                      <div style={{ fontSize: "10px", color: cfg.color, marginTop: "2px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "500", opacity: guestName ? 0.7 : 0, height: "13px" }}>
                        {guestName || "-"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Seated tables — compact strip */}
            {seated.length > 0 && (
              <>
                <div style={{ fontSize: "10px", fontWeight: "700", color: T.textLight, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px", paddingLeft: "2px" }}>
                  Sentados ({seated.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "6px", marginBottom: "12px" }}>
                  {seated.map(table => {
                    const time = table.seated_at ? ago(table.seated_at) : "";
                    return (
                      <button key={table.id} onClick={() => cycleTable(table)} style={{
                        padding: "8px 6px", borderRadius: "10px", border: "none",
                        background: S.sentado.bg, cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        height: "48px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontFamily: f.display, fontSize: "13px", fontWeight: "800", color: S.sentado.color }}>{table.id}</span>
                          <span style={{ fontSize: "9px", color: S.sentado.color, opacity: 0.5 }}>{table.capacity}p</span>
                        </div>
                        {time && <span style={{ fontFamily: "'Futura', 'Outfit', sans-serif", fontSize: "9px", color: S.sentado.color, opacity: 0.4, marginTop: "1px" }}>{time}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", padding: "8px 0 6px" }}>
              {Object.entries(S).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: T.textLight }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: v.bg }} /> {v.label}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── QUEUE ── */}
      {queue.length > 0 && (
        <div style={{ padding: "8px 16px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, letterSpacing: "0.1em", textTransform: "uppercase", paddingLeft: "2px" }}>
              Fila ({queue.length})
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => clearQueue("old")} style={{
                padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                background: T.bgPage, color: T.textLight, border: `1px solid ${T.border}`,
                cursor: "pointer", fontFamily: f.sans,
              }}>Limpiar viejos</button>
              <button onClick={() => clearQueue("all")} style={{
                padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                background: S.pidio_cuenta.bg, color: S.pidio_cuenta.color, border: `1px solid ${S.pidio_cuenta.border}`,
                cursor: "pointer", fontFamily: f.sans,
              }}>Vaciar fila</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {queue.map((entry, i) => {
              const c = entry.customers;
              const isNotified = entry.status === "notified";
              const isExtended = entry.status === "extended";
              const act = ACT[entry.activity] || ACT.esperando;
              const pred = predictions[entry.id];

              return (
                <div key={entry.id} style={{
                  background: T.card, borderRadius: "14px", padding: "16px",
                  border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow,
                  borderLeft: isNotified ? `3px solid ${S.pidio_cuenta.color}` : isExtended ? `3px solid ${S.sentado.color}` : `3px solid transparent`,
                }}>
                  {/* Row 1: name + location + time */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: f.display, fontSize: "14px", color: T.textLight, fontWeight: "600" }}>#{i+1}</span>
                      <span style={{ fontFamily: f.display, fontSize: "17px", fontWeight: "700" }}>{entry.guest_name}</span>
                      {c?.trust_level >= 1 && <span style={{ fontSize: "10px", fontWeight: "700", color: S.libre.bg }}>✓</span>}
                      <span style={{ fontSize: "13px", color: T.textMed }}>{entry.party_size}p</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {/* Location pill */}
                      {(() => {
                        const dist = entry.distance_m;
                        const inBar = entry.activity === "en_barra";
                        const atChui = dist != null && dist <= 50;
                        const label = inBar ? "BARRA" : atChui ? "CHUÍ" : dist != null && dist > 0 ? `${dist}m` : null;
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
                            {ago(entry.joined_at)}
                          </span>
                        );
                      })()}
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

                  {/* Table prediction — tapeable to assign */}
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
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    {!isNotified && !isExtended && (
                      <button onClick={() => doNotify(entry)} style={{
                        flex: 1, padding: "11px", borderRadius: "10px", background: S.libre.bg,
                        color: S.libre.color, border: `1px solid ${S.libre.border}`,
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
        </div>
      )}
    </div>
  );
}
