"use client";
import { useState, useEffect, useCallback } from "react";
import { T, f } from "@/lib/tokens";

const STAMPS_FOR_FREE = 10;

const PAYMENT_INFO = {
  mercadopago: { label: "MercadoPago", detail: "Alias: labicha.mp" },
  transferencia: { label: "Transferencia", detail: "CBU: 000000000000 · Alias: labicha.bar" },
  efectivo: { label: "Efectivo", detail: "Pagá en el mostrador" },
};

const CATEGORY_LABELS = {
  birras: "🍺 Birras",
  tragos: "🍸 Tragos",
  comida: "🍔 Comida",
  otros: "📦 Otros",
};

const CATEGORY_ORDER = ["birras", "tragos", "comida", "otros"];

export default function BichaPage() {
  // Views: register, menu, packs, cart, payment, ticket, waiting
  const [view, setView] = useState("register");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+54");
  const [tableSector, setTableSector] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [packs, setPacks] = useState([]);
  const [myPacks, setMyPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("pedir"); // pedir | packs

  // Load returning customer
  useEffect(() => {
    const saved = localStorage.getItem("bicha_customer");
    if (saved) {
      try {
        const c = JSON.parse(saved);
        setName(c.name || "");
        setPhone(c.phone || "");
        setTableSector(c.table || "");
      } catch {}
    }
  }, []);

  // Fetch menu
  useEffect(() => {
    fetch("/api/bicha/menu?available=true")
      .then((r) => r.json())
      .then(setMenuItems)
      .catch(() => {});
  }, []);

  // Fetch packs
  useEffect(() => {
    fetch("/api/bicha/packs?type=available")
      .then((r) => r.json())
      .then(setPacks)
      .catch(() => {});
  }, []);

  const fullPhone = countryCode.replace("+", "") + phone.replace(/\D/g, "");

  // Fetch customer loyalty info
  const fetchCustomer = useCallback(async () => {
    if (!phone) return;
    const res = await fetch(`/api/bicha/customers?phone=${fullPhone}`);
    const data = await res.json();
    if (data && data.id) setCustomer(data);
  }, [fullPhone, phone]);

  // Fetch my packs
  const fetchMyPacks = useCallback(async () => {
    if (!phone) return;
    const res = await fetch(`/api/bicha/packs?phone=${fullPhone}`);
    const data = await res.json();
    if (Array.isArray(data)) setMyPacks(data);
  }, [fullPhone, phone]);

  const handleRegister = async () => {
    if (!name.trim() || !tableSector.trim()) return;
    localStorage.setItem("bicha_customer", JSON.stringify({ name, phone, table: tableSector }));
    await fetchCustomer();
    await fetchMyPacks();
    setView("menu");
  };

  const addToCart = (item) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    const existing = cart.find((c) => c.id === itemId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map((c) => (c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)));
    } else {
      setCart(cart.filter((c) => c.id !== itemId));
    }
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const submitOrder = async () => {
    if (!cart.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bicha/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name,
          phone: phone ? fullPhone : null,
          table_sector: tableSector,
          items: cart.map((c) => ({ name: c.name, price: c.price, quantity: c.quantity })),
        }),
      });
      const data = await res.json();
      setTicket(data);
      setCart([]);
      setView("waiting");
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const purchasePack = async () => {
    if (!selectedPack || !paymentMethod) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bicha/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_id: selectedPack.id,
          guest_name: name,
          phone: fullPhone,
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      setView("payment");
      setTicket(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Poll ticket status
  useEffect(() => {
    if (view !== "waiting" || !ticket?.id) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/bicha/tickets?id=${ticket.id}`);
      const data = await res.json();
      if (data) setTicket(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [view, ticket?.id]);

  // ─── Styles ───
  const page = { minHeight: "100dvh", background: "#0D0D0D", fontFamily: f.sans, color: "#F5F5F5" };
  const container = { maxWidth: 440, margin: "0 auto", padding: "0 16px" };
  const header = {
    textAlign: "center", padding: "40px 0 24px",
    fontFamily: f.display, fontSize: 32, fontWeight: 800,
    background: "linear-gradient(135deg, #F5A623, #E8792B)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    letterSpacing: "-0.5px",
  };
  const subtitle = { textAlign: "center", color: "#999", fontSize: 14, marginTop: -12, marginBottom: 24 };
  const input = {
    width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #333",
    background: "#1A1A1A", color: "#F5F5F5", fontSize: 16, fontFamily: f.sans,
    outline: "none",
  };
  const btnPrimary = {
    width: "100%", padding: "16px", borderRadius: 16, border: "none",
    background: "linear-gradient(135deg, #F5A623, #E8792B)", color: "#fff",
    fontSize: 17, fontWeight: 700, fontFamily: f.display, cursor: "pointer",
    letterSpacing: "-0.3px",
  };
  const btnSecondary = {
    ...btnPrimary, background: "#1A1A1A", border: "1px solid #333",
    color: "#F5A623", fontSize: 15, padding: "12px",
  };
  const card = {
    background: "#1A1A1A", borderRadius: 16, padding: 16,
    border: "1px solid #262626", marginBottom: 12,
  };
  const pill = {
    display: "inline-block", padding: "6px 14px", borderRadius: 20,
    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
  };
  const badge = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
  };

  // ─── REGISTER ───
  if (view === "register") {
    return (
      <div style={page}>
        <div style={container} className="safe-top safe-bottom">
          <div style={header}>La Bicha</div>
          <div style={subtitle}>Pedí desde tu mesa</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
            <input style={input} placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <select
                style={{ ...input, width: 90, padding: "14px 8px" }}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                <option value="+54">+54</option>
                <option value="+598">+598</option>
                <option value="+56">+56</option>
                <option value="+55">+55</option>
              </select>
              <input
                style={{ ...input, flex: 1 }}
                placeholder="WhatsApp (opcional)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <input
              style={input}
              placeholder="Mesa o sector (ej: Mesa 4, Patio, Barra)"
              value={tableSector}
              onChange={(e) => setTableSector(e.target.value)}
            />

            <button
              style={{ ...btnPrimary, opacity: name && tableSector ? 1 : 0.4, marginTop: 8 }}
              disabled={!name || !tableSector}
              onClick={handleRegister}
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MENU + PACKS ───
  if (view === "menu") {
    const grouped = {};
    menuItems.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    return (
      <div style={page}>
        <div style={container} className="safe-top">
          <div style={{ ...header, fontSize: 24, padding: "24px 0 8px" }}>La Bicha</div>
          <div style={{ textAlign: "center", color: "#999", fontSize: 13, marginBottom: 16 }}>
            {tableSector} · {name}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[{ key: "pedir", label: "Pedir" }, { key: "packs", label: "Packs" }, { key: "mis-packs", label: "Mis Packs" }].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  ...pill, flex: 1,
                  background: tab === t.key ? "linear-gradient(135deg, #F5A623, #E8792B)" : "#1A1A1A",
                  color: tab === t.key ? "#fff" : "#999",
                  border: tab === t.key ? "none" : "1px solid #333",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Loyalty bar */}
          {customer && (
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24 }}>🎫</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#999" }}>Tus sellos</div>
                <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                  {Array.from({ length: STAMPS_FOR_FREE }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: i < (customer.stamps_count % STAMPS_FOR_FREE) ? "#F5A623" : "#333",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#fff",
                      }}
                    >
                      {i < (customer.stamps_count % STAMPS_FOR_FREE) ? "★" : ""}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  {customer.stamps_count % STAMPS_FOR_FREE === 0 && customer.stamps_count > 0
                    ? "🎉 ¡Tenés un pedido gratis!"
                    : `${STAMPS_FOR_FREE - (customer.stamps_count % STAMPS_FOR_FREE)} más para uno gratis`}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Pedir */}
          {tab === "pedir" && (
            <>
              {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#F5A623", marginBottom: 10, fontFamily: f.display }}>
                    {CATEGORY_LABELS[cat] || cat}
                  </div>
                  {grouped[cat].map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    return (
                      <div key={item.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</div>
                          {item.description && (
                            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{item.description}</div>
                          )}
                          <div style={{ fontSize: 14, color: "#F5A623", fontWeight: 700, marginTop: 4 }}>
                            ${item.price.toLocaleString("es-AR")}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {inCart && (
                            <>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                style={{
                                  width: 32, height: 32, borderRadius: "50%", border: "1px solid #444",
                                  background: "transparent", color: "#F5A623", fontSize: 18, cursor: "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                −
                              </button>
                              <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{inCart.quantity}</span>
                            </>
                          )}
                          <button
                            onClick={() => addToCart(item)}
                            style={{
                              width: 32, height: 32, borderRadius: "50%", border: "none",
                              background: "#F5A623", color: "#000", fontSize: 18, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Floating cart button */}
              {cartCount > 0 && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "#0D0D0Dee", borderTop: "1px solid #262626" }} className="safe-bottom">
                  <button onClick={submitOrder} disabled={loading} style={{ ...btnPrimary, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{loading ? "Enviando..." : `Pedir (${cartCount})`}</span>
                    <span>${cartTotal.toLocaleString("es-AR")}</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* TAB: Packs */}
          {tab === "packs" && (
            <>
              <div style={{ fontSize: 13, color: "#777", marginBottom: 16 }}>
                Comprá packs y canjealos cuando quieras. Las docenas incluyen 1h de ping pong 🏓
              </div>
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  onClick={() => { setSelectedPack(pack); setView("pack-checkout"); }}
                  style={{ ...card, cursor: "pointer", transition: "border-color 0.2s", borderColor: selectedPack?.id === pack.id ? "#F5A623" : "#262626" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{pack.name}</div>
                      <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{pack.description}</div>
                      {pack.includes_pingpong && (
                        <div style={{ ...badge, background: "#F5A62320", color: "#F5A623", marginTop: 6 }}>
                          🏓 +1h ping pong
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>
                      ${pack.price.toLocaleString("es-AR")}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* TAB: Mis Packs */}
          {tab === "mis-packs" && (
            <>
              {myPacks.length === 0 ? (
                <div style={{ textAlign: "center", color: "#666", padding: 40, fontSize: 14 }}>
                  No tenés packs activos
                </div>
              ) : (
                myPacks.map((p) => (
                  <div key={p.id} style={card}>
                    <div style={{ fontWeight: 700 }}>{p.bicha_packs?.name}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                      <div style={{ ...badge, background: p.payment_status === "confirmed" ? "#2D7A4F30" : "#F5A62330", color: p.payment_status === "confirmed" ? "#2D7A4F" : "#F5A623" }}>
                        {p.payment_status === "confirmed" ? "✓ Confirmado" : "⏳ Pago pendiente"}
                      </div>
                      <div style={{ ...badge, background: "#333", color: "#F5F5F5" }}>
                        {p.remaining} restantes
                      </div>
                    </div>
                    {p.pingpong_available && (
                      <div style={{ ...badge, background: "#F5A62320", color: "#F5A623", marginTop: 8 }}>
                        🏓 Ping pong disponible
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          <div style={{ height: cartCount > 0 ? 100 : 40 }} />
        </div>
      </div>
    );
  }

  // ─── PACK CHECKOUT ───
  if (view === "pack-checkout" && selectedPack) {
    return (
      <div style={page}>
        <div style={container} className="safe-top safe-bottom">
          <button onClick={() => { setView("menu"); setPaymentMethod(null); }} style={{ background: "none", border: "none", color: "#F5A623", fontSize: 14, cursor: "pointer", padding: "24px 0 16px" }}>
            ← Volver
          </button>

          <div style={{ ...card, textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display }}>{selectedPack.name}</div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>{selectedPack.description}</div>
            {selectedPack.includes_pingpong && (
              <div style={{ ...badge, background: "#F5A62320", color: "#F5A623", marginTop: 10 }}>
                🏓 Incluye 1h de ping pong gratis
              </div>
            )}
            <div style={{ fontSize: 28, fontWeight: 800, color: "#F5A623", marginTop: 16, fontFamily: f.display }}>
              ${selectedPack.price.toLocaleString("es-AR")}
            </div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>Elegí cómo pagar</div>

          {Object.entries(PAYMENT_INFO).map(([key, info]) => (
            <div
              key={key}
              onClick={() => setPaymentMethod(key)}
              style={{
                ...card, cursor: "pointer",
                borderColor: paymentMethod === key ? "#F5A623" : "#262626",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${paymentMethod === key ? "#F5A623" : "#444"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {paymentMethod === key && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F5A623" }} />}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{info.label}</div>
                <div style={{ fontSize: 12, color: "#777" }}>{info.detail}</div>
              </div>
            </div>
          ))}

          <button
            onClick={purchasePack}
            disabled={!paymentMethod || loading}
            style={{ ...btnPrimary, marginTop: 20, opacity: paymentMethod ? 1 : 0.4 }}
          >
            {loading ? "Procesando..." : "Confirmar compra"}
          </button>
        </div>
      </div>
    );
  }

  // ─── PAYMENT CONFIRMATION (pack) ───
  if (view === "payment" && ticket) {
    const info = PAYMENT_INFO[ticket.payment_method];
    return (
      <div style={page}>
        <div style={container} className="safe-top safe-bottom">
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48 }}>⏳</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: f.display, marginTop: 12 }}>Esperando pago</div>
            <div style={{ color: "#999", fontSize: 14, marginTop: 8 }}>
              Tu pack "{ticket.bicha_packs?.name}" está reservado
            </div>

            <div style={{ ...card, marginTop: 24, textAlign: "left" }}>
              <div style={{ fontSize: 13, color: "#999" }}>Método de pago</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{info?.label}</div>
              <div style={{ fontSize: 14, color: "#F5A623", marginTop: 4 }}>{info?.detail}</div>
            </div>

            <div style={{ color: "#666", fontSize: 13, marginTop: 16 }}>
              El staff va a confirmar tu pago.
              {phone && " Te avisamos por WhatsApp cuando esté confirmado."}
            </div>

            <button
              onClick={() => { setView("menu"); setTab("mis-packs"); fetchMyPacks(); }}
              style={{ ...btnSecondary, marginTop: 24 }}
            >
              Volver al menú
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── WAITING / TICKET STATUS ───
  if (view === "waiting" && ticket) {
    const ticketNum = String(ticket.ticket_number).padStart(3, "0");
    const statusColors = {
      pending: { bg: "#333", color: "#999", label: "En cola" },
      preparing: { bg: "#F5A62330", color: "#F5A623", label: "Preparando" },
      ready: { bg: "#2D7A4F30", color: "#2D7A4F", label: "¡Listo!" },
      delivered: { bg: "#2D7A4F30", color: "#2D7A4F", label: "Entregado" },
    };
    const s = statusColors[ticket.status] || statusColors.pending;

    return (
      <div style={page}>
        <div style={container} className="safe-top safe-bottom">
          <div style={{ textAlign: "center", paddingTop: 50 }}>
            {ticket.status === "ready" ? (
              <div style={{ fontSize: 64, animation: "pulse 1.5s ease-in-out infinite" }}>🔥</div>
            ) : (
              <div style={{ fontSize: 64 }}>{ticket.status === "preparing" ? "👨‍🍳" : "🎫"}</div>
            )}

            <div style={{
              fontSize: 56, fontWeight: 800, fontFamily: f.display, marginTop: 16,
              background: "linear-gradient(135deg, #F5A623, #E8792B)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              #{ticketNum}
            </div>

            <div style={{ ...badge, ...{ background: s.bg, color: s.color }, justifyContent: "center", padding: "8px 20px", fontSize: 15, fontWeight: 700, marginTop: 16 }}>
              {s.label}
            </div>

            {ticket.status === "pending" && (
              <div style={{ color: "#999", fontSize: 14, marginTop: 16 }}>
                Tiempo estimado: ~{ticket.estimated_minutes} min
              </div>
            )}

            <div style={{ ...card, marginTop: 24, textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>Tu pedido</div>
              {(ticket.items_json || []).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < ticket.items_json.length - 1 ? "1px solid #262626" : "none" }}>
                  <span>{item.quantity}x {item.name}</span>
                  <span style={{ color: "#F5A623" }}>${(item.price * item.quantity).toLocaleString("es-AR")}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontWeight: 700, fontSize: 16, borderTop: "1px solid #333", marginTop: 8 }}>
                <span>Total</span>
                <span style={{ color: "#F5A623" }}>${ticket.total?.toLocaleString("es-AR")}</span>
              </div>
            </div>

            <div style={{ color: "#666", fontSize: 13, marginTop: 16 }}>
              📍 {ticket.table_sector}
              {phone && " · Te avisamos por WhatsApp"}
            </div>

            <button
              onClick={() => { setView("menu"); setTab("pedir"); setTicket(null); }}
              style={{ ...btnSecondary, marginTop: 24 }}
            >
              Hacer otro pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
