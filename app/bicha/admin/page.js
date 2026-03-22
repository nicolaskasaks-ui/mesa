"use client";
import { useState, useEffect, useCallback } from "react";
import { f } from "../../../lib/tokens";

const CATEGORIES = ["birras", "tragos", "comida", "otros"];
const PACK_CATEGORIES = ["birras", "empanadas", "fernets"];
const GAME_OPTIONS = [
  { value: "", label: "Sin juego" },
  { value: "pingpong", label: "Ping Pong" },
  { value: "pool", label: "Pool" },
  { value: "metegol", label: "Metegol" },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("menu"); // menu | packs | customers | stats
  const [menuItems, setMenuItems] = useState([]);
  const [packs, setPacks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [stats, setStats] = useState(null);

  // Form fields (shared for menu + packs)
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState("birras");
  const [formDescription, setFormDescription] = useState("");
  const [formUnits, setFormUnits] = useState(3);
  const [formGame, setFormGame] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("bicha_admin_auth") === "1") setAuthed(true);
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch("/api/bicha/menu");
      const data = await res.json();
      if (Array.isArray(data)) setMenuItems(data);
    } catch {}
  }, []);

  const fetchPacks = useCallback(async () => {
    try {
      const res = await fetch("/api/bicha/packs-admin");
      const data = await res.json();
      if (Array.isArray(data)) setPacks(data);
    } catch {}
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/bicha/customers");
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [ticketsRes, packsRes] = await Promise.all([
        fetch("/api/bicha/tickets"),
        fetch("/api/bicha/packs"),
      ]);
      const tickets = await ticketsRes.json();
      const packPurchases = await packsRes.json();
      const t = Array.isArray(tickets) ? tickets : [];
      const p = Array.isArray(packPurchases) ? packPurchases : [];

      const delivered = t.filter((x) => x.status === "delivered");
      const cancelled = t.filter((x) => x.status === "cancelled");
      const revenue = delivered.reduce((sum, x) => sum + (x.total || 0), 0);
      const avgWait = delivered.length > 0
        ? Math.round(delivered.reduce((sum, x) => {
            const created = new Date(x.created_at).getTime();
            const ready = x.ready_at ? new Date(x.ready_at).getTime() : created;
            return sum + (ready - created) / 60000;
          }, 0) / delivered.length)
        : 0;
      const confirmedPacks = p.filter((x) => x.payment_status === "confirmed");
      const packRevenue = confirmedPacks.reduce((sum, x) => sum + (x.bicha_packs?.price || 0), 0);

      setStats({
        totalTickets: t.length,
        delivered: delivered.length,
        cancelled: cancelled.length,
        pending: t.filter((x) => x.status === "pending").length,
        preparing: t.filter((x) => x.status === "preparing").length,
        revenue,
        avgWait,
        totalPacks: p.length,
        confirmedPacks: confirmedPacks.length,
        packRevenue,
        totalCustomers: customers.length,
      });
    } catch {}
  }, [customers.length]);

  useEffect(() => {
    if (!authed) return;
    fetchMenu();
    fetchPacks();
    fetchCustomers();
  }, [authed, fetchMenu, fetchPacks, fetchCustomers]);

  useEffect(() => {
    if (authed && tab === "stats") fetchStats();
  }, [authed, tab, fetchStats]);

  const handleLogin = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/bicha/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) { setAuthed(true); sessionStorage.setItem("bicha_admin_auth", "1"); }
      else setAuthError("PIN incorrecto");
    } catch { setAuthError("Error de conexion"); }
  };

  const resetForm = () => {
    setFormName(""); setFormPrice(""); setFormCategory("birras");
    setFormDescription(""); setFormUnits(3); setFormGame("");
    setEditing(null); setShowForm(false);
  };

  // ─── Menu CRUD ───
  const saveMenuItem = async () => {
    if (!formName || !formPrice) return;
    const body = { name: formName, price: parseFloat(formPrice), category: formCategory, description: formDescription };
    if (editing) body.id = editing.id;
    await fetch("/api/bicha/menu", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    resetForm();
    fetchMenu();
  };

  const toggleAvailable = async (item) => {
    await fetch("/api/bicha/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, available: !item.available }),
    });
    fetchMenu();
  };

  const deleteItem = async (id) => {
    await fetch(`/api/bicha/menu?id=${id}`, { method: "DELETE" });
    fetchMenu();
  };

  // ─── Pack CRUD ───
  const savePack = async () => {
    if (!formName || !formPrice) return;
    const body = {
      name: formName,
      price: parseFloat(formPrice),
      category: formCategory,
      description: formDescription,
      units: parseInt(formUnits) || 3,
      includes_game: !!formGame,
      game_type: formGame || null,
    };
    if (editing) body.id = editing.id;
    await fetch("/api/bicha/packs-admin", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    resetForm();
    fetchPacks();
  };

  const togglePackActive = async (pack) => {
    await fetch("/api/bicha/packs-admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pack.id, active: !pack.active }),
    });
    fetchPacks();
  };

  const deletePack = async (id) => {
    await fetch(`/api/bicha/packs-admin?id=${id}`, { method: "DELETE" });
    fetchPacks();
  };

  const editItem = (item) => {
    setFormName(item.name);
    setFormPrice(String(item.price));
    setFormCategory(item.category);
    setFormDescription(item.description || "");
    setEditing(item);
    setShowForm(true);
  };

  const editPack = (pack) => {
    setFormName(pack.name);
    setFormPrice(String(pack.price));
    setFormCategory(pack.category);
    setFormDescription(pack.description || "");
    setFormUnits(pack.units);
    setFormGame(pack.game_type || "");
    setEditing(pack);
    setShowForm(true);
  };

  // ─── Styles ───
  const page = { minHeight: "100dvh", background: "#0D0D0D", fontFamily: f.sans, color: "#F5F5F5" };
  const container = { maxWidth: 600, margin: "0 auto", padding: "0 16px" };
  const input = {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #333",
    background: "#1A1A1A", color: "#F5F5F5", fontSize: 15, fontFamily: f.sans, outline: "none",
  };
  const btnPrimary = {
    padding: "12px 20px", borderRadius: 14, border: "none",
    background: "linear-gradient(135deg, #F5A623, #E8792B)", color: "#fff",
    fontSize: 15, fontWeight: 700, fontFamily: f.display, cursor: "pointer", width: "100%",
  };
  const card = {
    background: "#1A1A1A", borderRadius: 16, padding: 14,
    border: "1px solid #262626", marginBottom: 10,
  };
  const pillStyle = {
    display: "inline-block", padding: "6px 14px", borderRadius: 20,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };
  const statCard = {
    ...card, flex: 1, textAlign: "center", padding: "16px 8px", marginBottom: 0,
  };

  if (!authed) {
    return (
      <div style={page}>
        <div style={{ ...container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display, color: "#F5A623" }}>Admin La Bicha</div>
          <input
            style={{ ...input, maxWidth: 200, textAlign: "center", letterSpacing: 8 }}
            type="password" maxLength={4} placeholder="PIN"
            value={pin} onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {authError && <div style={{ color: "#B83B3B", fontSize: 13 }}>{authError}</div>}
          <button onClick={handleLogin} style={{ ...btnPrimary, maxWidth: 200 }}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={container} className="safe-top safe-bottom">
        <div style={{ fontFamily: f.display, fontSize: 22, fontWeight: 800, color: "#F5A623", padding: "20px 0 12px" }}>
          Admin
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "menu", label: "Menu" },
            { key: "packs", label: "Packs" },
            { key: "customers", label: "Clientes" },
            { key: "stats", label: "Stats" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); resetForm(); }}
              style={{ ...pillStyle, flex: 1, background: tab === t.key ? "#F5A623" : "#1A1A1A", color: tab === t.key ? "#000" : "#999", border: `1px solid ${tab === t.key ? "#F5A623" : "#333"}` }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── MENU TAB ─── */}
        {tab === "menu" && (
          <>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ ...pillStyle, background: "#F5A623", color: "#000", border: "none", marginBottom: 16 }}>
              + Agregar item
            </button>

            {showForm && (
              <div style={{ ...card, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editing ? "Editar" : "Nuevo"} item</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input style={input} placeholder="Nombre" value={formName} onChange={(e) => setFormName(e.target.value)} />
                  <input style={input} placeholder="Precio" type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                  <select style={input} value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input style={input} placeholder="Descripcion (opcional)" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveMenuItem} style={{ ...btnPrimary, flex: 1 }}>Guardar</button>
                    <button onClick={resetForm} style={{ ...btnPrimary, flex: 1, background: "#333" }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {CATEGORIES.map((cat) => {
              const items = menuItems.filter((i) => i.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F5A623", marginBottom: 8, textTransform: "capitalize" }}>{cat}</div>
                  {items.map((item) => (
                    <div key={item.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: item.available ? 1 : 0.5 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                        <div style={{ fontSize: 13, color: "#F5A623" }}>${item.price?.toLocaleString("es-AR")}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleAvailable(item)} style={{ ...pillStyle, background: item.available ? "#2D7A4F30" : "#333", color: item.available ? "#2D7A4F" : "#999", border: "none", fontSize: 11 }}>
                          {item.available ? "ON" : "OFF"}
                        </button>
                        <button onClick={() => editItem(item)} style={{ ...pillStyle, background: "#333", color: "#999", border: "none", fontSize: 11 }}>
                          Edit
                        </button>
                        <button onClick={() => deleteItem(item.id)} style={{ ...pillStyle, background: "#B83B3B20", color: "#B83B3B", border: "none", fontSize: 11 }}>
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ─── PACKS TAB ─── */}
        {tab === "packs" && (
          <>
            <button onClick={() => { resetForm(); setFormCategory("birras"); setShowForm(true); }} style={{ ...pillStyle, background: "#F5A623", color: "#000", border: "none", marginBottom: 16 }}>
              + Nuevo pack
            </button>

            {showForm && (
              <div style={{ ...card, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editing ? "Editar" : "Nuevo"} pack</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input style={input} placeholder="Nombre (ej: Trio de Birras)" value={formName} onChange={(e) => setFormName(e.target.value)} />
                  <input style={input} placeholder="Precio" type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                  <select style={input} value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {PACK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input style={input} placeholder="Descripcion" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>Unidades</div>
                      <input style={input} type="number" min="1" max="50" value={formUnits} onChange={(e) => setFormUnits(parseInt(e.target.value) || 3)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>Juego gratis</div>
                      <select style={input} value={formGame} onChange={(e) => setFormGame(e.target.value)}>
                        {GAME_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={savePack} style={{ ...btnPrimary, flex: 1 }}>Guardar</button>
                    <button onClick={resetForm} style={{ ...btnPrimary, flex: 1, background: "#333" }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {packs.map((pack) => (
              <div key={pack.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: pack.active ? 1 : 0.45 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{pack.name}</div>
                  <div style={{ fontSize: 12, color: "#999" }}>{pack.description}</div>
                  <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                    {pack.units} uds · {pack.category}
                    {pack.includes_game && ` · ${pack.game_type || "juego"}`}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>
                    ${pack.price?.toLocaleString("es-AR")}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => togglePackActive(pack)} style={{ ...pillStyle, background: pack.active ? "#2D7A4F30" : "#333", color: pack.active ? "#2D7A4F" : "#999", border: "none", fontSize: 11, padding: "4px 10px" }}>
                      {pack.active ? "ON" : "OFF"}
                    </button>
                    <button onClick={() => editPack(pack)} style={{ ...pillStyle, background: "#333", color: "#999", border: "none", fontSize: 11, padding: "4px 10px" }}>
                      Edit
                    </button>
                    <button onClick={() => deletePack(pack.id)} style={{ ...pillStyle, background: "#B83B3B20", color: "#B83B3B", border: "none", fontSize: 11, padding: "4px 10px" }}>
                      X
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {packs.length === 0 && <div style={{ textAlign: "center", color: "#666", padding: 40 }}>Sin packs</div>}
          </>
        )}

        {/* ─── CUSTOMERS TAB ─── */}
        {tab === "customers" && (
          <>
            <div style={{ fontSize: 13, color: "#777", marginBottom: 16 }}>
              {customers.length} clientes registrados
            </div>
            {customers.map((c) => (
              <div key={c.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{c.phone}</div>
                    {c.last_visit && (
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                        Ultima: {new Date(c.last_visit).toLocaleDateString("es-AR")}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#F5A623" }}>{c.stamps_count || 0} sellos</div>
                    <div style={{ fontSize: 11, color: "#777" }}>{c.total_orders || 0} pedidos</div>
                  </div>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div style={{ textAlign: "center", color: "#666", padding: 40 }}>Sin clientes aun</div>
            )}
          </>
        )}

        {/* ─── STATS TAB ─── */}
        {tab === "stats" && (
          <>
            <div style={{ fontSize: 13, color: "#777", marginBottom: 16 }}>
              Resumen del dia
            </div>
            {stats ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={statCard}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>{stats.delivered}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Entregados</div>
                  </div>
                  <div style={statCard}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#999", fontFamily: f.display }}>{stats.pending + stats.preparing}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>En proceso</div>
                  </div>
                  <div style={statCard}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#B83B3B", fontFamily: f.display }}>{stats.cancelled}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Cancelados</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={statCard}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#2D7A4F", fontFamily: f.display }}>${stats.revenue.toLocaleString("es-AR")}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Revenue pedidos</div>
                  </div>
                  <div style={statCard}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#2D7A4F", fontFamily: f.display }}>${stats.packRevenue.toLocaleString("es-AR")}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Revenue packs</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={statCard}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>{stats.avgWait} min</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Espera promedio</div>
                  </div>
                  <div style={statCard}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>{stats.confirmedPacks}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>Packs vendidos</div>
                  </div>
                </div>

                <div style={{ ...card, marginTop: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#2D7A4F", fontFamily: f.display }}>
                    ${(stats.revenue + stats.packRevenue).toLocaleString("es-AR")}
                  </div>
                  <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>Revenue total del dia</div>
                </div>

                <button onClick={fetchStats} style={{ ...btnPrimary, marginTop: 16, background: "#333", border: "1px solid #444" }}>
                  Actualizar stats
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", color: "#666", padding: 40 }}>Cargando...</div>
            )}
          </>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
