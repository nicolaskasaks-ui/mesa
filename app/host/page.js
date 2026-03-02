"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const trustLabels = ["Nuevo", "Verificado", "Confiable", "★ Habitual"];
const trustColors = ["#9B9B9B", "#2D7A4F", "#1A6B3C", "#D4842A"];

function timeSince(date) {
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

export default function HostDashboard() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ waiting: 0, notified: 0, seated: 0 });

  // ── Fetch & subscribe ──
  useEffect(() => {
    if (!supabase) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("waitlist")
        .select("*, customers(name, phone, allergies, visit_count, trust_level)")
        .in("status", ["waiting", "notified", "extended"])
        .order("joined_at", { ascending: true });
      if (data) {
        setQueue(data);
        setStats({
          waiting: data.filter(r => r.status === "waiting").length,
          notified: data.filter(r => r.status === "notified").length,
          seated: 0,
        });
      }
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("host-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => {
        fetch(); // refresh on any change
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Actions ──
  const updateStatus = async (id, status) => {
    await window.fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const notifyWhatsApp = (entry) => {
    const phone = entry.customers?.phone;
    if (!phone) {
      alert("Este cliente no dejó número de WhatsApp.\nPodés llamarlo por nombre.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const waitMin = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000);
    const msg = encodeURIComponent(
      `¡Hola ${entry.guest_name}! 🌿\n\n` +
      `Tu mesa en *Chuí* está lista.\n` +
      `Acercate cuando puedas, te esperamos en Loyola 1250.\n\n` +
      `Gracias por esperar${waitMin > 5 ? ` (${waitMin} min)` : ""} 🙏`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    updateStatus(entry.id, "notified");
  };

  const seatCustomer = (entry) => {
    updateStatus(entry.id, "seated");
  };

  const cancelCustomer = (entry) => {
    if (confirm(`¿Cancelar a ${entry.guest_name}?`)) {
      updateStatus(entry.id, "cancelled");
    }
  };

  // ── UI ──
  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a", padding: "20px", fontFamily: f.sans, color: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo-light.png" alt="Chuí" style={{ height: "36px", borderRadius: "6px", objectFit: "contain" }} />
            <span style={{ fontSize: "14px", color: "#666" }}>Hostess</span>
          </div>
          <div style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: T.accent }}>{stats.waiting}</div>
            <div style={{ fontSize: "11px", color: "#888" }}>Esperan</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: T.warn }}>{stats.notified}</div>
            <div style={{ fontSize: "11px", color: "#888" }}>Avisados</div>
          </div>
        </div>
      </div>

      {/* Queue */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Cargando...</div>
      ) : queue.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🪑</div>
          <div style={{ fontSize: "18px", color: "#888" }}>Sin espera — todas las mesas disponibles</div>
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
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700" }}>
                      <span style={{ color: T.accent, marginRight: "8px" }}>#{i+1}</span>
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

                {/* Allergies */}
                {customer?.allergies?.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {customer.allergies.map(a => (
                      <span key={a} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "#3a2020", color: "#e88" }}>
                        ⚠️ {a}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {entry.notes && (
                  <div style={{ marginTop: "6px", fontSize: "13px", color: "#aaa", fontStyle: "italic" }}>
                    💬 {entry.notes}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  {!isNotified && (
                    <button onClick={() => notifyWhatsApp(entry)} style={{
                      flex: 1, padding: "10px", borderRadius: "10px", background: "#1a3a1a",
                      color: T.accent, border: "none", fontSize: "14px", fontWeight: "600",
                      cursor: "pointer", fontFamily: f.sans,
                    }}>📲 Avisar</button>
                  )}
                  <button onClick={() => seatCustomer(entry)} style={{
                    flex: 1, padding: "10px", borderRadius: "10px", background: T.accent,
                    color: "#fff", border: "none", fontSize: "14px", fontWeight: "600",
                    cursor: "pointer", fontFamily: f.sans,
                  }}>✓ Sentar</button>
                  <button onClick={() => cancelCustomer(entry)} style={{
                    padding: "10px 14px", borderRadius: "10px", background: "#3a1a1a",
                    color: "#e55", border: "none", fontSize: "14px", cursor: "pointer",
                  }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
