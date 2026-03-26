"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const HOST_PIN = "1250";

export default function SettingsPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("general");

  useEffect(() => {
    document.title = "Meantime — Configuración";
    try { if (sessionStorage.getItem("meantime_host_auth") === "1") setAuthed(true); } catch {}
  }, []);

  useEffect(() => {
    if (!authed || !supabase) return;
    // Fetch tenant config (default to chui)
    supabase.from("tenants").select("*").eq("slug", "chui").single()
      .then(({ data }) => {
        if (data) setTenant(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authed]);

  const handleSave = async () => {
    if (!tenant || !supabase) return;
    setSaving(true);
    const { error } = await supabase.from("tenants").update({
      name: tenant.name,
      address: tenant.address,
      city: tenant.city,
      pin: tenant.pin,
      accent_color: tenant.accent_color,
      secondary_color: tenant.secondary_color,
      logo_url: tenant.logo_url,
      walk_around_radius_m: tenant.walk_around_radius_m,
      walk_around_minutes: tenant.walk_around_minutes,
      arrival_minutes: tenant.arrival_minutes,
      grace_minutes: tenant.grace_minutes,
      auto_cleanup_hours: tenant.auto_cleanup_hours,
      opentable_url: tenant.opentable_url,
      instagram_handle: tenant.instagram_handle,
      instagram_url: tenant.instagram_url,
      google_review_url: tenant.google_review_url,
      features: tenant.features,
      updated_at: new Date().toISOString(),
    }).eq("id", tenant.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const update = (key, value) => setTenant(t => ({ ...t, [key]: value }));
  const updateFeature = (key, value) => setTenant(t => ({ ...t, features: { ...t.features, [key]: value } }));

  // PIN screen
  if (!authed) return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: f.sans }}>
      <div style={{ textAlign: "center", width: "280px" }}>
        <div style={{ fontFamily: f.display, fontSize: "22px", fontWeight: "800", marginBottom: "8px" }}>Configuración</div>
        <div style={{ fontSize: "14px", color: T.textMed, marginBottom: "20px" }}>Ingresa el PIN del hostess</div>
        <input type="tel" inputMode="numeric" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(false); }}
          onKeyDown={e => { if (e.key === "Enter" && pin.length === 4) { if (pin === HOST_PIN) { try { sessionStorage.setItem("meantime_host_auth", "1"); } catch {} setAuthed(true); } else { setPinError(true); setPin(""); } } }}
          placeholder="••••" autoFocus
          style={{ width: "100%", padding: "16px", borderRadius: "14px", fontSize: "28px", fontWeight: "700", fontFamily: f.display, textAlign: "center", letterSpacing: "0.3em", outline: "none", border: `2px solid ${pinError ? T.danger : T.border}`, background: T.bg, color: T.text, boxSizing: "border-box" }} />
        {pinError && <div style={{ fontSize: "13px", color: T.danger, marginTop: "10px" }}>PIN incorrecto</div>}
      </div>
    </div>
  );

  if (loading || !tenant) return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight, fontFamily: f.sans }}>
      Cargando...
    </div>
  );

  const TABS = [
    { id: "general", label: "General" },
    { id: "branding", label: "Marca" },
    { id: "operations", label: "Operaciones" },
    { id: "features", label: "Features" },
    { id: "links", label: "Links" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans, color: T.text }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, padding: "16px 20px", background: T.card, borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ maxWidth: "700px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: f.display, fontSize: "20px", fontWeight: "800" }}>Configuración</div>
            <div style={{ fontSize: "12px", color: T.textLight }}>{tenant.name} · {tenant.slug}</div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 24px", borderRadius: "12px",
            background: saved ? T.success : T.accent, color: "#fff", border: "none",
            fontSize: "14px", fontWeight: "700", cursor: saving ? "default" : "pointer", fontFamily: f.sans,
          }}>{saved ? "Guardado ✓" : saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>

      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
              background: tab === t.id ? T.accent : "transparent",
              color: tab === t.id ? "#fff" : T.textMed,
              border: tab === t.id ? "none" : `1px solid ${T.border}`,
              cursor: "pointer", fontFamily: f.sans, whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>

        {/* General */}
        {tab === "general" && (
          <Section title="Información general">
            <Field label="Nombre del negocio">
              <input value={tenant.name} onChange={e => update("name", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Slug (URL)">
              <div style={{ padding: "14px 16px", borderRadius: "12px", background: T.bgPage, fontSize: "14px", color: T.textMed }}>
                meantime.ar/t/<strong>{tenant.slug}</strong>
              </div>
            </Field>
            <Field label="Dirección">
              <input value={tenant.address || ""} onChange={e => update("address", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Ciudad">
              <input value={tenant.city || ""} onChange={e => update("city", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="PIN del staff">
              <input value={tenant.pin || ""} onChange={e => update("pin", e.target.value.replace(/\D/g, "").slice(0, 6))}
                type="tel" inputMode="numeric" maxLength={6} style={inputStyle} />
            </Field>
            <Field label="Plan">
              <div style={{ padding: "14px 16px", borderRadius: "12px", background: T.bgPage }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: T.accent, textTransform: "uppercase" }}>{tenant.plan}</span>
              </div>
            </Field>
          </Section>
        )}

        {/* Branding */}
        {tab === "branding" && (
          <Section title="Marca">
            <Field label="Color principal">
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input type="color" value={tenant.accent_color || "#1A1A1A"} onChange={e => update("accent_color", e.target.value)}
                  style={{ width: "48px", height: "48px", borderRadius: "12px", border: "none", cursor: "pointer" }} />
                <input value={tenant.accent_color || ""} onChange={e => update("accent_color", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} placeholder="#1A1A1A" />
              </div>
            </Field>
            <Field label="Color secundario">
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input type="color" value={tenant.secondary_color || "#2D7A4F"} onChange={e => update("secondary_color", e.target.value)}
                  style={{ width: "48px", height: "48px", borderRadius: "12px", border: "none", cursor: "pointer" }} />
                <input value={tenant.secondary_color || ""} onChange={e => update("secondary_color", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} placeholder="#2D7A4F" />
              </div>
            </Field>
            <Field label="URL del logo">
              <input value={tenant.logo_url || ""} onChange={e => update("logo_url", e.target.value)} style={inputStyle} placeholder="/logo-dark.png" />
            </Field>
          </Section>
        )}

        {/* Operations */}
        {tab === "operations" && (
          <Section title="Operaciones">
            <Field label="Radio walk-around (metros)">
              <input type="number" value={tenant.walk_around_radius_m || 300} onChange={e => update("walk_around_radius_m", parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="Minutos walk-around">
              <input type="number" value={tenant.walk_around_minutes || 15} onChange={e => update("walk_around_minutes", parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="Minutos para llegar (después de aviso)">
              <input type="number" value={tenant.arrival_minutes || 10} onChange={e => update("arrival_minutes", parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="Minutos de gracia">
              <input type="number" value={tenant.grace_minutes || 5} onChange={e => update("grace_minutes", parseInt(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="Auto-cleanup (horas)">
              <input type="number" value={tenant.auto_cleanup_hours || 6} onChange={e => update("auto_cleanup_hours", parseInt(e.target.value))} style={inputStyle} />
            </Field>
          </Section>
        )}

        {/* Features */}
        {tab === "features" && (
          <Section title="Funciones">
            {Object.entries(tenant.features || {}).map(([key, val]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>{featureLabel(key)}</div>
                  <div style={{ fontSize: "12px", color: T.textLight }}>{featureDesc(key)}</div>
                </div>
                <button onClick={() => updateFeature(key, !val)} style={{
                  width: "48px", height: "28px", borderRadius: "14px",
                  background: val ? T.success : T.border,
                  border: "none", cursor: "pointer", position: "relative",
                  transition: "background 0.2s ease",
                }}>
                  <div style={{
                    width: "22px", height: "22px", borderRadius: "50%", background: "#fff",
                    position: "absolute", top: "3px",
                    left: val ? "23px" : "3px",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
            ))}
          </Section>
        )}

        {/* Links */}
        {tab === "links" && (
          <Section title="Links externos">
            <Field label="OpenTable URL">
              <input value={tenant.opentable_url || ""} onChange={e => update("opentable_url", e.target.value)} style={inputStyle} placeholder="https://opentable.com/r/..." />
            </Field>
            <Field label="Instagram handle">
              <input value={tenant.instagram_handle || ""} onChange={e => update("instagram_handle", e.target.value)} style={inputStyle} placeholder="@tunegocio" />
            </Field>
            <Field label="Instagram URL">
              <input value={tenant.instagram_url || ""} onChange={e => update("instagram_url", e.target.value)} style={inputStyle} placeholder="https://instagram.com/..." />
            </Field>
            <Field label="Google Reviews URL">
              <input value={tenant.google_review_url || ""} onChange={e => update("google_review_url", e.target.value)} style={inputStyle} placeholder="https://g.page/..." />
            </Field>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: T.card, borderRadius: "20px", border: `1px solid ${T.cardBorder}`, padding: "24px", marginBottom: "20px" }}>
      <h3 style={{ fontFamily: f.display, fontSize: "18px", fontWeight: "700", marginBottom: "20px", color: T.text }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: "12px",
  border: `1.5px solid ${T.border}`, fontSize: "16px",
  fontFamily: "'Nunito', sans-serif", outline: "none",
  boxSizing: "border-box", background: "#fff", color: T.text,
};

function featureLabel(key) {
  const map = {
    bar_promo: "Promo 2x1 Barra", walk_around: "Walk-around mode", referral: "Referidos",
    pre_order: "Pre-order", gps_tracking: "GPS tracking", whatsapp_bot: "WhatsApp Bot",
    analytics: "Analytics", crm: "CRM", priority_queue: "Cola prioritaria", multi_queue: "Multi-cola",
  };
  return map[key] || key;
}

function featureDesc(key) {
  const map = {
    bar_promo: "2x1 en bar mientras esperan", walk_around: "Dejar que paseen por el barrio",
    referral: "Programa de referidos", pre_order: "Pedir antes de sentarse",
    gps_tracking: "Trackear distancia del cliente", whatsapp_bot: "Mensajes automáticos por WhatsApp",
    analytics: "Dashboard de métricas", crm: "Historial de clientes",
    priority_queue: "Prioridad legal (adultos mayores, embarazadas)", multi_queue: "Múltiples colas de atención",
  };
  return map[key] || "";
}
