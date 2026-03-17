"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { f, APP_NAME } from "../../lib/tokens";

// Host dashboard uses its own dark palette
const H = {
  bg: "#111111",
  card: "#1A1A1A",
  cardBorder: "#2A2A2A",
  text: "#FFFFFF",
  textMed: "#999999",
  textLight: "#666666",
  accent: "#FFFFFF",
  success: "#3DA66A",
  warn: "#D4942A",
  danger: "#C93B3B",
};

const trustLabels = ["Nuevo", "Verificado", "Confiable", "Habitual"];
const trustColors = ["#666", "#3DA66A", "#2D8A5F", "#D4942A"];

const STATUS_FLOW = ["libre", "sentado", "pidio_cuenta", "limpiando"];
const STATUS_CONFIG = {
  libre:        { label: "Libre",        color: "#3DA66A", bg: "#162016", border: "#2A3D2A" },
  sentado:      { label: "Sentado",      color: "#6EA8E0", bg: "#161E28", border: "#2A3444" },
  pidio_cuenta: { label: "Cuenta",       color: "#E8A735", bg: "#221E14", border: "#3A3220" },
  limpiando:    { label: "Limpiando",    color: "#D06060", bg: "#221616", border: "#3A2020" },
};

const ACTIVITY_CONFIG = {
  esperando: { label: "Esperando", color: H.textMed },
  en_barra:  { label: "En barra",  color: "#3DA66A" },
  paseando:  { label: "Paseando",  color: "#6EA8E0" },
};

function timeSince(date) {
  if (!date) return "";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

function distanceColor(d) {
  if (d === null || d === undefined) return H.textLight;
  if (d < 300) return "#3DA66A";
  if (d <= 800) return "#E8A735";
  return "#D06060";
}

export default function HostDashboard() {
  const [tab, setTab] = useState("tables");
  const [tables, setTables] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [zoneFilter, setZoneFilter] = useState("all");

  const fetchAll = async () => {
    if (!supabase) return;
    const [tablesRes, queueRes] = await Promise.all([
      supabase.from("tables").select("*, waitlist(guest_name, party_size)").order("id"),
      supabase.from("waitlist")
        .select("*, customers(name, phone, allergies, visit_count, trust_level)")
        .in("status", ["waiting", "notified", "extended"])
        .order("joined_at", { ascending: true }),
    ]);
    if (tablesRes.data) setTables(tablesRes.data);
    if (queueRes.data) setQueue(queueRes.data);
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
    const interval = setInterval(() => setTables(t => [...t]), 30000);
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); clearInterval(interval); };
  }, []);

  const cycleTableStatus = async (table) => {
    const currentIdx = STATUS_FLOW.indexOf(table.status);
    const nextStatus = STATUS_FLOW[(currentIdx + 1) % STATUS_FLOW.length];
    const res = await window.fetch("/api/tables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: table.id, status: nextStatus }),
    });
    const data = await res.json();
    if (data.notified) {
      setNotification({
        name: data.notified.guest_name,
        phone: data.notified.customers?.phone,
        id: data.notified.id,
        sent: data.whatsappSent === true,
      });
      setTimeout(() => setNotification(null), data.whatsappSent ? 8000 : 15000);
    }
  };

  const updateWaitlistStatus = async (id, status) => {
    await window.fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const notifyWhatsApp = async (entry) => {
    const phone = entry.customers?.phone;
    if (!phone) { alert("Sin numero de WhatsApp"); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    const waitMin = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000);

    try {
      const res = await window.fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: cleanPhone, guestName: entry.guest_name, waitMinutes: waitMin }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ name: entry.guest_name, phone, id: entry.id, sent: true });
        setTimeout(() => setNotification(null), 8000);
      } else {
        // Fallback: open wa.me
        const msg = encodeURIComponent(`Hola ${entry.guest_name}\n\nTu mesa en Chui esta lista.\nAcercate cuando puedas, te esperamos en Loyola 1250.\n\nGracias por esperar${waitMin > 5 ? ` (${waitMin} min)` : ""}`);
        window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
      }
    } catch {
      const msg = encodeURIComponent(`Hola ${entry.guest_name}\n\nTu mesa en Chui esta lista.\nAcercate cuando puedas, te esperamos en Loyola 1250.`);
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    }
    updateWaitlistStatus(entry.id, "notified");
  };

  const whatsAppFromNotification = async () => {
    if (!notification?.phone) return;
    const cleanPhone = notification.phone.replace(/\D/g, "");
    try {
      const res = await window.fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: cleanPhone, guestName: notification.name, waitMinutes: 0 }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(prev => prev ? { ...prev, sent: true } : null);
        setTimeout(() => setNotification(null), 5000);
        return;
      }
    } catch {}
    const msg = encodeURIComponent(`Hola ${notification.name}\n\nTu mesa en Chui esta lista.\nAcercate, te esperamos en Loyola 1250.`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
  };

  const stats = {
    libre: tables.filter(t => t.status === "libre").length,
    sentado: tables.filter(t => t.status === "sentado").length,
    pidio_cuenta: tables.filter(t => t.status === "pidio_cuenta").length,
    limpiando: tables.filter(t => t.status === "limpiando").length,
    waiting: queue.filter(q => q.status === "waiting").length,
  };

  const filteredTables = zoneFilter === "all" ? tables : tables.filter(t => t.zone === zoneFilter);

  return (
    <div style={{ minHeight: "100vh", background: H.bg, fontFamily: f.sans, color: H.text }}>

      {/* Notification banner */}
      {notification && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: notification.sent ? "#162016" : "#1A1A1A",
          padding: "16px 20px", display: "flex", alignItems: "center",
          justifyContent: "space-between", borderBottom: `1px solid ${notification.sent ? "#2A3D2A" : "#333"}`,
        }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: notification.sent ? H.success : H.text }}>
              {notification.sent ? `WhatsApp enviado a ${notification.name}` : `Mesa libre — ${notification.name}`}
            </div>
            <div style={{ fontSize: "13px", color: H.textMed, marginTop: "2px" }}>
              {notification.sent ? "Mensaje automatico confirmado" : notification.phone ? "Toca para enviar WhatsApp" : "Llamar por nombre"}
            </div>
          </div>
          {notification.phone && !notification.sent && (
            <button onClick={whatsAppFromNotification} style={{
              padding: "10px 20px", borderRadius: "10px", background: H.success,
              color: "#fff", border: "none", fontSize: "14px", fontWeight: "600",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>WhatsApp</button>
          )}
        </div>
      )}

      <div style={{ padding: "20px", paddingTop: notification ? "80px" : "20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img src="/logo-light.png" alt="Chui" style={{ height: "32px", borderRadius: "6px", objectFit: "contain" }} />
              <span style={{ fontSize: "12px", color: H.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>Hostess</span>
            </div>
            <div style={{ fontSize: "12px", color: H.textLight, marginTop: "6px" }}>
              {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: "700", color: cfg.color }}>{stats[key] || 0}</div>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color, margin: "4px auto 0" }} />
              </div>
            ))}
            <div style={{ textAlign: "center", borderLeft: `1px solid ${H.cardBorder}`, paddingLeft: "12px" }}>
              <div style={{ fontSize: "20px", fontWeight: "700", color: H.text }}>{stats.waiting}</div>
              <div style={{ fontSize: "10px", color: H.textLight, marginTop: "4px" }}>fila</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: H.card, borderRadius: "12px", padding: "4px" }}>
          {[
            { key: "tables", label: `Mesas (${tables.length})` },
            { key: "queue", label: `Fila (${queue.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: "600",
              background: tab === t.key ? H.accent : "transparent", color: tab === t.key ? H.bg : H.textLight,
              border: "none", cursor: "pointer", fontFamily: f.sans, transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: H.textLight }}>Cargando...</div>
      ) : (
        <div style={{ padding: "0 20px 40px" }}>

          {/* TABLES TAB */}
          {tab === "tables" && (
            <>
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                {[{ key: "all", label: "Todas" }, { key: "interior", label: "Interior" }, { key: "jardin", label: "Jardin" }].map(z => (
                  <button key={z.key} onClick={() => setZoneFilter(z.key)} style={{
                    padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "500",
                    background: zoneFilter === z.key ? H.accent : "transparent",
                    color: zoneFilter === z.key ? H.bg : H.textLight,
                    border: zoneFilter === z.key ? "none" : `1px solid ${H.cardBorder}`,
                    cursor: "pointer", fontFamily: f.sans, transition: "all 0.15s",
                  }}>{z.label}</button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px" }}>
                {filteredTables.map(table => {
                  const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.libre;
                  const time = table.seated_at ? timeSince(table.seated_at) : "";
                  return (
                    <button key={table.id} onClick={() => cycleTableStatus(table)} style={{
                      padding: "14px 8px", borderRadius: "12px", border: `1px solid ${cfg.border}`,
                      background: cfg.bg, cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                    }}>
                      <div style={{ fontSize: "18px", fontWeight: "700", color: cfg.color }}>{table.id}</div>
                      <div style={{ fontSize: "10px", color: cfg.color, marginTop: "2px", opacity: 0.7 }}>{cfg.label}</div>
                      <div style={{ fontSize: "10px", color: H.textLight, marginTop: "2px" }}>Cap {table.capacity}</div>
                      {time && <div style={{ fontSize: "11px", color: H.textMed, marginTop: "2px" }}>{time}</div>}
                      {table.combined_with && (
                        <div style={{ fontSize: "9px", color: H.warn, marginTop: "2px" }}>+ {table.combined_with}</div>
                      )}
                      {table.waitlist?.guest_name && (
                        <div style={{ fontSize: "10px", color: H.textMed, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {table.waitlist.guest_name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: "14px", justifyContent: "center", marginTop: "18px", flexWrap: "wrap" }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: H.textLight }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color, display: "inline-block" }} /> {cfg.label}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: H.textLight }}>
                Toca una mesa para cambiar su estado
              </div>
            </>
          )}

          {/* QUEUE TAB */}
          {tab === "queue" && (
            queue.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "12px", color: H.textLight, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>sin espera</div>
                <div style={{ fontSize: "18px", color: H.textMed }}>La fila esta vacia</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {queue.map((entry, i) => {
                  const customer = entry.customers;
                  const trust = customer?.trust_level || 0;
                  const visits = customer?.visit_count || 1;
                  const isNotified = entry.status === "notified";
                  const activity = ACTIVITY_CONFIG[entry.activity] || ACTIVITY_CONFIG.esperando;
                  const dist = entry.distance_m;

                  return (
                    <div key={entry.id} style={{
                      background: H.card, borderRadius: "14px", padding: "18px",
                      borderLeft: isNotified ? `3px solid ${H.warn}` : `3px solid ${H.cardBorder}`,
                      border: `1px solid ${H.cardBorder}`,
                    }}>
                      {/* Row 1: Name + trust */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: H.textLight, fontWeight: "500" }}>#{i + 1}</span>
                            <span>{entry.guest_name}</span>
                            {visits > 1 && (
                              <span style={{ fontSize: "12px", fontWeight: "600", color: H.warn }}>x{visits}</span>
                            )}
                          </div>
                          <div style={{ fontSize: "13px", color: H.textMed, marginTop: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                            <span>{entry.party_size} pers</span>
                            <span style={{ color: H.textLight }}>·</span>
                            <span>{timeSince(entry.joined_at)}</span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "8px",
                          background: isNotified ? "#221E14" : H.card,
                          color: isNotified ? H.warn : trustColors[trust],
                          border: `1px solid ${isNotified ? "#3A3220" : H.cardBorder}`,
                        }}>
                          {isNotified ? "Avisado" : trustLabels[trust]}
                        </span>
                      </div>

                      {/* Row 2: Activity + distance */}
                      <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
                        <span style={{
                          fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px",
                          background: `${activity.color}15`, color: activity.color,
                        }}>
                          {activity.label}
                        </span>
                        {dist !== null && dist !== undefined && (
                          <span style={{ fontSize: "12px", fontWeight: "600", color: distanceColor(dist) }}>
                            {dist}m
                          </span>
                        )}
                      </div>

                      {/* Allergies */}
                      {customer?.allergies?.length > 0 && (
                        <div style={{ marginTop: "10px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {customer.allergies.map(a => (
                            <span key={a} style={{
                              fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                              background: "#221616", color: "#D06060", border: "1px solid #3A2020",
                            }}>
                              {a}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                        {!isNotified && (
                          <button onClick={() => notifyWhatsApp(entry)} style={{
                            flex: 1, padding: "12px", borderRadius: "10px", background: "#162016",
                            color: H.success, border: `1px solid #2A3D2A`, fontSize: "14px", fontWeight: "600",
                            cursor: "pointer", fontFamily: f.sans,
                          }}>Avisar</button>
                        )}
                        <button onClick={() => updateWaitlistStatus(entry.id, "seated")} style={{
                          flex: 1, padding: "12px", borderRadius: "10px", background: H.accent,
                          color: H.bg, border: "none", fontSize: "14px", fontWeight: "600",
                          cursor: "pointer", fontFamily: f.sans,
                        }}>Sentar</button>
                        <button onClick={() => {
                          if (confirm(`Cancelar a ${entry.guest_name}?`))
                            updateWaitlistStatus(entry.id, "cancelled");
                        }} style={{
                          padding: "12px 16px", borderRadius: "10px", background: "#221616",
                          color: H.danger, border: `1px solid #3A2020`, fontSize: "14px", cursor: "pointer",
                        }}>x</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
