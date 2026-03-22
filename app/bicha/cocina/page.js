"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { f } from "../../../lib/tokens";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "#999", bg: "#333", emoji: "🎫", next: "preparing", nextLabel: "Preparar" },
  preparing: { label: "Preparando", color: "#F5A623", bg: "#F5A62320", emoji: "👨‍🍳", next: "ready", nextLabel: "¡Listo!" },
  ready: { label: "Listo", color: "#2D7A4F", bg: "#2D7A4F30", emoji: "🔥", next: "delivered", nextLabel: "Entregado" },
  delivered: { label: "Entregado", color: "#666", bg: "#1A1A1A", emoji: "✅", next: null, nextLabel: null },
  cancelled: { label: "Cancelado", color: "#B83B3B", bg: "#B83B3B20", emoji: "❌", next: null, nextLabel: null },
};

const GAME_LABELS = { pingpong: "🏓 Ping Pong", pool: "🎱 Pool", metegol: "⚽ Metegol" };

// Play notification sound + vibrate
function notifyNewTicket() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "sine";
      gain2.gain.value = 0.3;
      osc2.start();
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    }, 150);
  } catch {}
}

export default function CocinaPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [tickets, setTickets] = useState([]);
  const prevTicketCountRef = useRef(0);
  const [filter, setFilter] = useState("active");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [packPurchases, setPackPurchases] = useState([]);
  const [showPacks, setShowPacks] = useState(false);
  const [walletTopups, setWalletTopups] = useState([]);
  const [showWallet, setShowWallet] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannedPack, setScannedPack] = useState(null);
  const [scanMsg, setScanMsg] = useState(null);

  // Manual ticket fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTable, setNewTable] = useState("");
  const [newItems, setNewItems] = useState("");
  const [newEstimate, setNewEstimate] = useState(15);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("bicha_cocina_auth") === "1") setAuthed(true);
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/bicha/tickets");
      const data = await res.json();
      if (Array.isArray(data)) {
        const pendingCount = data.filter((t) => t.status === "pending").length;
        if (prevTicketCountRef.current > 0 && pendingCount > prevTicketCountRef.current) {
          notifyNewTicket();
        }
        prevTicketCountRef.current = pendingCount;
        setTickets(data);
      }
    } catch {}
  }, []);

  const fetchPacks = useCallback(async () => {
    const res = await fetch("/api/bicha/packs");
    const data = await res.json();
    if (Array.isArray(data)) setPackPurchases(data);
  }, []);

  const fetchWalletTopups = useCallback(async () => {
    const res = await fetch("/api/bicha/wallet?pending=true");
    const data = await res.json();
    if (Array.isArray(data)) setWalletTopups(data);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchTickets();
    fetchPacks();
    fetchWalletTopups();
    const interval = setInterval(() => { fetchTickets(); fetchPacks(); fetchWalletTopups(); }, 10000);
    return () => clearInterval(interval);
  }, [authed, fetchTickets, fetchPacks, fetchWalletTopups]);

  const [authError, setAuthError] = useState("");

  const handleLogin = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/bicha/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) { setAuthed(true); sessionStorage.setItem("bicha_cocina_auth", "1"); }
      else setAuthError("PIN incorrecto");
    } catch { setAuthError("Error de conexión"); }
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

  const lookupCode = async (code) => {
    const clean = code.replace("BICHA:", "").trim().toUpperCase();
    if (clean.length < 4) return;
    const res = await fetch(`/api/bicha/packs?code=${clean}`);
    if (!res.ok) {
      setScanMsg("Código no encontrado");
      setScannedPack(null);
      return;
    }
    const data = await res.json();
    setScannedPack(data);
    setScanMsg(null);
  };

  const redeemFromScan = async (action) => {
    if (!scannedPack) return;
    await fetch("/api/bicha/packs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: scannedPack.redeem_code, action }),
    });
    setScanMsg(action === "redeem" ? "✅ Unidad canjeada" : "✅ Juego canjeado");
    // Re-fetch the pack
    const res = await fetch(`/api/bicha/packs?code=${scannedPack.redeem_code}`);
    if (res.ok) setScannedPack(await res.json());
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

  const redeemGame = async (purchaseId) => {
    await fetch("/api/bicha/packs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: purchaseId, action: "redeem_game" }),
    });
    fetchPacks();
  };

  const confirmTopup = async (txId) => {
    await fetch("/api/bicha/wallet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId, action: "confirm" }),
    });
    fetchWalletTopups();
  };

  const rejectTopup = async (txId) => {
    await fetch("/api/bicha/wallet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId, action: "reject" }),
    });
    fetchWalletTopups();
  };

  const createManualTicket = async () => {
    if (!newName || !newTable) return;
    const items = newItems.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name, price: 0, quantity: 1 }));
    await fetch("/api/bicha/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest_name: newName, phone: newPhone || null, table_sector: newTable,
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
  const pillS = {
    display: "inline-block", padding: "6px 14px", borderRadius: 20,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };

  if (!authed) {
    return (
      <div style={page}>
        <div style={{ ...container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display, color: "#F5A623" }}>Cocina · La Bicha</div>
          <input style={{ ...input, maxWidth: 200, textAlign: "center", letterSpacing: 8 }} type="password" maxLength={4} placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          <button onClick={handleLogin} style={btnPrimary}>Entrar</button>
        </div>
      </div>
    );
  }

  // ─── SCAN MODE ───
  if (scanMode) {
    return (
      <div style={page}>
        <div style={container} className="safe-top safe-bottom">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0" }}>
            <div style={{ fontFamily: f.display, fontSize: 22, fontWeight: 800, color: "#F5A623" }}>Canjear Pack</div>
            <button onClick={() => { setScanMode(false); setScannedPack(null); setManualCode(""); setScanMsg(null); }} style={{ ...pillS, background: "#333", color: "#999", border: "none" }}>
              ← Volver
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#777", marginBottom: 16 }}>
            Ingresá el código que muestra el cliente
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              style={{ ...input, flex: 1, letterSpacing: 4, fontSize: 20, textAlign: "center", textTransform: "uppercase" }}
              placeholder="CÓDIGO"
              maxLength={6}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && lookupCode(manualCode)}
            />
            <button onClick={() => lookupCode(manualCode)} style={{ ...btnPrimary, width: "auto", padding: "12px 24px" }}>
              Buscar
            </button>
          </div>

          {scanMsg && !scannedPack && (
            <div style={{ textAlign: "center", color: "#B83B3B", padding: 20 }}>{scanMsg}</div>
          )}

          {scanMsg && scannedPack && (
            <div style={{ textAlign: "center", color: "#2D7A4F", padding: "8px 0", fontSize: 14, fontWeight: 700 }}>
              {scanMsg}
            </div>
          )}

          {scannedPack && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{scannedPack.guest_name}</div>
                  <div style={{ fontSize: 13, color: "#999", marginTop: 2 }}>{scannedPack.bicha_packs?.name}</div>
                  <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
                    Código: <span style={{ color: "#F5A623", fontWeight: 700, letterSpacing: 2 }}>{scannedPack.redeem_code}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    background: scannedPack.payment_status === "confirmed" ? "#2D7A4F30" : "#F5A62330",
                    color: scannedPack.payment_status === "confirmed" ? "#2D7A4F" : "#F5A623",
                  }}>
                    {scannedPack.payment_status === "confirmed" ? "Pagado" : "Sin pagar"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 16, padding: "12px 0", borderTop: "1px solid #262626" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>{scannedPack.remaining}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>Restantes</div>
                </div>
                {scannedPack.game_available && (
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 20 }}>{GAME_LABELS[scannedPack.game_type] || "🎮"}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Juego disponible</div>
                  </div>
                )}
              </div>

              {scannedPack.payment_status === "confirmed" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {scannedPack.remaining > 0 && (
                    <button onClick={() => redeemFromScan("redeem")} style={{ ...btnPrimary, flex: 1, fontSize: 14 }}>
                      Canjear 1 unidad
                    </button>
                  )}
                  {scannedPack.game_available && (
                    <button onClick={() => redeemFromScan("redeem_game")} style={{ ...pillS, flex: 1, background: "#333", color: "#F5A623", border: "1px solid #F5A623", textAlign: "center", padding: "12px" }}>
                      🎮 Canjear juego
                    </button>
                  )}
                </div>
              )}

              {scannedPack.payment_status !== "confirmed" && (
                <button onClick={() => { confirmPack(scannedPack.id); lookupCode(scannedPack.redeem_code); }} style={{ ...btnPrimary, width: "100%", marginTop: 12, background: "#2D7A4F" }}>
                  ✓ Confirmar pago
                </button>
              )}
            </div>
          )}
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
          <div style={{ fontFamily: f.display, fontSize: 22, fontWeight: 800, color: "#F5A623" }}>Cocina</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setScanMode(true)} style={{ ...pillS, background: "#2D7A4F", color: "#fff", border: "none" }}>
              📱 Canjear
            </button>
            <button onClick={() => setShowPacks(!showPacks)} style={{ ...pillS, background: showPacks ? "#F5A623" : "#1A1A1A", color: showPacks ? "#000" : "#999", border: "1px solid #333", position: "relative" }}>
              Packs
              {pendingPacks.length > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#B83B3B", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingPacks.length}</span>
              )}
            </button>
            <button onClick={() => setShowWallet(!showWallet)} style={{ ...pillS, background: showWallet ? "#F5A623" : "#1A1A1A", color: showWallet ? "#000" : "#999", border: "1px solid #333", position: "relative" }}>
              Wallet
              {walletTopups.length > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#B83B3B", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{walletTopups.length}</span>
              )}
            </button>
            <button onClick={() => setShowNewTicket(true)} style={{ ...pillS, background: "#F5A623", color: "#000", border: "none" }}>
              + Ticket
            </button>
          </div>
        </div>

        {/* Stats */}
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
            <button key={f2} onClick={() => setFilter(f2)} style={{ ...pillS, background: filter === f2 ? "#F5A623" : "#1A1A1A", color: filter === f2 ? "#000" : "#999", border: `1px solid ${filter === f2 ? "#F5A623" : "#333"}` }}>
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
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {p.bicha_packs?.name} · {p.payment_method}
                      {p.redeem_code && <span style={{ color: "#F5A623" }}> · {p.redeem_code}</span>}
                    </div>
                  </div>
                  <button onClick={() => confirmPack(p.id)} style={{ ...pillS, background: "#2D7A4F", color: "#fff", border: "none" }}>
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
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {p.bicha_packs?.name} · {p.remaining} restantes
                      {p.redeem_code && <span style={{ color: "#666" }}> · {p.redeem_code}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {p.remaining > 0 && (
                      <button onClick={() => redeemPack(p.id)} style={{ ...pillS, background: "#F5A623", color: "#000", border: "none", fontSize: 12 }}>
                        -1
                      </button>
                    )}
                    {p.game_available && (
                      <button onClick={() => redeemGame(p.id)} style={{ ...pillS, background: "#333", color: "#F5A623", border: "1px solid #F5A623", fontSize: 12 }}>
                        {GAME_LABELS[p.game_type] || "🎮"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Wallet top-ups section */}
        {showWallet && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F5A623", marginBottom: 10 }}>Cargas de wallet pendientes</div>
            {walletTopups.length === 0 ? (
              <div style={{ ...card, color: "#666", textAlign: "center" }}>Sin cargas pendientes</div>
            ) : (
              walletTopups.map((tx) => (
                <div key={tx.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{tx.bicha_wallets?.name || tx.phone}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      ${Number(tx.amount).toLocaleString("es-AR")} · {tx.payment_method}
                    </div>
                    <div style={{ fontSize: 11, color: "#666" }}>
                      {new Date(tx.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => confirmTopup(tx.id)} style={{ ...pillS, background: "#2D7A4F", color: "#fff", border: "none" }}>
                      ✓
                    </button>
                    <button onClick={() => rejectTopup(tx.id)} style={{ ...pillS, background: "#B83B3B", color: "#fff", border: "none" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
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
                    <span style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display, color: st.color }}>#{ticketNum}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                      {st.emoji} {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{ticket.guest_name}</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>📍 {ticket.table_sector} · {time} · {elapsed}min</div>
                </div>
                {st.next && (
                  <button onClick={() => updateStatus(ticket.id, st.next)} style={{
                    ...pillS,
                    background: st.next === "ready" ? "#2D7A4F" : st.next === "preparing" ? "#F5A623" : "#333",
                    color: st.next === "preparing" ? "#000" : "#fff",
                    border: "none", fontSize: 13,
                  }}>
                    {st.nextLabel}
                  </button>
                )}
              </div>
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
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }} className="glass-overlay" onClick={() => setShowNewTicket(false)}>
            <div style={{ background: "#111", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500 }} className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: f.display, color: "#F5A623", marginBottom: 16 }}>Nuevo ticket manual</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input style={input} placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input style={input} placeholder="WhatsApp (opcional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <input style={input} placeholder="Mesa / sector" value={newTable} onChange={(e) => setNewTable(e.target.value)} />
                <input style={input} placeholder="Items (separados por coma)" value={newItems} onChange={(e) => setNewItems(e.target.value)} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#999" }}>Estimado:</span>
                  <input style={{ ...input, width: 80, textAlign: "center" }} type="number" min="5" max="60" value={newEstimate} onChange={(e) => setNewEstimate(parseInt(e.target.value) || 15)} />
                  <span style={{ fontSize: 13, color: "#999" }}>min</span>
                </div>
                <button onClick={createManualTicket} disabled={!newName || !newTable} style={{ ...btnPrimary, width: "100%", opacity: newName && newTable ? 1 : 0.4 }}>
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
