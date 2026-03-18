"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { f } from "../../lib/tokens";

const H = {
  bg: "#0A0A0A",
  card: "#141414",
  cardBorder: "#222",
  text: "#FFF",
  textMed: "#888",
  textLight: "#555",
  accent: "#FFF",
  success: "#34D399",
  warn: "#FBBF24",
  danger: "#F87171",
};

const STATUS_FLOW = ["libre", "sentado", "pidio_cuenta", "limpiando"];
const S = {
  libre:        { label: "Libre",     color: "#34D399", bg: "#0D1F17", border: "#1A3D2A" },
  sentado:      { label: "Sentado",   color: "#60A5FA", bg: "#0D1520", border: "#1A2D44" },
  pidio_cuenta: { label: "Cuenta",    color: "#FBBF24", bg: "#1A1708", border: "#33300F" },
  limpiando:    { label: "Limpiando", color: "#F87171", bg: "#1A0D0D", border: "#331A1A" },
};

const ACT = {
  esperando: { label: "Esperando", color: "#888" },
  en_barra:  { label: "En barra",  color: "#34D399" },
  paseando:  { label: "Paseando",  color: "#60A5FA" },
};

function ago(date) {
  if (!date) return "";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h${m%60}m`;
}

// Find best match from queue for a table's capacity
function findMatch(queue, capacity) {
  // Exact match first, then smaller parties, ordered by join time (already sorted)
  return queue.find(e => e.status === "waiting" && e.party_size <= capacity) || null;
}

export default function HostDashboard() {
  const [tables, setTables] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggest, setSuggest] = useState(null); // { table, match }

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
    const ch1 = supabase.channel("host-tables")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, fetchAll)
      .subscribe();
    const ch2 = supabase.channel("host-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  // ── Actions ──
  const cycleTable = async (table) => {
    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(table.status) + 1) % STATUS_FLOW.length];

    // If going to "libre" and there's someone waiting, show suggestion instead
    if (next === "libre") {
      // First update the table to libre
      await window.fetch("/api/tables", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: table.id, status: "libre" }),
      });
      // Then check for a match
      const match = findMatch(queue, table.capacity);
      if (match) {
        setSuggest({ table: { ...table, status: "libre" }, match });
        return;
      }
      return;
    }

    await window.fetch("/api/tables", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: table.id, status: next }),
    });
  };

  const seatFromSuggestion = async () => {
    if (!suggest) return;
    const { match } = suggest;
    // Notify via WhatsApp + mark as notified
    await notifyAndSeat(match);
    setSuggest(null);
  };

  const notifyOnlyFromSuggestion = async () => {
    if (!suggest) return;
    await doNotify(suggest.match);
    setSuggest(null);
  };

  const doNotify = async (entry) => {
    const phone = entry.customers?.phone;
    const cleanPhone = phone?.replace(/\D/g, "");
    const waitMin = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000);

    await window.fetch("/api/waitlist", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "notified" }),
    });

    if (cleanPhone) {
      try {
        const res = await window.fetch("/api/whatsapp", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: cleanPhone, guestName: entry.guest_name, waitMinutes: waitMin }),
        });
        const data = await res.json();
        if (!data.success) {
          const msg = encodeURIComponent(`Hola ${entry.guest_name}\n\nTu mesa en Chui esta lista.\nAcercate, te esperamos en Loyola 1250.`);
          window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
        }
      } catch {
        const msg = encodeURIComponent(`Hola ${entry.guest_name}\n\nTu mesa en Chui esta lista.\nAcercate, te esperamos en Loyola 1250.`);
        window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
      }
    }
  };

  const notifyAndSeat = async (entry) => {
    await doNotify(entry);
    await window.fetch("/api/waitlist", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "seated" }),
    });
  };

  const setStatus = async (id, status) => {
    await window.fetch("/api/waitlist", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const libre = tables.filter(t => t.status === "libre").length;
  const waiting = queue.filter(q => q.status === "waiting").length;

  if (loading) return <div style={{ minHeight: "100vh", background: H.bg, display: "flex", alignItems: "center", justifyContent: "center", color: H.textLight, fontFamily: f.sans }}>Cargando...</div>;

  return (
    <div style={{ minHeight: "100vh", background: H.bg, fontFamily: f.sans, color: H.text, position: "relative" }}>

      {/* ── SUGGESTION OVERLAY ── */}
      {suggest && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div style={{
            background: H.card, borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "360px",
            border: `1px solid ${H.cardBorder}`, textAlign: "center",
          }}>
            <div style={{ fontSize: "12px", color: H.success, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Mesa {suggest.table.id} libre
            </div>
            <div style={{ fontSize: "13px", color: H.textMed, marginTop: "4px" }}>
              Capacidad: {suggest.table.capacity}
            </div>

            <div style={{ margin: "24px 0", padding: "20px", borderRadius: "14px", background: H.bg, border: `1px solid ${H.cardBorder}` }}>
              <div style={{ fontSize: "22px", fontWeight: "700" }}>{suggest.match.guest_name}</div>
              <div style={{ fontSize: "14px", color: H.textMed, marginTop: "6px" }}>
                {suggest.match.party_size} {suggest.match.party_size === 1 ? "persona" : "personas"} · esperando {ago(suggest.match.joined_at)}
              </div>
              {suggest.match.customers?.allergies?.length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                  {suggest.match.customers.allergies.map(a => (
                    <span key={a} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "#1A0D0D", color: H.danger }}>{a}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={seatFromSuggestion} style={{
                width: "100%", padding: "16px", borderRadius: "14px", background: H.accent,
                color: H.bg, border: "none", fontSize: "16px", fontWeight: "700",
                cursor: "pointer", fontFamily: f.sans,
              }}>Avisar y sentar</button>
              <button onClick={notifyOnlyFromSuggestion} style={{
                width: "100%", padding: "14px", borderRadius: "14px", background: "transparent",
                color: H.success, border: `1.5px solid ${S.libre.border}`, fontSize: "14px", fontWeight: "600",
                cursor: "pointer", fontFamily: f.sans,
              }}>Solo avisar</button>
              <button onClick={() => setSuggest(null)} style={{
                width: "100%", padding: "12px", borderRadius: "14px", background: "transparent",
                color: H.textLight, border: "none", fontSize: "13px",
                cursor: "pointer", fontFamily: f.sans,
              }}>Ignorar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src="/logo-light.png" alt="Chui" style={{ height: "28px", objectFit: "contain" }} />
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: "700", color: H.success }}>{libre}</div>
            <div style={{ fontSize: "10px", color: H.textLight }}>libres</div>
          </div>
          <div style={{ width: "1px", height: "24px", background: H.cardBorder }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: "700" }}>{waiting}</div>
            <div style={{ fontSize: "10px", color: H.textLight }}>en fila</div>
          </div>
        </div>
      </div>

      {/* ── TABLE GRID ── */}
      <div style={{ padding: "0 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          {tables.map(table => {
            const cfg = S[table.status] || S.libre;
            const time = table.seated_at ? ago(table.seated_at) : "";
            return (
              <button key={table.id} onClick={() => cycleTable(table)} style={{
                padding: "16px 6px", borderRadius: "14px", border: `1.5px solid ${cfg.border}`,
                background: cfg.bg, cursor: "pointer", textAlign: "center",
                transition: "all 0.15s", aspectRatio: "1",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: cfg.color, fontFamily: f.display }}>{table.id}</div>
                <div style={{ fontSize: "10px", color: cfg.color, marginTop: "4px", fontWeight: "600", opacity: 0.7 }}>{cfg.label}</div>
                {time && <div style={{ fontSize: "11px", color: H.textMed, marginTop: "3px" }}>{time}</div>}
                {table.waitlist?.guest_name && (
                  <div style={{ fontSize: "10px", color: H.textMed, marginTop: "3px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {table.waitlist.guest_name}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LEGEND ── */}
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", padding: "14px 0", flexWrap: "wrap" }}>
        {Object.entries(S).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: H.textLight }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: v.color }} /> {v.label}
          </div>
        ))}
      </div>

      {/* ── QUEUE ── */}
      {queue.length > 0 && (
        <div style={{ padding: "0 12px 32px" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: H.textLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px", paddingLeft: "4px" }}>
            Fila ({queue.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {queue.map((entry, i) => {
              const c = entry.customers;
              const isNotified = entry.status === "notified";
              const act = ACT[entry.activity] || ACT.esperando;

              return (
                <div key={entry.id} style={{
                  background: H.card, borderRadius: "14px", padding: "16px",
                  border: `1px solid ${H.cardBorder}`,
                  borderLeft: isNotified ? `3px solid ${H.warn}` : `3px solid ${H.cardBorder}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "13px", color: H.textLight }}>#{i+1}</span>
                      <span style={{ fontSize: "16px", fontWeight: "700" }}>{entry.guest_name}</span>
                      <span style={{ fontSize: "13px", color: H.textMed }}>{entry.party_size}p</span>
                      <span style={{ fontSize: "12px", color: H.textLight }}>{ago(entry.joined_at)}</span>
                    </div>
                    <span style={{
                      fontSize: "10px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px",
                      background: `${act.color}18`, color: act.color,
                    }}>{act.label}</span>
                  </div>

                  {/* Allergies inline */}
                  {c?.allergies?.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                      {c.allergies.map(a => (
                        <span key={a} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#1A0D0D", color: H.danger }}>{a}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    {!isNotified && (
                      <button onClick={() => doNotify(entry)} style={{
                        flex: 1, padding: "10px", borderRadius: "10px", background: S.libre.bg,
                        color: H.success, border: `1px solid ${S.libre.border}`, fontSize: "13px", fontWeight: "600",
                        cursor: "pointer", fontFamily: f.sans,
                      }}>Avisar</button>
                    )}
                    <button onClick={() => setStatus(entry.id, "seated")} style={{
                      flex: 1, padding: "10px", borderRadius: "10px", background: H.accent,
                      color: H.bg, border: "none", fontSize: "13px", fontWeight: "600",
                      cursor: "pointer", fontFamily: f.sans,
                    }}>Sentar</button>
                    <button onClick={() => confirm(`Cancelar a ${entry.guest_name}?`) && setStatus(entry.id, "cancelled")} style={{
                      padding: "10px 14px", borderRadius: "10px", background: S.limpiando.bg,
                      color: H.danger, border: `1px solid ${S.limpiando.border}`, fontSize: "13px",
                      cursor: "pointer",
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
