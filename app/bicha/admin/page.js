"use client";
import { useState, useEffect, useCallback } from "react";
import { f } from "@/lib/tokens";

const PIN = "1234";
const CATEGORIES = ["birras", "tragos", "comida", "otros"];
const PACK_CATEGORIES = ["birras", "empanadas", "fernets"];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState("menu"); // menu | packs | customers
  const [menuItems, setMenuItems] = useState([]);
  const [packs, setPacks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState("birras");
  const [formDescription, setFormDescription] = useState("");
  // Pack form
  const [formUnits, setFormUnits] = useState(3);
  const [formPingpong, setFormPingpong] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("bicha_admin_auth") === "1") setAuthed(true);
  }, []);

  const fetchMenu = useCallback(async () => {
    const res = await fetch("/api/bicha/menu");
    const data = await res.json();
    if (Array.isArray(data)) setMenuItems(data);
  }, []);

  const fetchPacks = useCallback(async () => {
    const res = await fetch("/api/bicha/packs?type=available");
    const data = await res.json();
    if (Array.isArray(data)) setPacks(data);
  }, []);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch("/api/bicha/customers");
    const data = await res.json();
    if (Array.isArray(data)) setCustomers(data);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchMenu();
    fetchPacks();
    fetchCustomers();
  }, [authed, fetchMenu, fetchPacks, fetchCustomers]);

  const handleLogin = () => {
    if (pin === PIN) { setAuthed(true); sessionStorage.setItem("bicha_admin_auth", "1"); }
  };

  const resetForm = () => {
    setFormName(""); setFormPrice(""); setFormCategory("birras");
    setFormDescription(""); setFormUnits(3); setFormPingpong(false);
    setEditing(null); setShowForm(false);
  };

  const saveMenuItem = async () => {
    if (!formName || !formPrice) return;
    if (editing) {
      await fetch("/api/bicha/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name: formName, price: parseFloat(formPrice), category: formCategory, description: formDescription }),
      });
    } else {
      await fetch("/api/bicha/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, price: parseFloat(formPrice), category: formCategory, description: formDescription }),
      });
    }
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

  const savePack = async () => {
    if (!formName || !formPrice) return;
    // Packs use the menu API pattern but separate table — simplified for now
    // Just POST to a simple endpoint
    const body = { name: formName, price: parseFloat(formPrice), category: formCategory, description: formDescription, units: formUnits, includes_pingpong: formPingpong };
    // We'd need a packs CRUD in admin — for now using direct supabase
    // TODO: add full pack CRUD. For now admin creates packs via SQL
    resetForm();
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

  if (!authed) {
    return (
      <div style={page}>
        <div style={{ ...container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: f.display, color: "#F5A623" }}>Admin · La Bicha</div>
          <input
            style={{ ...input, maxWidth: 200, textAlign: "center", letterSpacing: 8 }}
            type="password" maxLength={4} placeholder="PIN"
            value={pin} onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
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
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[{ key: "menu", label: "Menú" }, { key: "packs", label: "Packs" }, { key: "customers", label: "Clientes" }].map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); resetForm(); }}
              style={{ ...pillStyle, flex: 1, background: tab === t.key ? "#F5A623" : "#1A1A1A", color: tab === t.key ? "#000" : "#999", border: `1px solid ${tab === t.key ? "#F5A623" : "#333"}` }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* MENU TAB */}
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
                  <input style={input} placeholder="Descripción (opcional)" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
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
                          ✏️
                        </button>
                        <button onClick={() => deleteItem(item.id)} style={{ ...pillStyle, background: "#B83B3B20", color: "#B83B3B", border: "none", fontSize: 11 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* PACKS TAB */}
        {tab === "packs" && (
          <>
            <div style={{ fontSize: 13, color: "#777", marginBottom: 16 }}>
              Los packs se configuran desde la base de datos. Acá podés ver los activos.
            </div>
            {packs.map((pack) => (
              <div key={pack.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{pack.name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{pack.description}</div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                      {pack.units} unidades
                      {pack.includes_pingpong && " · 🏓 Incluye ping pong"}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#F5A623", fontFamily: f.display }}>
                    ${pack.price?.toLocaleString("es-AR")}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* CUSTOMERS TAB */}
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
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#F5A623" }}>{c.stamps_count} 🎫</div>
                    <div style={{ fontSize: 11, color: "#777" }}>{c.total_orders} pedidos</div>
                  </div>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div style={{ textAlign: "center", color: "#666", padding: 40 }}>Sin clientes aún</div>
            )}
          </>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
