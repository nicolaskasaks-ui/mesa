"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const trustLabels = ["Nuevo", "Verificado", "Confiable", "★ Habitual"];
const trustColors = ["#9B9B9B", "#2D7A4F", "#1A6B3C", "#D4842A"];

const STATUS_FLOW = ["libre", "sentado", "pidio_cuenta", "limpiando"];
const STATUS_CONFIG = {
  libre:        { label: "Libre",        color: "#2D7A4F", bg: "#1a2e1a", emoji: "🟢" },
  sentado:      { label: "Sentado",      color: "#60A0FF", bg: "#1a2030", emoji: "🔵" },
  pidio_cuenta: { label: "Pidió cuenta", color: "#E8A735", bg: "#2a2a1a", emoji: "🟡" },
  limpiando:    { label: "Limpiando",    color: "#D93B3B", bg: "#2a1a1a", emoji: "🔴" },
};

function timeSince(date) {
  if (!date) return "";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
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
      setNotification({ name: data.notified.guest_name, phone: data.notified.customers?.phone, id: data.notified.id });
      setTimeout(() => setNotification(null), 15000);
    }
  };

  const updateWaitlistStatus = async (id, status) => {
    await window.fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const notifyWhatsApp = (entry) => {
    const phone = entry.customers?.phone;
    if (!phone) { alert("Sin número de WhatsApp"); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    const waitMin = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000);
    const msg = encodeURIComponent(
      `¡Hola ${entry.guest_name}! 🌿\n\nTu mesa en *Chuí* está lista.\nAcercate cuando puedas, te esperamos en Loyola 1250.\n\nGracias por esperar${waitMin > 5 ? ` (${waitMin} min)` : ""} 🙏`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    updateWaitlistStatus(entry.id, "notified");
  };

  const whatsAppFromNotification = () => {
    if (!notification?.phone) return;
    const cleanPhone = notification.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`¡Hola ${notification.name}! 🌿\n\nTu mesa en *Chuí* está lista.\nAcercate, te esperamos en Loyola 1250. 🙏`);
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
    <div style={{ minHeight: "100vh", background: "#1a1a1a", fontFamily: f.sans, color: "#fff" }}>

      {notification && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "linear-gradient(135deg, #1a3a1a 0%, #2a4a2a 100%)",
          padding: "16px 20px", display: "flex", alignItems: "center",
          justifyContent: "space-between", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: T.accent }}>
              🔔 Mesa libre — {notification.name} avisado/a
            </div>
            <div style={{ fontSize: "13px", color: "#aaa", marginTop: "2px" }}>
              {notification.phone ? "Tocá para enviar WhatsApp" : "Llamar por nombre"}
            </div>
          </div>
          {notification.phone && (
            <button onClick={whatsAppFromNotification} style={{
              padding: "10px 16px", borderRadius: "10px", background: "#25D366",
              color: "#fff", border: "none", fontSize: "14px", fontWeight: "600",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>📲 WhatsApp</button>
          )}
        </div>
      )}

      <div style={{ padding: "20px", paddingTop: notification ? "80px" : "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img src="/logo-light.png" alt="Chuí" style={{ height: "36px", borderRadius: "6px", objectFit: "contain" }} />
              <span style={{ fontSize: "14px", color: "#666" }}>Hostess</span>
            </div>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>
              {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: "700", color: cfg.color }}>{stats[key] || 0}</div>
                <div style={{ fontSize: "10px", color: "#666" }}>{cfg.emoji}</div>
              </div>
            ))}
            <div style={{ textAlign: "center", borderLeft: "1px solid #333", paddingLeft: "10px" }}>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#fff" }}>{stats.waiting}</div>
              <div style={{ fontSize: "10px", color: "#666" }}>⏳</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
          {[
            { key: "tables", label: `🪑 Mesas (${tables.length})` },
            { key: "queue", label: `⏳ Fila (${queue.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "10px", borderRadius: "10px", fontSize: "14px", fontWeight: "600",
              background: tab === t.key ? "#333" : "transparent", color: tab === t.key ? "#fff" : "#666",
              border: "none", cursor: "pointer", fontFamily: f.sans,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Cargando...</div>
      ) : (
        <div style={{ padding: "0 20px 40px" }}>

          {tab === "tables" && (
            <>
              <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                {[{ key: "all", label: "Todas" }, { key: "interior", label: "Interior" }, { key: "jardin", label: "Jardín" }].map(z => (
                  <button key={z.key} onClick={() => setZoneFilter(z.key)} style={{
                    padding: "6px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "500",
                    background: zoneFilter === z.key ? "#333" : "transparent",
                    color: zoneFilter === z.key ? "#fff" : "#666",
                    border: "1px solid #333", cursor: "pointer", fontFamily: f.sans,
                  }}>{z.label}</button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px" }}>
                {filteredTables.map(table => {
                  const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.libre;
                  const time = table.seated_at ? timeSince(table.seated_at) : "";
                  return (
                    <button key={table.id} onClick={() => cycleTableStatus(table)} style={{
                      padding: "12px 8px", borderRadius: "12px", border: `2px solid ${cfg.color}40`,
                      background: cfg.bg, cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                    }}>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: cfg.color }}>{table.id}</div>
                      <div style={{ fontSize: "10px", color: cfg.color, marginTop: "2px", opacity: 0.8 }}>{cfg.label}</div>
                      <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>👤{table.capacity}</div>
                      {time && <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>⏱ {time}</div>}
                      {table.combined_with && (
                        <div style={{ fontSize: "9px", color: "#E8A735", marginTop: "2px" }}>🔗 {table.combined_with}</div>
                      )}
                      {table.waitlist?.guest_name && (
                        <div style={{ fontSize: "10px", color: "#aaa", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {table.waitlist.guest_name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#888" }}>
                    <span style={{ color: cfg.color }}>{cfg.emoji}</span> {cfg.label}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#555" }}>
                Tocá una mesa para cambiar su estado →
              </div>
            </>
          )}

          {tab === "queue" && (
            queue.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>🪑</div>
                <div style={{ fontSize: "18px", color: "#888" }}>Sin espera</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {queue.map((entry, i) => {
                  const customer = entry.customers;
                  const trust = customer?.trust_level || 0;
                  const isNotified = entry.status === "notified";
                  return (
                    <div key={entry.id} style={{
                      background: isNotified ? "#2a2a1a" : "#252525", borderRadius: "14px", padding: "16px",
                      borderLeft: isNotified ? `3px solid ${T.warn}` : `3px solid ${T.accent}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: "16px", fontWeight: "700" }}>
                            <span style={{ color: T.accent, marginRight: "8px" }}>#{i + 1}</span>
                            {entry.guest_name}
                          </div>
                          <div style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>
                            🪑 {entry.party_size} · ⏱ {timeSince(entry.joined_at)}
                            {customer?.phone && <span> · 📱</span>}
                          </div>
                        </div>
                        <span style={{
                          fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "8px",
                          background: isNotified ? "#443" : "#333",
                          color: isNotified ? T.warn : trustColors[trust],
                        }}>
                          {isNotified ? "🔔 Avisado" : trustLabels[trust]}
                        </span>
                      </div>
                      {customer?.allergies?.length > 0 && (
                        <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {customer.allergies.map(a => (
                            <span key={a} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "#3a2020", color: "#e88" }}>
                              ⚠️ {a}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        {!isNotified && (
                          <button onClick={() => notifyWhatsApp(entry)} style={{
                            flex: 1, padding: "10px", borderRadius: "10px", background: "#1a3a1a",
                            color: T.accent, border: "none", fontSize: "14px", fontWeight: "600",
                            cursor: "pointer", fontFamily: f.sans,
                          }}>📲 Avisar</button>
                        )}
                        <button onClick={() => updateWaitlistStatus(entry.id, "seated")} style={{
                          flex: 1, padding: "10px", borderRadius: "10px", background: T.accent,
                          color: "#fff", border: "none", fontSize: "14px", fontWeight: "600",
                          cursor: "pointer", fontFamily: f.sans,
                        }}>✓ Sentar</button>
                        <button onClick={() => {
                          if (confirm(`¿Cancelar a ${entry.guest_name}?`))
                            updateWaitlistStatus(entry.id, "cancelled");
                        }} style={{
                          padding: "10px 14px", borderRadius: "10px", background: "#3a1a1a",
                          color: "#e55", border: "none", fontSize: "14px", cursor: "pointer",
                        }}>✕</button>
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
