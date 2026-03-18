"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const S = {
  libre:        { label: "Libre",     color: "#2D7A4F", bg: "#E8F5EE", border: "#C3E5D0" },
  sentado:      { label: "Sentado",   color: "#3B7BC0", bg: "#E8F0FA", border: "#C0D8F0" },
  pidio_cuenta: { label: "Cuenta",    color: "#C4872A", bg: "#FFF6EC", border: "#F0DFC0" },
  limpiando:    { label: "Limpiando", color: "#B83B3B", bg: "#FCEDED", border: "#F0C0C0" },
};
const STATUS_FLOW = ["libre", "sentado", "pidio_cuenta", "limpiando"];

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

// Get all candidates sorted: exact match first, then smaller parties
function getCandidates(queue, capacity) {
  return queue
    .filter(e => e.status === "waiting" && e.party_size <= capacity)
    .sort((a, b) => {
      // Exact or closer match first
      const diffA = capacity - a.party_size;
      const diffB = capacity - b.party_size;
      if (diffA !== diffB) return diffA - diffB;
      // Then by wait time (longest first = earliest joined_at)
      return new Date(a.joined_at) - new Date(b.joined_at);
    });
}

export default function HostDashboard() {
  const [tables, setTables] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { table, candidates[] }

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
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    if (!supabase) return;
    const ch1 = supabase.channel("host-tables").on("postgres_changes", { event: "*", schema: "public", table: "tables" }, fetchAll).subscribe();
    const ch2 = supabase.channel("host-queue").on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, fetchAll).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const cycleTable = async (table) => {
    // If table is libre and there are candidates, show picker instead of cycling
    if (table.status === "libre") {
      const candidates = getCandidates(queue, table.capacity);
      if (candidates.length > 0) {
        setPicker({ table, candidates });
        return;
      }
    }

    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(table.status) + 1) % STATUS_FLOW.length];

    await window.fetch("/api/tables", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: table.id, status: next }),
    });

    // When table transitions to libre, show picker
    if (next === "libre") {
      const candidates = getCandidates(queue, table.capacity);
      if (candidates.length > 0) {
        setPicker({ table: { ...table, status: "libre" }, candidates });
      }
    }
  };

  const doNotify = async (entry) => {
    const phone = entry.customers?.phone?.replace(/\D/g, "");
    await window.fetch("/api/waitlist", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "notified" }),
    });
    if (phone) {
      try {
        const res = await window.fetch("/api/whatsapp", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone, guestName: entry.guest_name, type: "ready", arrivalMinutes: 10 }),
        });
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

  const notifyFromPicker = async (entry) => {
    await doNotify(entry);
    setPicker(null);
    fetchAll();
  };

  const seatDirect = async (entry) => {
    // For when person is physically at the restaurant
    await doNotify(entry);
    try {
      await window.fetch("/api/waitlist", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, status: "seated" }),
      });
    } catch {}
    setPicker(null);
    fetchAll();
  };

  const setStatus = async (id, status) => {
    try {
      const res = await window.fetch("/api/waitlist", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }
      fetchAll();
    } catch (err) {
      alert("Error de conexion");
    }
  };

  const libre = tables.filter(t => t.status === "libre").length;
  const waiting = queue.filter(q => q.status === "waiting").length;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight, fontFamily: f.sans }}>
      Cargando...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, fontFamily: f.sans, color: T.text }}>

      {/* ── SEAT PICKER OVERLAY ── */}
      {picker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPicker(null); }}>
          <div style={{
            background: T.card, borderRadius: "20px 20px 0 0", padding: "28px 20px 32px", width: "100%", maxWidth: "480px",
            border: `1px solid ${T.cardBorder}`, boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
            maxHeight: "75vh", overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "12px", color: S.libre.color, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Mesa {picker.table.id} libre
                </div>
                <div style={{ fontSize: "13px", color: T.textMed, marginTop: "2px" }}>
                  Cap. {picker.table.capacity} · {picker.candidates.length} {picker.candidates.length === 1 ? "candidato" : "candidatos"}
                </div>
              </div>
              <button onClick={() => setPicker(null)} style={{
                width: "32px", height: "32px", borderRadius: "50%", background: T.bgPage,
                border: `1px solid ${T.border}`, cursor: "pointer", fontSize: "14px", color: T.textLight,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>x</button>
            </div>

            {/* Candidates */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {picker.candidates.map((entry, i) => {
                const c = entry.customers;
                const act = ACT[entry.activity] || ACT.esperando;
                const isExact = entry.party_size === picker.table.capacity;
                const visits = c?.visit_count || 1;

                return (
                  <div key={entry.id} style={{
                    background: i === 0 ? T.bgWarm : T.bgPage, borderRadius: "14px", padding: "16px",
                    border: `1px solid ${i === 0 ? S.libre.border : T.cardBorder}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                        {i === 0 && (
                          <span style={{ fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: S.libre.color, color: "#fff", letterSpacing: "0.05em" }}>
                            RECOMENDADO
                          </span>
                        )}
                        <span style={{ fontSize: "16px", fontWeight: "700" }}>{entry.guest_name}</span>
                        {visits > 1 && <span style={{ fontSize: "11px", color: S.pidio_cuenta.color, fontWeight: "600" }}>x{visits}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: isExact ? S.libre.color : T.textMed }}>
                          {entry.party_size}p
                        </span>
                        <span style={{ fontSize: "11px", color: T.textLight }}>{ago(entry.joined_at)}</span>
                      </div>
                    </div>

                    {/* Tags row */}
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: "600", padding: "2px 6px", borderRadius: "4px", background: `${act.color}12`, color: act.color }}>{act.label}</span>
                      {isExact && <span style={{ fontSize: "10px", fontWeight: "600", padding: "2px 6px", borderRadius: "4px", background: S.libre.bg, color: S.libre.color }}>Match exacto</span>}
                      {c?.allergies?.map(a => (
                        <span key={a} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: S.limpiando.bg, color: S.limpiando.color }}>{a}</span>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button onClick={() => notifyFromPicker(entry)} style={{
                        flex: 1, padding: "12px", borderRadius: "10px", background: T.accent,
                        color: "#fff", border: "none", fontSize: "14px", fontWeight: "600",
                        cursor: "pointer", fontFamily: f.sans,
                      }}>Avisar</button>
                      <button onClick={() => seatDirect(entry)} style={{
                        flex: 1, padding: "12px", borderRadius: "10px", background: S.libre.bg,
                        color: S.libre.color, border: `1px solid ${S.libre.border}`, fontSize: "14px", fontWeight: "600",
                        cursor: "pointer", fontFamily: f.sans,
                      }}>Sentar directo</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Skip all */}
            <button onClick={() => setPicker(null)} style={{
              width: "100%", padding: "14px", marginTop: "14px", borderRadius: "12px",
              background: "transparent", color: T.textLight, border: "none",
              fontSize: "13px", cursor: "pointer", fontFamily: f.sans,
            }}>No sentar a nadie</button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.cardBorder}`, background: T.card }}>
        <img src="/logo-dark.png" alt="Chui" style={{ height: "28px", objectFit: "contain" }} />
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: "700", color: S.libre.color }}>{libre}</div>
            <div style={{ fontSize: "10px", color: T.textLight }}>libres</div>
          </div>
          <div style={{ width: "1px", height: "24px", background: T.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: "700" }}>{waiting}</div>
            <div style={{ fontSize: "10px", color: T.textLight }}>en fila</div>
          </div>
        </div>
      </div>

      {/* ── TABLE GRID ── */}
      <div style={{ padding: "16px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          {tables.map(table => {
            const cfg = S[table.status] || S.libre;
            const time = table.seated_at ? ago(table.seated_at) : "";
            return (
              <button key={table.id} onClick={() => cycleTable(table)} style={{
                padding: "14px 6px", borderRadius: "14px", border: `1.5px solid ${cfg.border}`,
                background: cfg.bg, cursor: "pointer", textAlign: "center", aspectRatio: "1",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: cfg.color, fontFamily: f.display }}>{table.id}</div>
                <div style={{ fontSize: "10px", color: cfg.color, marginTop: "3px", fontWeight: "600" }}>{cfg.label}</div>
                {time && <div style={{ fontSize: "11px", color: T.textMed, marginTop: "2px" }}>{time}</div>}
                {table.waitlist?.guest_name && (
                  <div style={{ fontSize: "10px", color: T.textMed, marginTop: "2px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {table.waitlist.guest_name}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", padding: "12px 0", flexWrap: "wrap" }}>
          {Object.entries(S).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: T.textLight }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: v.color }} /> {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── QUEUE ── */}
      {queue.length > 0 && (
        <div style={{ padding: "0 12px 32px" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px", paddingLeft: "4px" }}>
            Fila ({queue.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {queue.map((entry, i) => {
              const c = entry.customers;
              const isNotified = entry.status === "notified";
              const isExtended = entry.status === "extended";
              const act = ACT[entry.activity] || ACT.esperando;

              return (
                <div key={entry.id} style={{
                  background: T.card, borderRadius: "14px", padding: "16px",
                  border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow,
                  borderLeft: isNotified ? `3px solid ${S.pidio_cuenta.color}` : isExtended ? `3px solid ${S.sentado.color}` : `3px solid ${T.cardBorder}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "13px", color: T.textLight }}>#{i+1}</span>
                      <span style={{ fontSize: "16px", fontWeight: "700" }}>{entry.guest_name}</span>
                      <span style={{ fontSize: "13px", color: T.textMed }}>{entry.party_size}p</span>
                      <span style={{ fontSize: "12px", color: T.textLight }}>{ago(entry.joined_at)}</span>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: `${act.color}15`, color: act.color }}>
                      {isExtended ? "Paso turno" : isNotified ? "Avisado" : act.label}
                    </span>
                  </div>

                  {c?.allergies?.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                      {c.allergies.map(a => (
                        <span key={a} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: S.limpiando.bg, color: S.limpiando.color }}>{a}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    {!isNotified && (
                      <button onClick={() => doNotify(entry)} style={{
                        flex: 1, padding: "10px", borderRadius: "10px", background: S.libre.bg,
                        color: S.libre.color, border: `1px solid ${S.libre.border}`, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                      }}>Avisar</button>
                    )}
                    <button onClick={() => setStatus(entry.id, "seated")} style={{
                      flex: 1, padding: "10px", borderRadius: "10px", background: T.accent,
                      color: "#fff", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                    }}>Sentar</button>
                    <button onClick={() => confirm(`Cancelar a ${entry.guest_name}?`) && setStatus(entry.id, "cancelled")} style={{
                      padding: "10px 14px", borderRadius: "10px", background: S.limpiando.bg,
                      color: S.limpiando.color, border: `1px solid ${S.limpiando.border}`, fontSize: "13px", cursor: "pointer",
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
