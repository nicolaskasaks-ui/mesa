"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const PIN = "1250";
const AUTH_KEY = "meantime_crm_auth";

function ago(d) {
  if (!d) return "---";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function trustBadge(level) {
  const labels = { 0: "Nuevo", 1: "Verificado", 2: "Confiable", 3: "Habitual" };
  const colors = { 0: T.textLight, 1: T.warn, 2: "#3B7BC0", 3: T.success };
  const bgs = { 0: T.accentSoft, 1: T.warnLight, 2: "#EBF3FB", 3: T.successLight };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "12px",
      fontWeight: "600", color: colors[level] || T.textLight, background: bgs[level] || T.accentSoft,
    }}>
      {labels[level] || "Nuevo"}
    </span>
  );
}

export default function CRMPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Meantime — CRM";
    try {
      if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
    } catch {}
  }, []);

  // Search customers
  const doSearch = async (q) => {
    if (!supabase || !q || q.length < 2) { setCustomers([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, visit_count, trust_level, last_visit, allergies, no_show_count, notes")
      .ilike("name", `%${q}%`)
      .order("last_visit", { ascending: false })
      .limit(50);
    setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load full profile
  const loadProfile = async (customer) => {
    setSelected(customer.id);
    setProfile(customer);
    setNoteText(customer.notes || "");
    if (!supabase) return;

    const [wl, br] = await Promise.all([
      supabase.from("waitlist")
        .select("id, guest_name, party_size, status, joined_at, seated_at, cancelled_at, activity, source")
        .eq("customer_id", customer.id)
        .order("joined_at", { ascending: false })
        .limit(100),
      supabase.from("bar_redemptions")
        .select("id, item, redeemed_at, is_promo, price")
        .eq("customer_id", customer.id)
        .order("redeemed_at", { ascending: false })
        .limit(100),
    ]);
    setHistory(wl.data || []);
    setRedemptions(br.data || []);
  };

  const saveNotes = async () => {
    if (!supabase || !selected) return;
    setSaving(true);
    await supabase.from("customers").update({ notes: noteText }).eq("id", selected);
    // Update local list
    setCustomers(prev => prev.map(c => c.id === selected ? { ...c, notes: noteText } : c));
    setProfile(prev => prev ? { ...prev, notes: noteText } : prev);
    setSaving(false);
  };

  // PIN screen
  if (!authed) return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: f.sans }}>
      <div style={{ textAlign: "center", width: "280px" }}>
        <img src="/logo-dark.png" alt="Meantime" style={{ height: "32px", objectFit: "contain", marginBottom: "20px" }} />
        <div style={{ fontSize: "14px", color: T.textMed, marginBottom: "20px" }}>Ingresa el PIN para CRM</div>
        <input
          type="tel" inputMode="numeric" maxLength={4}
          value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(false); }}
          onKeyDown={e => {
            if (e.key === "Enter" && pin.length === 4) {
              if (pin === PIN) {
                try { sessionStorage.setItem(AUTH_KEY, "1"); } catch {}
                setAuthed(true);
              } else { setPinError(true); setPin(""); }
            }
          }}
          placeholder="••••"
          style={{
            width: "100%", padding: "16px", borderRadius: "14px", fontSize: "28px", fontWeight: "700",
            fontFamily: f.display, textAlign: "center", letterSpacing: "0.3em", outline: "none",
            border: `2px solid ${pinError ? T.danger : T.border}`, background: T.bg, color: T.text,
            boxSizing: "border-box",
          }}
          autoFocus
        />
        {pinError && <div style={{ fontSize: "13px", color: T.danger, marginTop: "10px" }}>PIN incorrecto</div>}
        <button onClick={() => {
          if (pin === PIN) {
            try { sessionStorage.setItem(AUTH_KEY, "1"); } catch {}
            setAuthed(true);
          } else { setPinError(true); setPin(""); }
        }} disabled={pin.length < 4} style={{
          width: "100%", padding: "16px", borderRadius: "14px", marginTop: "16px",
          background: pin.length === 4 ? T.accent : T.border, color: "#fff", border: "none",
          fontSize: "15px", fontWeight: "600", cursor: pin.length === 4 ? "pointer" : "default",
          fontFamily: f.sans, opacity: pin.length === 4 ? 1 : 0.5,
        }}>Entrar</button>
      </div>
    </div>
  );

  // Main CRM view
  return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans }}>
      {/* Header */}
      <div style={{
        background: T.bg, borderBottom: `1px solid ${T.border}`, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: "10px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <span style={{ fontFamily: f.display, fontWeight: "700", fontSize: "20px", color: T.text }}>Meantime</span>
        <span style={{
          background: T.accent, color: "#fff", fontSize: "11px", fontWeight: "700",
          padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.05em",
        }}>CRM</span>
      </div>

      {/* Search */}
      <div style={{ padding: "16px 20px" }}>
        <input
          type="text" placeholder="Buscar cliente por nombre..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "14px 18px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
            background: T.bg, fontSize: "15px", fontFamily: f.sans, outline: "none", boxSizing: "border-box",
            color: T.text,
          }}
          autoFocus
        />
      </div>

      <div style={{ display: "flex", gap: "0", minHeight: "calc(100dvh - 120px)" }}>
        {/* Customer list */}
        <div style={{ flex: selected ? "0 0 360px" : "1", padding: "0 20px 20px", overflowY: "auto" }}>
          {loading && <div style={{ color: T.textLight, fontSize: "14px", padding: "20px 0" }}>Buscando...</div>}
          {!loading && search.length >= 2 && customers.length === 0 && (
            <div style={{ color: T.textLight, fontSize: "14px", padding: "20px 0" }}>Sin resultados</div>
          )}
          {customers.map(c => (
            <div
              key={c.id}
              onClick={() => loadProfile(c)}
              style={{
                background: selected === c.id ? T.accentLight : T.card,
                border: `1px solid ${selected === c.id ? T.accent : T.cardBorder}`,
                borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: "10px",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontWeight: "600", fontSize: "15px", color: T.text }}>{c.name}</span>
                {trustBadge(c.trust_level)}
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: T.textMed, flexWrap: "wrap" }}>
                {c.phone && <span>{c.phone}</span>}
                <span>{c.visit_count || 0} visitas</span>
                {c.no_show_count > 0 && <span style={{ color: T.danger }}>{c.no_show_count} no-show</span>}
                <span>Ultima: {ago(c.last_visit)}</span>
                {c.allergies?.length > 0 && (
                  <span style={{ color: T.warn }}>Alergias: {c.allergies.join(", ")}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Profile detail panel */}
        {selected && profile && (
          <div style={{
            flex: "1", background: T.bg, borderLeft: `1px solid ${T.border}`,
            padding: "24px", overflowY: "auto",
          }}>
            {/* Close button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ fontFamily: f.display, fontWeight: "700", fontSize: "22px", color: T.text }}>
                  {profile.name}
                </div>
                <div style={{ fontSize: "14px", color: T.textMed, marginTop: "4px" }}>
                  {profile.phone || "Sin telefono"}
                </div>
              </div>
              <button onClick={() => { setSelected(null); setProfile(null); }} style={{
                background: "none", border: "none", fontSize: "24px", color: T.textLight, cursor: "pointer",
                padding: "4px 8px",
              }}>x</button>
            </div>

            {/* Stats row */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px",
            }}>
              {[
                { label: "Visitas", value: profile.visit_count || 0 },
                { label: "Trust", value: trustBadge(profile.trust_level) },
                { label: "No-shows", value: profile.no_show_count || 0 },
                { label: "Ultima visita", value: ago(profile.last_visit) },
              ].map((s, i) => (
                <div key={i} style={{
                  background: T.accentSoft, borderRadius: T.radiusSm, padding: "14px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "12px", color: T.textLight, marginBottom: "4px" }}>{s.label}</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: T.text }}>
                    {typeof s.value === "number" ? s.value : s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Allergies */}
            {profile.allergies?.length > 0 && (
              <div style={{
                background: T.warnLight, borderRadius: T.radiusSm, padding: "12px 16px",
                marginBottom: "20px", fontSize: "14px", color: T.warn, fontWeight: "600",
              }}>
                Alergias: {profile.allergies.join(", ")}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: T.text, marginBottom: "8px" }}>Notas</div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Agregar notas sobre el cliente..."
                rows={3}
                style={{
                  width: "100%", padding: "12px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
                  background: T.bg, fontSize: "14px", fontFamily: f.sans, resize: "vertical",
                  outline: "none", boxSizing: "border-box", color: T.text,
                }}
              />
              <button onClick={saveNotes} disabled={saving} style={{
                marginTop: "8px", padding: "8px 20px", borderRadius: T.radiusSm,
                background: T.accent, color: "#fff", border: "none", fontSize: "13px",
                fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "Guardando..." : "Guardar notas"}
              </button>
            </div>

            {/* Waitlist history */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: T.text, marginBottom: "10px" }}>
                Historial de visitas ({history.length})
              </div>
              {history.length === 0 && (
                <div style={{ fontSize: "13px", color: T.textLight }}>Sin historial</div>
              )}
              {history.map(h => {
                const statusColors = {
                  seated: T.success, waiting: T.warn, cancelled: T.danger,
                  notified: "#3B7BC0", extended: T.warn,
                };
                const statusLabels = {
                  seated: "Sentado", waiting: "Esperando", cancelled: "Cancelado",
                  notified: "Notificado", extended: "Extendido",
                };
                return (
                  <div key={h.id} style={{
                    background: T.accentSoft, borderRadius: T.radiusSm, padding: "12px 14px",
                    marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: "13px", color: T.text, fontWeight: "500" }}>
                        {new Date(h.joined_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                        {" "}
                        {new Date(h.joined_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ fontSize: "12px", color: T.textMed, marginTop: "2px" }}>
                        {h.party_size}p
                        {h.source && <span> / {h.source}</span>}
                        {h.activity && <span> / {h.activity}</span>}
                        {h.seated_at && (
                          <span> / espero {Math.round((new Date(h.seated_at) - new Date(h.joined_at)) / 60000)}min</span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "12px", fontWeight: "600",
                      color: statusColors[h.status] || T.textLight,
                    }}>
                      {statusLabels[h.status] || h.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bar redemptions */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: T.text, marginBottom: "10px" }}>
                Consumiciones en barra ({redemptions.length})
              </div>
              {redemptions.length === 0 && (
                <div style={{ fontSize: "13px", color: T.textLight }}>Sin consumiciones</div>
              )}
              {redemptions.map(r => (
                <div key={r.id} style={{
                  background: T.accentSoft, borderRadius: T.radiusSm, padding: "10px 14px",
                  marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: "13px",
                }}>
                  <div>
                    <span style={{ fontWeight: "500", color: T.text }}>{r.item}</span>
                    {r.is_promo && <span style={{ color: T.success, marginLeft: "8px" }}>PROMO</span>}
                  </div>
                  <div style={{ color: T.textMed }}>
                    {r.price != null && <span style={{ marginRight: "8px" }}>${r.price}</span>}
                    {new Date(r.redeemed_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
