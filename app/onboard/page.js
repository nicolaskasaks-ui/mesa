"use client";
import { useState } from "react";
import { T, f } from "../../lib/tokens";

const VERTICALS = [
  { id: "restaurant", label: "Restaurante", icon: "🍽️", desc: "Fila de espera, mesas, 2x1 bar, walk-around" },
  { id: "healthcare", label: "Salud", icon: "🏥", desc: "Guardia, turnos, triage, obra social" },
  { id: "salon", label: "Peluquería / Spa", icon: "💇", desc: "Turnos, servicios, fidelización" },
  { id: "generic", label: "Otro", icon: "🏢", desc: "Banco, gobierno, farmacia, etc." },
];

const STEPS = ["vertical", "info", "tables", "done"];

export default function OnboardPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    vertical: "restaurant",
    name: "",
    slug: "",
    address: "",
    city: "Buenos Aires",
    country: "AR",
    pin: "",
    email: "",
    phone: "",
    tableCount: 10,
  });
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const currentStep = STEPS[step];

  const generateSlug = (name) => {
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
  };

  const checkSlug = async (slug) => {
    if (!slug || slug.length < 2) { setSlugAvailable(null); return; }
    setChecking(true);
    try {
      const res = await fetch(`/api/tenants?slug=${slug}`);
      setSlugAvailable(res.status === 404); // 404 = available
    } catch {
      setSlugAvailable(null);
    }
    setChecking(false);
  };

  const handleNameChange = (name) => {
    setForm(f => ({ ...f, name, slug: generateSlug(name) }));
    const slug = generateSlug(name);
    if (slug.length >= 2) checkSlug(slug);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error creando cuenta"); setSubmitting(false); return; }
      setResult(data);
      setStep(3);
    } catch (e) {
      setError("Error de conexión");
    }
    setSubmitting(false);
  };

  const canProceed = () => {
    if (currentStep === "vertical") return true;
    if (currentStep === "info") return form.name.trim() && form.slug && slugAvailable !== false;
    if (currentStep === "tables") return true;
    return false;
  };

  return (
    <div style={{ minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", background: T.card, borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: f.display, fontSize: "22px", fontWeight: "800", color: T.text }}>Meantime</div>
            <div style={{ fontSize: "13px", color: T.textLight, marginTop: "2px" }}>Configura tu negocio en 2 minutos</div>
          </div>
          {/* Progress */}
          <div style={{ display: "flex", gap: "6px" }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{
                width: "32px", height: "4px", borderRadius: "2px",
                background: i <= step ? T.accent : T.border,
                transition: "background 0.3s ease",
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 24px" }}>

        {/* ═══ STEP 1: VERTICAL ═══ */}
        {currentStep === "vertical" && (
          <div className="card-enter">
            <h2 style={{ fontFamily: f.display, fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px" }}>
              Qué tipo de negocio tenés?
            </h2>
            <p style={{ fontSize: "15px", color: T.textMed, marginBottom: "28px" }}>
              Meantime se adapta a tu vertical con funciones específicas.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {VERTICALS.map(v => (
                <button key={v.id} onClick={() => setForm(f => ({ ...f, vertical: v.id }))} style={{
                  padding: "20px 16px", borderRadius: "16px", textAlign: "left",
                  background: form.vertical === v.id ? T.accent : T.card,
                  color: form.vertical === v.id ? "#fff" : T.text,
                  border: form.vertical === v.id ? "none" : `1.5px solid ${T.cardBorder}`,
                  cursor: "pointer", transition: "all 0.2s ease",
                }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>{v.icon}</div>
                  <div style={{ fontFamily: f.display, fontSize: "16px", fontWeight: "700" }}>{v.label}</div>
                  <div style={{ fontSize: "12px", marginTop: "4px", opacity: form.vertical === v.id ? 0.8 : 0.6 }}>{v.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 2: INFO ═══ */}
        {currentStep === "info" && (
          <div className="card-enter">
            <h2 style={{ fontFamily: f.display, fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px" }}>
              Datos de tu negocio
            </h2>
            <p style={{ fontSize: "15px", color: T.textMed, marginBottom: "28px" }}>
              Esto es lo que van a ver tus clientes.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <Field label="Nombre del negocio" required>
                <input value={form.name} onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ej: Don Julio, Clinica López" autoFocus style={inputStyle} />
              </Field>
              <Field label="URL" required>
                <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                  <span style={{ padding: "14px 12px", background: T.bgPage, borderRadius: "12px 0 0 12px", border: `1.5px solid ${T.border}`, borderRight: "none", fontSize: "14px", color: T.textLight, whiteSpace: "nowrap" }}>
                    meantime.ar/
                  </span>
                  <input value={form.slug}
                    onChange={e => { const s = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setForm(f => ({ ...f, slug: s })); checkSlug(s); }}
                    placeholder="tu-negocio" style={{ ...inputStyle, borderRadius: "0 12px 12px 0", borderLeft: "none" }} />
                </div>
                {form.slug && (
                  <div style={{ fontSize: "12px", marginTop: "6px", color: checking ? T.textLight : slugAvailable ? T.success : slugAvailable === false ? T.danger : T.textLight }}>
                    {checking ? "Verificando..." : slugAvailable ? "Disponible ✓" : slugAvailable === false ? "Ya está en uso" : ""}
                  </div>
                )}
              </Field>
              <Field label="Dirección">
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Ej: Loyola 1250, Villa Crespo" style={inputStyle} />
              </Field>
              <div style={{ display: "flex", gap: "12px" }}>
                <Field label="Ciudad" style={{ flex: 1 }}>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Buenos Aires" style={inputStyle} />
                </Field>
                <Field label="PIN staff" style={{ width: "120px" }}>
                  <input value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                    placeholder="0000" type="tel" inputMode="numeric" maxLength={6} style={inputStyle} />
                </Field>
              </div>
              <Field label="Email">
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contacto@tunegocio.com" type="email" style={inputStyle} />
              </Field>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: TABLES ═══ */}
        {currentStep === "tables" && (
          <div className="card-enter">
            <h2 style={{ fontFamily: f.display, fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px" }}>
              {form.vertical === "restaurant" ? "Cuántas mesas tenés?" : "Puntos de atención"}
            </h2>
            <p style={{ fontSize: "15px", color: T.textMed, marginBottom: "28px" }}>
              Podés cambiarlo después. Empezá con un número aproximado.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {[4, 6, 8, 10, 12, 15, 20, 25, 30].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, tableCount: n }))} style={{
                  padding: "16px 24px", borderRadius: "14px",
                  fontFamily: f.display, fontSize: "20px", fontWeight: "700",
                  background: form.tableCount === n ? T.accent : T.card,
                  color: form.tableCount === n ? "#fff" : T.text,
                  border: form.tableCount === n ? "none" : `1.5px solid ${T.cardBorder}`,
                  cursor: "pointer", minWidth: "70px",
                }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 4: DONE ═══ */}
        {currentStep === "done" && result && (
          <div className="card-enter" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ fontFamily: f.display, fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px" }}>
              {result.name} está listo!
            </h2>
            <p style={{ fontSize: "15px", color: T.textMed, marginBottom: "32px" }}>
              Tu sistema de espera ya está activo. Compartí el link con tus clientes.
            </p>
            <div style={{ background: T.card, borderRadius: "16px", padding: "20px", border: `1.5px solid ${T.cardBorder}`, marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Link para clientes</div>
              <div style={{ fontFamily: f.display, fontSize: "18px", fontWeight: "700", color: T.accent }}>
                meantime.ar/t/{result.slug}
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href={`/t/${result.slug}`} style={{
                padding: "14px 28px", borderRadius: "14px", background: T.accent, color: "#fff",
                textDecoration: "none", fontWeight: "700", fontFamily: f.sans, fontSize: "15px",
              }}>Ver como cliente</a>
              <a href={`/t/${result.slug}/host`} style={{
                padding: "14px 28px", borderRadius: "14px", background: T.card, color: T.text,
                textDecoration: "none", fontWeight: "700", fontFamily: f.sans, fontSize: "15px",
                border: `1.5px solid ${T.cardBorder}`,
              }}>Panel hostess</a>
            </div>
          </div>
        )}

        {/* ═══ NAVIGATION ═══ */}
        {currentStep !== "done" && (
          <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                padding: "16px 28px", borderRadius: "14px", background: T.card,
                color: T.textMed, border: `1.5px solid ${T.cardBorder}`,
                fontSize: "15px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
              }}>Atrás</button>
            )}
            <button
              onClick={() => {
                if (currentStep === "tables") { handleSubmit(); return; }
                setStep(s => s + 1);
              }}
              disabled={!canProceed() || submitting}
              style={{
                flex: 1, padding: "16px", borderRadius: "14px",
                background: canProceed() && !submitting ? T.accent : T.border,
                color: "#fff", border: "none",
                fontSize: "15px", fontWeight: "700", cursor: canProceed() && !submitting ? "pointer" : "default",
                fontFamily: f.sans, opacity: canProceed() && !submitting ? 1 : 0.5,
              }}>
              {submitting ? "Creando..." : currentStep === "tables" ? "Crear mi cuenta" : "Siguiente"}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: "16px", padding: "14px 16px", borderRadius: "12px", background: `${T.danger}10`, color: T.danger, fontSize: "14px", fontWeight: "600" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: "12px", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
        {label} {required && <span style={{ color: T.danger }}>*</span>}
      </label>
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
