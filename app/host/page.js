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

function findMatch(queue, capacity) {
  return queue.find(e => e.status === "waiting" && e.party_size <= capacity) || null;
}

export default function HostDashboard() {
  const [tables, setTables] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggest, setSuggest] = useState(null);

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
    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(table.status) + 1) % STATUS_FLOW.length];
    if (next === "libre") {
      await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: table.id, status: "libre" }) });
      const match = findMatch(queue, table.capacity);
      if (match) { setSuggest({ table: { ...table, status: "libre" }, match }); return; }
      return;
    }
    await window.fetch("/api/tables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: table.id, status: next }) });
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
          const msg = encodeURIComponent(`${entry.guest_name}, tu mesa en Chui esta lista.\nTenes 10 min para llegar.\nLoyola 1250.`);
          window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
        }
      } catch {
        const msg = encodeURIComponent(`${entry.guest_name}, tu mesa en Chui esta lista.\nTenes 10 min para llegar.\nLoyola 1250.`);
        window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
      }
    }
  };

  const seatFromSuggestion = async () => {
    if (!suggest) return;
    await doNotify(suggest.match);
    await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: suggest.match.id, status: "seated" }) });
    setSuggest(null);
  };

  const setStatus = async (id, status) => {
    await window.fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
  };

  const libre = tables.filter(t => t.status === "libre").length;
  const waiting = queue.filter(q => q.status === "waiting").length;

  if (loading) return <div style={{ minHeight: "100vh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight, fontFamily: f.sans }}>Cargando...</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, fontFamily: f.sans, color: T.text }}>

      {/* Suggestion overlay */}
      {suggest && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: T.card, borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "360px", border: `1px solid ${T.cardBorder}`, boxShadow: T.shadow, textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: S.libre.color, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mesa {suggest.table.id} libre</div>
            <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>Capacidad: {suggest.table.capacity}</div>

            <div style={{ margin: "24px 0", padding: "20px", borderRadius: "14px", background: T.bgPage, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: "22px", fontWeight: "700" }}>{suggest.match.guest_name}</div>
              <div style={{ fontSize: "14px", color: T.textMed, marginTop: "6px" }}>
                {suggest.match.party_size} {suggest.match.party_size === 1 ? "persona" : "personas"} · {ago(suggest.match.joined_at)}
              </div>
              {suggest.match.customers?.allergies?.length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                  {suggest.match.customers.allergies.map(a => (
                    <span key={a} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: S.limpiando.bg, color: S.limpiando.color }}>{a}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={seatFromSuggestion} style={{
                width: "100%", padding: "16px", borderRadius: "14px", background: T.accent, color: "#fff",
                border: "none", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: f.sans,
              }}>Avisar y sentar</button>
              <button onClick={() => { doNotify(suggest.match); setSuggest(null); }} style={{
                width: "100%", padding: "14px", borderRadius: "14px", background: "transparent",
                color: S.libre.color, border: `1.5px solid ${S.libre.border}`, fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Solo avisar</button>
              <button onClick={() => setSuggest(null)} style={{
                width: "100%", padding: "12px", borderRadius: "14px", background: "transparent",
                color: T.textLight, border: "none", fontSize: "13px", cursor: "pointer", fontFamily: f.sans,
              }}>Ignorar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
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

      {/* Table grid */}
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

      {/* Queue */}
      {queue.length > 0 && (
        <div style={{ padding: "0 12px 32px" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px", paddingLeft: "4px" }}>Fila ({queue.length})</div>
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
