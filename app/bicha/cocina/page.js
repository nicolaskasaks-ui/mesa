"use client";
import { useState, useEffect, useCallback } from "react";
import { T, f } from "@/lib/tokens";

const PIN = "1234";

const STATUS_FLOW = ["pending", "preparing", "ready", "delivered"];
const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "#999", bg: "#333", emoji: "🎫", next: "preparing", nextLabel: "Preparar" },
  preparing: { label: "Preparando", color: "#F5A623", bg: "#F5A62320", emoji: "👨‍🍳", next: "ready", nextLabel: "¡Listo!" },
  ready: { label: "Listo", color: "#2D7A4F", bg: "#2D7A4F30", emoji: "🔥", next: "delivered", nextLabel: "Entregado" },
  delivered: { label: "Entregado", color: "#666", bg: "#1A1A1A", emoji: "✅", next: null, nextLabel: null },
  cancelled: { label: "Cancelado", color: "#B83B3B", bg: "#B83B3B20", emoji: "❌", next: null, nextLabel: null },
};

export default function CocinaPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("active"); // active | all
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [packPurchases, setPackPurchases] = useState([]);
  const [showPacks, setShowPacks] = useState(false);

  // Manual ticket fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTable, setNewTable] = useState("");
  const [newItems, setNewItems] = useState("");
  const [newEstimate, setNewEstimate] = useState(15);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("bicha_cocina_auth") === "1") {
      setAuthed(true);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    const res = await fetch("/api/bicha/tickets");
    const data = await res.json();
    if (Array.isArray(data)) setTickets(data);
  }, []);

  const fetchPacks = useCallback(async () => {
    const res = await fetch("/api/bicha/packs");
    const data = await res.json();
    if (Array.isArray(data)) setPackPurchases(data);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchTickets();
    fetchPacks();
    const interval = setInterval(() => { fetchTickets(); fetchPacks(); }, 10000);
    return () => clearInterval(interval);
  }, [authed, fetchTickets, fetchPacks]);

  const handleLogin = () => {
    if (pin === PIN) {
      setAuthed(true);
      sessionStorage.setItem("bicha_cocina_auth", "1");
    }
  };

  const updateStatus = async (id, newStatus) => {
    await fetch("/api/bicha/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    fetchTickets();
  };

  const confirmPack = async (purchaseId) => {
    await fetch("/api/bicha/packs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: purchaseId, action: "confirm_payment" }),
    });
    fetchPacks();
  };

  const redeemPack = async (purchaseId) => {
    await fetch("/api/bicha/packs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: purchaseId, action: "redeem" }),
    });
    fetchPacks();
  };

  const redeemPingpong = async (purchaseId) => {
    await fetch("/api/bicha/packs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: purchaseId, action: "redeem_pingpong" }),
    });
    fetchPacks();
  };

  const createManualTicket = async () => {
    if (!newName || !newTable) return;
    const items = newItems
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, price: 0, quantity: 1 }));

    await fetch("/api/bicha/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest_name: newName,
        phone: newPhone || null,
        table_sector: newTable,
        items: items.length ? items : [{ name: "Pedido mostrador", price: 0, quantity: 1 }],
        estimated_minutes: newEstimate,
      }),
    });
    setShowNewTicket(false);
    setNewName(""); setNewPhone(""); setNewTable(""); setNewItems("");
    fetchTickets();
  };

  const page = { minHeight: "100dvh", background: "#0D0D0D", fontFamily: f.sans, color: "#F5F5F5" };
  const container = { maxWidth: 600, margin: "0 auto", padding: "0 16px" };
  const input = {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #333",
    background: "#1A1A1A", color: "#F5F5F5", fontSize: 15, fontFamily: f.sans, outline: "none",
  };
  const btnPrimary = {
    padding: "12px 20px", borderRadius: 14, border: "none",
    background: "linear-gradient(135deg, #F5A623, #E8792B)", color: "#fff",
    fontSize: 15, fontWeight: 700, fontFamily: f.display, cursor: "pointer",
  };
  const card = {
    background: "#1A1A1A", borderRadius: 16, padding: 16,
    border: "1px solid #262626", marginBottom: 12,
  };
  const pill = {
    display: "inline-block", padding: "6px 14px", borderRadius: 20,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };

  // ─── PIN ───
  if (!authed) {
    return (
      <div style={page}>
        <div style={{ ...container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display, color: "#F5A623" }}>Cocina · La Bicha</div>
          <input
            style={{ ...input, maxWidth: 200, textAlign: "center", letterSpacing: 8 }}
            type="password" maxLength={4} placeholder="PIN"
            value={pin} onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button onClick={handleLogin} style={btnPrimary}>Entrar</button>
        </div>
      </div>
    );
  }

  const activeTickets = tickets.filter((t) => ["pending", "preparing", "ready"].includes(t.status));
  const deliveredTickets = tickets.filter((t) => t.status === "delivered");
  const displayTickets = filter === "active" ? activeTickets : tickets;

  const pendingPacks = packPurchases.filter((p) => p.payment_status === "pending");

  return (
    <div style={page}>
      <div style={container} className="safe-top safe-bottom">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0" }}>
          <div style={{ fontFamily: f.display, fontSize: 22, fontWeight: 800, color: "#F5A623" }}>
            Cocina
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowPacks(!showPacks)} style={{ ...pill, background: showPacks ? "#F5A623" : "#1A1A1A", color: showPacks ? "#000" : "#999", border: "1px solid #333", position: "relative" }}>
              Packs
              {pendingPacks.length > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#B83B3B", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {pendingPacks.length}
                </span>
              )}
            </button>
            <button onClick={() => setShowNewTicket(true)} style={{ ...pill, background: "#F5A623", color: "#000", border: "none" }}>
              + Ticket
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Pendientes", count: tickets.filter((t) => t.status === "pending").length, color: "#999" },
            { label: "Preparando", count: tickets.filter((t) => t.status === "preparing").length, color: "#F5A623" },
            { label: "Listos", count: tickets.filter((t) => t.status === "ready").length, color: "#2D7A4F" },
            { label: "Entregados", count: deliveredTickets.length, color: "#666" },
          ].map((s) => (
            <div key={s.label} style={{ ...card, flex: 1, textAlign: "center", padding: "10px 6px", marginBottom: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: f.display }}>{s.count}</div>
              <div style={{ fontSize: 10, color: "#777" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["active", "all"].map((f2) => (
            <button key={f2} onClick={() => setFilter(f2)} style={{ ...pill, background: filter === f2 ? "#F5A623" : "#1A1A1A", color: filter === f2 ? "#000" : "#999", border: `1px solid ${filter === f2 ? "#F5A623" : "#333"}` }}>
              {f2 === "active" ? "Activos" : "Todos"}
            </button>
          ))}
        </div>

        {/* Packs section */}
        {showPacks && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F5A623", marginBottom: 10 }}>Packs pendientes de pago</div>
            {pendingPacks.length === 0 ? (
              <div style={{ ...card, color: "#666", textAlign: "center" }}>Sin packs pendientes</div>
            ) : (
              pendingPacks.map((p) => (
                <div key={p.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.guest_name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{p.bicha_packs?.name} · {p.payment_method}</div>
                  </div>
                  <button onClick={() => confirmPack(p.id)} style={{ ...pill, background: "#2D7A4F", color: "#fff", border: "none" }}>
                    ✓ Confirmar
                  </button>
                </div>
              ))
            )}

            <div style={{ fontSize: 15, fontWeight: 700, color: "#F5A623", marginTop: 20, marginBottom: 10 }}>Packs confirmados (hoy)</div>
            {packPurchases.filter((p) => p.payment_status === "confirmed").map((p) => (
              <div key={p.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.guest_name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{p.bicha_packs?.name} · {p.remaining} restantes</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {p.remaining > 0 && (
                      <button onClick={() => redeemPack(p.id)} style={{ ...pill, background: "#F5A623", color: "#000", border: "none", fontSize: 12 }}>
                        -1 Canjear
                      </button>
                    )}
                    {p.pingpong_available && (
                      <button onClick={() => redeemPingpong(p.id)} style={{ ...pill, background: "#333", color: "#F5A623", border: "1px solid #F5A623", fontSize: 12 }}>
                        🏓
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tickets */}
        {displayTickets.map((ticket) => {
          const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.pending;
          const ticketNum = String(ticket.ticket_number).padStart(3, "0");
          const time = new Date(ticket.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
          const elapsed = Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 60000);

          return (
            <div key={ticket.id} style={{ ...card, borderColor: ticket.status === "ready" ? "#2D7A4F" : ticket.status === "preparing" ? "#F5A623" : "#262626" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display, color: st.color }}>
                      #{ticketNum}
                    </span>
                    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                      {st.emoji} {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{ticket.guest_name}</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                    📍 {ticket.table_sector} · {time} · {elapsed}min
                  </div>
                </div>
                {st.next && (
                  <button
                    onClick={() => updateStatus(ticket.id, st.next)}
                    style={{
                      ...pill,
                      background: st.next === "ready" ? "#2D7A4F" : st.next === "preparing" ? "#F5A623" : "#333",
                      color: st.next === "preparing" ? "#000" : "#fff",
                      border: "none", fontSize: 13,
                    }}
                  >
                    {st.nextLabel}
                  </button>
                )}
              </div>

              {/* Items */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #262626" }}>
                {(ticket.items_json || []).map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", padding: "2px 0" }}>
                    {item.quantity}x {item.name}
                    {item.price > 0 && <span style={{ color: "#777" }}> · ${(item.price * item.quantity).toLocaleString("es-AR")}</span>}
                  </div>
                ))}
                {ticket.total > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#F5A623", marginTop: 4 }}>
                    Total: ${ticket.total.toLocaleString("es-AR")}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {displayTickets.length === 0 && (
          <div style={{ textAlign: "center", color: "#666", padding: 60, fontSize: 14 }}>
            No hay tickets {filter === "active" ? "activos" : "hoy"}
          </div>
        )}

        {/* New ticket modal */}
        {showNewTicket && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}
            className="glass-overlay"
            onClick={() => setShowNewTicket(false)}
          >
            <div
              style={{ background: "#111", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500 }}
              className="bottom-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: f.display, color: "#F5A623", marginBottom: 16 }}>
                Nuevo ticket manual
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input style={input} placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input style={input} placeholder="WhatsApp (opcional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <input style={input} placeholder="Mesa / sector" value={newTable} onChange={(e) => setNewTable(e.target.value)} />
                <input style={input} placeholder="Items (separados por coma)" value={newItems} onChange={(e) => setNewItems(e.target.value)} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#999" }}>Estimado:</span>
                  <input
                    style={{ ...input, width: 80, textAlign: "center" }}
                    type="number" min="5" max="60"
                    value={newEstimate} onChange={(e) => setNewEstimate(parseInt(e.target.value) || 15)}
                  />
                  <span style={{ fontSize: 13, color: "#999" }}>min</span>
                </div>
                <button
                  onClick={createManualTicket}
                  disabled={!newName || !newTable}
                  style={{ ...btnPrimary, width: "100%", opacity: newName && newTable ? 1 : 0.4 }}
                >
                  Crear ticket
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
