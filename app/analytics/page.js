"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";

const PIN = "1250";
const AUTH_KEY = "meantime_analytics_auth";
const REFRESH_MS = 30000;

// ── helpers ──────────────────────────────────────────
function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function dayStart(dateStr) {
  return `${dateStr}T00:00:00`;
}

function dayEnd(dateStr) {
  return `${dateStr}T23:59:59.999`;
}

function pct(n, total) {
  if (!total) return "0";
  return (n / total * 100).toFixed(1);
}

// ── shared styles ────────────────────────────────────
const card = {
  background: T.card,
  borderRadius: T.radius,
  border: `1px solid ${T.cardBorder}`,
  boxShadow: T.shadow,
  padding: "20px",
};

const pill = (bg, color) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 12px",
  borderRadius: 999,
  background: bg,
  color: color,
  fontSize: 13,
  fontFamily: f.sans,
  fontWeight: 600,
});

// ── PIN screen ───────────────────────────────────────
function PinGate({ onAuth }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (value === PIN) {
      try { sessionStorage.setItem(AUTH_KEY, "1"); } catch {}
      onAuth();
    } else {
      setError(true);
      setValue("");
      setTimeout(() => setError(false), 1200);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bgPage, fontFamily: f.sans,
    }}>
      <div style={{ ...card, width: 320, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 4, fontFamily: f.display, fontWeight: 700, color: T.text }}>
          Meantime
        </div>
        <div style={{ fontSize: 13, color: T.textLight, marginBottom: 24 }}>Analytics</div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="PIN"
          value={value}
          onChange={e => setValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{
            width: "100%", padding: "14px 0", textAlign: "center", fontSize: 24, letterSpacing: 12,
            border: `1.5px solid ${error ? T.danger : T.border}`, borderRadius: 12,
            outline: "none", fontFamily: f.sans, background: T.bg,
            transition: "border-color .2s",
          }}
          autoFocus
        />
        <button
          onClick={submit}
          style={{
            marginTop: 16, width: "100%", padding: "14px 0",
            background: T.accent, color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600, fontFamily: f.sans, cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

// ── metric card ──────────────────────────────────────
function Metric({ label, value, sub, color }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: T.textLight, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: f.display, color: color || T.text, marginTop: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: T.textMed, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── main dashboard ───────────────────────────────────
export default function AnalyticsDashboard() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(fmtDate(new Date()));
  const [data, setData] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Auth check
  useEffect(() => {
    document.title = "Meantime — Analytics";
    try {
      if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
    } catch {}
  }, []);

  // ── data fetching ──────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!supabase) return;

    const dayS = dayStart(date);
    const dayE = dayEnd(date);
    const today = fmtDate(new Date());
    const isToday = date === today;

    // 7 days ago for no-show calc
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const sevenAgo = dayStart(fmtDate(d7));

    const [
      seatedRes,
      queueRes,
      seatedTimesRes,
      noShowNotifiedRes,
      noShowCancelledRes,
      redemptionsRes,
      allDayRes,
      tablesRes,
      customersRes,
    ] = await Promise.all([
      // 1. Cubiertos hoy
      supabase.from("waitlist")
        .select("id, party_size", { count: "exact" })
        .eq("status", "seated")
        .gte("seated_at", dayS)
        .lte("seated_at", dayE),
      // 2. En fila ahora (only meaningful for today)
      isToday
        ? supabase.from("waitlist")
            .select("id", { count: "exact", head: true })
            .in("status", ["waiting", "notified", "extended"])
        : Promise.resolve({ count: 0 }),
      // 3. Espera promedio (seated entries with joined_at + seated_at)
      supabase.from("waitlist")
        .select("joined_at, seated_at")
        .eq("status", "seated")
        .gte("seated_at", dayS)
        .lte("seated_at", dayE)
        .not("joined_at", "is", null),
      // 4a. No-show: notified in last 7 days
      supabase.from("waitlist")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled")
        .gte("notified_at", sevenAgo)
        .not("notified_at", "is", null),
      // 4b. No-show: total notified that reached a terminal state in 7 days
      supabase.from("waitlist")
        .select("id", { count: "exact", head: true })
        .in("status", ["seated", "cancelled"])
        .gte("notified_at", sevenAgo)
        .not("notified_at", "is", null),
      // 6. Redemptions barra
      supabase.from("bar_redemptions")
        .select("id", { count: "exact", head: true })
        .gte("redeemed_at", dayS)
        .lte("redeemed_at", dayE),
      // 7. Source breakdown - all day entries
      supabase.from("waitlist")
        .select("id, source, customer_id")
        .gte("joined_at", dayS)
        .lte("joined_at", dayE),
      // 9. Tables
      supabase.from("tables").select("id, capacity, status"),
      // 5 + 8. Customers for seated entries (visit_count, trust_level)
      supabase.from("customers").select("id, visit_count, trust_level"),
    ]);

    // 1. Cubiertos - sum party_size
    const cubiertos = (seatedRes.data || []).reduce((s, r) => s + (r.party_size || 0), 0);
    const seatedCount = seatedRes.count || (seatedRes.data || []).length;

    // 2. En fila
    const enFila = queueRes.count || 0;

    // 3. Espera promedio
    const waits = (seatedTimesRes.data || [])
      .filter(r => r.joined_at && r.seated_at)
      .map(r => (new Date(r.seated_at) - new Date(r.joined_at)) / 60000);
    const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;

    // 4. No-show rate
    const nsCancelled = noShowNotifiedRes.count || 0;
    const nsTotal = noShowCancelledRes.count || 0;
    const noShowRate = nsTotal ? (nsCancelled / nsTotal * 100).toFixed(1) : null;

    // 5. Nuevos vs Recurrentes
    const seatedCustomerIds = (seatedRes.data || []).map(r => r.id);
    // We need customer_id for seated entries - re-query with customer_id
    const { data: seatedWithCust } = await supabase.from("waitlist")
      .select("customer_id")
      .eq("status", "seated")
      .gte("seated_at", dayS)
      .lte("seated_at", dayE);

    const custMap = {};
    (customersRes.data || []).forEach(c => { custMap[c.id] = c; });

    let nuevos = 0, recurrentes = 0;
    (seatedWithCust || []).forEach(w => {
      const c = custMap[w.customer_id];
      if (c && c.visit_count > 1) recurrentes++;
      else nuevos++;
    });

    // 6. Redemptions
    const redemptions = redemptionsRes.count || 0;

    // 7. Source breakdown
    const sources = {};
    (allDayRes.data || []).forEach(r => {
      const s = r.source || "otro";
      sources[s] = (sources[s] || 0) + 1;
    });

    // 8. Trust distribution
    const trust = { 0: 0, 1: 0, 2: 0, 3: 0 };
    (customersRes.data || []).forEach(c => {
      const lvl = c.trust_level ?? 0;
      if (trust[lvl] !== undefined) trust[lvl]++;
    });

    // 9. Tables
    const tableData = tablesRes.data || [];
    const mesasLibres = tableData.filter(t => t.status === "libre").length;
    const mesasOcupadas = tableData.filter(t => t.status !== "libre").length;
    const totalMesas = tableData.length;

    setData({
      cubiertos, seatedCount, enFila, avgWait, noShowRate,
      nuevos, recurrentes, redemptions, sources,
      trust, mesasLibres, mesasOcupadas, totalMesas,
      isToday,
    });
    setLastRefresh(new Date());
    setLoading(false);
  }, [date]);

  // Fetch on mount + date change, auto-refresh
  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetchData();
    const iv = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(iv);
  }, [authed, fetchData]);

  if (!authed) return <PinGate onAuth={() => setAuthed(true)} />;

  const d = data;

  // Source label map
  const sourceLabels = {
    qr: "QR", whatsapp: "WhatsApp", walkin: "Walk-in",
    opentable: "OpenTable", instagram: "Instagram", phone: "Tel",
  };
  const sourceColors = {
    qr: T.accent, whatsapp: "#25D366", walkin: T.warn,
    opentable: "#DA3743", instagram: "#E1306C", phone: T.textMed,
  };

  const trustLabels = ["Nuevo", "Regular", "VIP", "VVIP"];
  const trustColors = [T.textLight, T.textMed, T.gold, T.success];

  return (
    <div style={{
      minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans,
      paddingBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.cardBorder}`,
        padding: "16px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontFamily: f.display, fontWeight: 700, color: T.text }}>
            Meantime
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
            color: T.textLight, background: T.accentLight, padding: "3px 10px",
            borderRadius: 6,
          }}>
            Analytics
          </span>
        </div>
        {lastRefresh && (
          <div style={{ fontSize: 11, color: T.textLight }}>
            {lastRefresh.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* Date picker */}
      <div style={{ padding: "16px 20px 0" }}>
        <input
          type="date"
          value={date}
          max={fmtDate(new Date())}
          onChange={e => setDate(e.target.value)}
          style={{
            width: "100%", padding: "12px 16px", fontSize: 15,
            fontFamily: f.sans, fontWeight: 600, color: T.text,
            border: `1.5px solid ${T.border}`, borderRadius: 12,
            background: T.card, outline: "none",
            WebkitAppearance: "none",
          }}
        />
      </div>

      {loading || !d ? (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: 60, color: T.textLight, fontSize: 14,
        }}>
          Cargando...
        </div>
      ) : (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Row 1: Cubiertos + En fila */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Cubiertos hoy" value={d.cubiertos} sub={`${d.seatedCount} mesas`} />
            <Metric
              label="En fila ahora"
              value={d.isToday ? d.enFila : "--"}
              sub={d.isToday ? null : "solo hoy"}
              color={d.enFila > 0 ? T.warn : T.text}
            />
          </div>

          {/* Row 2: Espera promedio + No-show */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric
              label="Espera promedio"
              value={d.avgWait !== null ? `${d.avgWait}m` : "--"}
              sub="joined \u2192 seated"
            />
            <Metric
              label="No-show rate"
              value={d.noShowRate !== null ? `${d.noShowRate}%` : "--"}
              sub="ult. 7 dias"
              color={d.noShowRate > 20 ? T.danger : d.noShowRate > 10 ? T.warn : T.success}
            />
          </div>

          {/* Nuevos vs Recurrentes */}
          <div style={card}>
            <div style={{
              fontSize: 12, color: T.textLight, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
            }}>
              Nuevos vs Recurrentes
            </div>
            {(d.nuevos + d.recurrentes) > 0 ? (
              <>
                <div style={{
                  display: "flex", borderRadius: 8, overflow: "hidden", height: 28,
                  background: T.accentLight,
                }}>
                  {d.nuevos > 0 && (
                    <div style={{
                      width: `${pct(d.nuevos, d.nuevos + d.recurrentes)}%`,
                      background: T.accent, display: "flex", alignItems: "center",
                      justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700,
                      minWidth: 32, transition: "width .4s ease",
                    }}>
                      {d.nuevos}
                    </div>
                  )}
                  {d.recurrentes > 0 && (
                    <div style={{
                      flex: 1, display: "flex", alignItems: "center",
                      justifyContent: "center", color: T.text, fontSize: 12, fontWeight: 700,
                    }}>
                      {d.recurrentes}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: T.textMed }}>
                  <span>Nuevos ({pct(d.nuevos, d.nuevos + d.recurrentes)}%)</span>
                  <span>Recurrentes ({pct(d.recurrentes, d.nuevos + d.recurrentes)}%)</span>
                </div>
              </>
            ) : (
              <div style={{ color: T.textLight, fontSize: 14 }}>Sin datos</div>
            )}
          </div>

          {/* Redemptions + Mesas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Redemptions barra" value={d.redemptions} sub="hoy" color={T.gold} />
            <div style={card}>
              <div style={{
                fontSize: 12, color: T.textLight, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: 0.5,
              }}>
                Mesas
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 700, fontFamily: f.display, color: T.success }}>
                  {d.mesasLibres}
                </span>
                <span style={{ fontSize: 14, color: T.textMed }}>
                  / {d.totalMesas}
                </span>
              </div>
              <div style={{ fontSize: 13, color: T.textMed, marginTop: 2 }}>
                {d.mesasOcupadas} ocupadas
              </div>
            </div>
          </div>

          {/* Source breakdown */}
          <div style={card}>
            <div style={{
              fontSize: 12, color: T.textLight, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
            }}>
              Fuentes del dia
            </div>
            {Object.keys(d.sources).length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(d.sources)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <span key={src} style={pill(
                      (sourceColors[src] || T.textMed) + "18",
                      sourceColors[src] || T.textMed,
                    )}>
                      {sourceLabels[src] || src}
                      <span style={{
                        background: sourceColors[src] || T.textMed,
                        color: "#fff", borderRadius: 999, minWidth: 20, textAlign: "center",
                        padding: "1px 6px", fontSize: 11, fontWeight: 700,
                      }}>
                        {count}
                      </span>
                    </span>
                  ))}
              </div>
            ) : (
              <div style={{ color: T.textLight, fontSize: 14 }}>Sin entradas</div>
            )}
          </div>

          {/* Trust distribution */}
          <div style={card}>
            <div style={{
              fontSize: 12, color: T.textLight, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
            }}>
              Trust distribution
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[0, 1, 2, 3].map(lvl => {
                const total = d.trust[0] + d.trust[1] + d.trust[2] + d.trust[3];
                const w = total ? (d.trust[lvl] / total * 100) : 0;
                return (
                  <div key={lvl} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      height: 48, background: T.accentLight, borderRadius: 8,
                      position: "relative", overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        height: `${Math.max(w, 4)}%`,
                        background: trustColors[lvl], borderRadius: 8,
                        transition: "height .4s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: f.display, marginTop: 6, color: T.text }}>
                      {d.trust[lvl]}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMed, fontWeight: 600 }}>
                      {trustLabels[lvl]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
