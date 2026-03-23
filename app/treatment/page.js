"use client";

import { useState, useRef, useCallback } from "react";

// ── Design tokens ──
const T = {
  bg: "#0A0A0F",
  bgCard: "#14141F",
  bgCardHover: "#1A1A2A",
  bgInput: "#1E1E2E",
  accent: "#7C5CFC",
  accentLight: "#9B82FC",
  accentSoft: "rgba(124,92,252,0.12)",
  text: "#F0F0F5",
  textMed: "#A0A0B0",
  textLight: "#6B6B80",
  border: "#2A2A3A",
  borderActive: "#7C5CFC",
  success: "#4ADE80",
  successBg: "rgba(74,222,128,0.1)",
  warn: "#FBBF24",
  danger: "#F87171",
  radius: "16px",
  radiusSm: "12px",
  shadow: "0 4px 24px rgba(0,0,0,0.3)",
  font: "'Outfit', sans-serif",
  fontBody: "'Nunito', sans-serif",
};

// ── Steps ──
const STEPS = [
  { id: "upload", label: "Subir Guion" },
  { id: "analysis", label: "Análisis" },
  { id: "angles", label: "Ángulo Creativo" },
  { id: "structure", label: "Estructura" },
  { id: "generate", label: "Treatment" },
];

// ── PDF Text Extraction (client-side) ──
async function extractPdfText(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    fullText += text + "\n\n";
  }

  return fullText;
}

// ── Components ──

function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center", padding: "0 20px" }}>
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
            <div
              style={{
                height: "3px",
                flex: 1,
                borderRadius: "2px",
                background: isDone ? T.accent : isActive ? `linear-gradient(90deg, ${T.accent}, ${T.border})` : T.border,
                transition: "all 0.5s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function StepLabel({ currentStep }) {
  return (
    <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: T.font, fontSize: "13px", fontWeight: 600, color: T.textLight, letterSpacing: "1px", textTransform: "uppercase" }}>
        {STEPS[currentStep].label}
      </span>
      <span style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.textLight }}>
        {currentStep + 1} / {STEPS.length}
      </span>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Button({ onClick, children, variant = "primary", disabled = false, style = {} }) {
  const styles = {
    primary: {
      background: disabled ? T.textLight : T.accent,
      color: "#fff",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    },
    secondary: {
      background: "transparent",
      color: T.textMed,
      border: `1px solid ${T.border}`,
      cursor: "pointer",
    },
    ghost: {
      background: "transparent",
      color: T.accent,
      cursor: "pointer",
    },
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        fontFamily: T.font,
        fontSize: "15px",
        fontWeight: 600,
        padding: "14px 28px",
        borderRadius: T.radiusSm,
        border: "none",
        transition: "all 0.2s ease",
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function LoadingSpinner({ text = "Procesando..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "60px 0" }}>
      <div
        style={{
          width: "40px",
          height: "40px",
          border: `3px solid ${T.border}`,
          borderTopColor: T.accent,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.textMed }}>{text}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── STEP 1: Upload ──
function UploadStep({ onScriptReady }) {
  const [dragOver, setDragOver] = useState(false);
  const [manualText, setManualText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setFileName(file.name);

    if (file.type === "application/pdf") {
      setExtracting(true);
      try {
        const text = await extractPdfText(file);
        setManualText(text);
        setExtracting(false);
      } catch (err) {
        alert("Error al leer el PDF: " + err.message);
        setExtracting(false);
      }
    } else if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".fountain")) {
      const text = await file.text();
      setManualText(text);
    } else {
      alert("Formato no soportado. Usá PDF, TXT o pegá el texto directamente.");
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <h2 style={{ fontFamily: T.font, fontSize: "28px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>
        Subí tu guion
      </h2>
      <p style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.textMed, margin: "0 0 32px" }}>
        Arrastrá un PDF, o pegá el texto del guion de tu comercial directamente.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? T.accent : T.border}`,
          borderRadius: T.radius,
          padding: "48px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? T.accentSoft : "transparent",
          transition: "all 0.2s ease",
          marginBottom: "20px",
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.fountain" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>📄</div>
        <div style={{ fontFamily: T.font, fontSize: "16px", fontWeight: 600, color: dragOver ? T.accent : T.text }}>
          {fileName ? fileName : "Arrastrá tu archivo acá"}
        </div>
        <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.textLight, marginTop: "8px" }}>
          PDF, TXT o Fountain
        </div>
      </div>

      {extracting && <LoadingSpinner text="Extrayendo texto del PDF..." />}

      {/* Manual text */}
      <div style={{ position: "relative" }}>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="O pegá el texto de tu guion acá..."
          style={{
            width: "100%",
            minHeight: "200px",
            background: T.bgInput,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            padding: "16px",
            fontFamily: "'Courier New', monospace",
            fontSize: "14px",
            color: T.text,
            resize: "vertical",
            outline: "none",
            lineHeight: 1.6,
          }}
          onFocus={(e) => (e.target.style.borderColor = T.accent)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
        {manualText && (
          <span style={{
            position: "absolute", bottom: "12px", right: "12px",
            fontFamily: T.fontBody, fontSize: "12px", color: T.textLight,
          }}>
            {manualText.length.toLocaleString()} caracteres
          </span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
        <Button onClick={() => onScriptReady(manualText)} disabled={!manualText || manualText.trim().length < 20}>
          Analizar guion →
        </Button>
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ── STEP 2: Analysis ──
function AnalysisStep({ analysis, onContinue, onBack }) {
  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <h2 style={{ fontFamily: T.font, fontSize: "28px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>
        Análisis del guion
      </h2>
      <p style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.textMed, margin: "0 0 24px" }}>
        Revisá que el análisis sea correcto antes de continuar.
      </p>

      {/* Header info */}
      <Card style={{ marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Título</span>
            <div style={{ fontFamily: T.font, fontSize: "18px", fontWeight: 700, color: T.text, marginTop: "4px" }}>{analysis.titulo}</div>
          </div>
          <div>
            <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Marca</span>
            <div style={{ fontFamily: T.font, fontSize: "18px", fontWeight: 600, color: T.accentLight, marginTop: "4px" }}>{analysis.marca}</div>
          </div>
          <div>
            <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Duración</span>
            <div style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.text, marginTop: "4px" }}>{analysis.duracion_estimada}</div>
          </div>
          <div>
            <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Audiencia</span>
            <div style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.text, marginTop: "4px" }}>{analysis.audiencia_objetivo}</div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card style={{ marginBottom: "16px" }}>
        <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Resumen</span>
        <p style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.text, lineHeight: 1.6, marginTop: "8px" }}>{analysis.resumen}</p>
      </Card>

      {/* Tones */}
      <Card style={{ marginBottom: "16px" }}>
        <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Tono</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
          {analysis.tono?.map((t, i) => (
            <span key={i} style={{
              fontFamily: T.fontBody, fontSize: "13px", color: T.accent,
              background: T.accentSoft, padding: "6px 14px", borderRadius: "20px",
            }}>
              {t}
            </span>
          ))}
        </div>
      </Card>

      {/* Scenes */}
      <Card style={{ marginBottom: "16px" }}>
        <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>
          Escenas ({analysis.escenas?.length})
        </span>
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {analysis.escenas?.map((scene, i) => (
            <div key={i} style={{ padding: "16px", background: T.bg, borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: T.font, fontSize: "14px", fontWeight: 700, color: T.accentLight, marginBottom: "6px" }}>
                Escena {scene.numero}: {scene.titulo}
              </div>
              <p style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.text, margin: "0 0 8px", lineHeight: 1.5 }}>{scene.descripcion}</p>
              <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.textMed }}>
                🎬 {scene.elementos_visuales}
              </div>
              <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.textMed, marginTop: "4px" }}>
                🔊 {scene.audio}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Key elements & challenges */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <Card>
          <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Elementos clave</span>
          <ul style={{ margin: "10px 0 0", paddingLeft: "18px" }}>
            {analysis.elementos_clave?.map((el, i) => (
              <li key={i} style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.text, marginBottom: "6px" }}>{el}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Desafíos de producción</span>
          <ul style={{ margin: "10px 0 0", paddingLeft: "18px" }}>
            {analysis.desafios_produccion?.map((d, i) => (
              <li key={i} style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.warn, marginBottom: "6px" }}>{d}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onBack} variant="ghost">← Volver</Button>
        <Button onClick={onContinue}>Explorar ángulos →</Button>
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ── STEP 3: Angles ──
function AnglesStep({ suggestions, selectedAngle, onSelectAngle, onContinue, onBack }) {
  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <h2 style={{ fontFamily: T.font, fontSize: "28px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>
        Elegí tu ángulo creativo
      </h2>
      <p style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.textMed, margin: "0 0 24px" }}>
        Cada ángulo propone un enfoque visual y narrativo distinto para tu comercial.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        {suggestions.angulos?.map((angle) => {
          const isSelected = selectedAngle?.id === angle.id;
          return (
            <div
              key={angle.id}
              onClick={() => onSelectAngle(angle)}
              style={{
                background: isSelected ? T.accentSoft : T.bgCard,
                border: `2px solid ${isSelected ? T.accent : T.border}`,
                borderRadius: T.radius,
                padding: "24px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {/* Color palette preview */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                {angle.paleta_colores?.map((color, i) => (
                  <div key={i} style={{ width: "32px", height: "32px", borderRadius: "8px", background: color, border: "1px solid rgba(255,255,255,0.1)" }} />
                ))}
              </div>

              <div style={{ fontFamily: T.font, fontSize: "18px", fontWeight: 700, color: isSelected ? T.accent : T.text, marginBottom: "8px" }}>
                {angle.nombre}
              </div>
              <p style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.textMed, lineHeight: 1.5, margin: "0 0 12px" }}>
                {angle.descripcion}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <span style={{ fontFamily: T.fontBody, fontSize: "11px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Estilo visual</span>
                  <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.text, marginTop: "4px" }}>{angle.estilo_visual}</div>
                </div>
                <div>
                  <span style={{ fontFamily: T.fontBody, fontSize: "11px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Ritmo</span>
                  <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.text, marginTop: "4px" }}>{angle.ritmo}</div>
                </div>
                <div>
                  <span style={{ fontFamily: T.fontBody, fontSize: "11px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Música</span>
                  <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.text, marginTop: "4px" }}>{angle.musica_sugerida}</div>
                </div>
                <div>
                  <span style={{ fontFamily: T.fontBody, fontSize: "11px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>Referencia</span>
                  <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.text, marginTop: "4px" }}>{angle.referencia_visual}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {angle.fortalezas?.map((f, i) => (
                  <span key={i} style={{
                    fontFamily: T.fontBody, fontSize: "12px", color: T.success,
                    background: T.successBg, padding: "4px 10px", borderRadius: "12px",
                  }}>
                    {f}
                  </span>
                ))}
                {angle.riesgos?.map((r, i) => (
                  <span key={i} style={{
                    fontFamily: T.fontBody, fontSize: "12px", color: T.warn,
                    background: "rgba(251,191,36,0.1)", padding: "4px 10px", borderRadius: "12px",
                  }}>
                    ⚠ {r}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onBack} variant="ghost">← Volver</Button>
        <Button onClick={onContinue} disabled={!selectedAngle}>Elegir estructura →</Button>
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ── STEP 4: Structure ──
function StructureStep({ suggestions, selectedStructure, onSelectStructure, customNotes, onNotesChange, onGenerate, onBack }) {
  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <h2 style={{ fontFamily: T.font, fontSize: "28px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>
        Elegí la estructura narrativa
      </h2>
      <p style={{ fontFamily: T.fontBody, fontSize: "15px", color: T.textMed, margin: "0 0 24px" }}>
        Definí cómo se organiza la historia de tu comercial.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        {suggestions.estructuras?.map((struct) => {
          const isSelected = selectedStructure?.id === struct.id;
          return (
            <div
              key={struct.id}
              onClick={() => onSelectStructure(struct)}
              style={{
                background: isSelected ? T.accentSoft : T.bgCard,
                border: `2px solid ${isSelected ? T.accent : T.border}`,
                borderRadius: T.radius,
                padding: "24px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontFamily: T.font, fontSize: "18px", fontWeight: 700, color: isSelected ? T.accent : T.text, marginBottom: "8px" }}>
                {struct.nombre}
              </div>
              <p style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.textMed, lineHeight: 1.5, margin: "0 0 16px" }}>
                {struct.descripcion}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                {struct.flujo?.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{
                      minWidth: "24px", height: "24px", borderRadius: "50%",
                      background: isSelected ? T.accent : T.border,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: T.font, fontSize: "12px", fontWeight: 700,
                      color: isSelected ? "#fff" : T.textLight, marginTop: "1px",
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.text, lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: T.fontBody, fontSize: "13px", color: T.accentLight, fontStyle: "italic" }}>
                Ideal para: {struct.ideal_para}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom notes */}
      <Card style={{ marginBottom: "24px" }}>
        <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textLight, textTransform: "uppercase", letterSpacing: "1px" }}>
          Notas adicionales (opcional)
        </span>
        <textarea
          value={customNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Indicaciones extra para el treatment: estilo de casting, locaciones preferidas, referencias visuales, restricciones de producción..."
          style={{
            width: "100%",
            minHeight: "100px",
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            padding: "12px",
            fontFamily: T.fontBody,
            fontSize: "14px",
            color: T.text,
            resize: "vertical",
            outline: "none",
            marginTop: "10px",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.accent)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onBack} variant="ghost">← Volver</Button>
        <Button onClick={onGenerate} disabled={!selectedStructure}>
          Generar Treatment ✨
        </Button>
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ── STEP 5: Final Treatment ──
function TreatmentStep({ html, onBack, onRestart }) {
  const iframeRef = useRef();

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "creative-treatment.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNewTab = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontFamily: T.font, fontSize: "28px", fontWeight: 700, color: T.text, margin: "0 0 4px" }}>
            Tu Creative Treatment
          </h2>
          <p style={{ fontFamily: T.fontBody, fontSize: "14px", color: T.textMed, margin: 0 }}>
            Listo para presentar.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button onClick={handleNewTab} variant="secondary" style={{ padding: "10px 18px", fontSize: "13px" }}>
            Abrir en pestaña
          </Button>
          <Button onClick={handleDownload} style={{ padding: "10px 18px", fontSize: "13px" }}>
            Descargar HTML
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", marginBottom: "24px" }}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{
            width: "100%",
            height: "70vh",
            border: "none",
            background: "#fff",
          }}
          title="Creative Treatment Preview"
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onBack} variant="ghost">← Volver a ajustar</Button>
        <Button onClick={onRestart} variant="secondary">Nuevo guion</Button>
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ── Main App ──
export default function TreatmentGenerator() {
  const [step, setStep] = useState(0);
  const [scriptText, setScriptText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [selectedAngle, setSelectedAngle] = useState(null);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [customNotes, setCustomNotes] = useState("");
  const [treatmentHtml, setTreatmentHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");

  const handleAnalyze = async (text) => {
    setScriptText(text);
    setLoading(true);
    setLoadingText("Analizando tu guion...");
    setError("");

    try {
      const res = await fetch("/api/treatment/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis(data.analysis);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExploreAngles = async () => {
    setLoading(true);
    setLoadingText("Generando ángulos creativos...");
    setError("");

    try {
      const res = await fetch("/api/treatment/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, scriptText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions(data.suggestions);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setLoadingText("Creando tu creative treatment...");
    setError("");

    try {
      const res = await fetch("/api/treatment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, selectedAngle, selectedStructure, scriptText, customNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTreatmentHtml(data.html);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setStep(0);
    setScriptText("");
    setAnalysis(null);
    setSuggestions(null);
    setSelectedAngle(null);
    setSelectedStructure(null);
    setCustomNotes("");
    setTreatmentHtml("");
    setError("");
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.fontBody }}>
      {/* Header */}
      <header style={{
        padding: "20px 24px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: `linear-gradient(135deg, ${T.accent}, #B44CFC)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: 700, color: "#fff", fontFamily: T.font,
          }}>
            T
          </div>
          <span style={{ fontFamily: T.font, fontSize: "18px", fontWeight: 700, color: T.text }}>
            Treatment Studio
          </span>
        </div>
        {step > 0 && (
          <Button onClick={handleRestart} variant="ghost" style={{ padding: "8px 16px", fontSize: "13px" }}>
            Nuevo proyecto
          </Button>
        )}
      </header>

      {/* Progress */}
      <div style={{ paddingTop: "12px" }}>
        <StepIndicator currentStep={step} />
        <StepLabel currentStep={step} />
      </div>

      {/* Content */}
      <main style={{ maxWidth: "860px", margin: "0 auto", padding: "20px 24px 60px" }}>
        {error && (
          <div style={{
            background: "rgba(248,113,113,0.1)",
            border: `1px solid ${T.danger}`,
            borderRadius: T.radiusSm,
            padding: "14px 18px",
            marginBottom: "20px",
            fontFamily: T.fontBody,
            fontSize: "14px",
            color: T.danger,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner text={loadingText} />
        ) : (
          <>
            {step === 0 && <UploadStep onScriptReady={handleAnalyze} />}
            {step === 1 && <AnalysisStep analysis={analysis} onContinue={handleExploreAngles} onBack={() => setStep(0)} />}
            {step === 2 && (
              <AnglesStep
                suggestions={suggestions}
                selectedAngle={selectedAngle}
                onSelectAngle={setSelectedAngle}
                onContinue={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <StructureStep
                suggestions={suggestions}
                selectedStructure={selectedStructure}
                onSelectStructure={setSelectedStructure}
                customNotes={customNotes}
                onNotesChange={setCustomNotes}
                onGenerate={handleGenerate}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <TreatmentStep
                html={treatmentHtml}
                onBack={() => setStep(3)}
                onRestart={handleRestart}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
