"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { T, f } from "../../lib/tokens";
import { useTenant } from "../../lib/use-tenant";

const BAR_PIN_DEFAULT = "1250";
const SESSION_KEY = "meantime_bar_auth";

const PROMO_ITEMS = ["Cerveza tirada", "Copa de vino", "Vermut"];
const PAID_ITEMS = ["Cerveza", "Vino", "Fernet", "Negroni", "Otro"];

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function verificationCode(waitlistId) {
  if (!waitlistId) return "--------";
  return waitlistId.slice(0, 8).toUpperCase();
}

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { start: `${today}T00:00:00`, end: `${today}T23:59:59` };
}

// ── PIN Screen ──────────────────────────────────────
function PinScreen({ onAuth, tenantPin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const BAR_PIN = tenantPin || BAR_PIN_DEFAULT;

  const submit = () => {
    if (pin === BAR_PIN) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
      onAuth();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: T.accent, padding: 24,
    }}>
      <div style={{
        fontSize: 13, fontFamily: f.sans, letterSpacing: 3,
        color: T.gold, textTransform: "uppercase", marginBottom: 8,
      }}>Meantime</div>
      <div style={{
        fontSize: 22, fontFamily: f.display, fontWeight: 700,
        color: "#fff", marginBottom: 32,
      }}>Bar POS Lite</div>
      <input
        type="password" inputMode="numeric" maxLength={4}
        value={pin} onChange={e => { setPin(e.target.value); setError(false); }}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="PIN"
        style={{
          width: 160, textAlign: "center", fontSize: 28,
          fontFamily: f.display, letterSpacing: 12,
          padding: "14px 16px", borderRadius: 12,
          border: `2px solid ${error ? T.danger : T.gold}`,
          background: "rgba(255,255,255,0.06)", color: "#fff",
          outline: "none",
        }}
      />
      <button onClick={submit} style={{
        marginTop: 20, padding: "12px 48px", borderRadius: 12,
        background: T.gold, color: "#fff", border: "none",
        fontFamily: f.display, fontWeight: 600, fontSize: 15, cursor: "pointer",
      }}>Entrar</button>
      {error && <div style={{ color: T.danger, marginTop: 12, fontFamily: f.sans, fontSize: 14 }}>
        PIN incorrecto
      </div>}
    </div>
  );
}

// ── Add Consumption Modal ───────────────────────────
function AddConsumptionModal({ guest, onClose, onSave }) {
  const [item, setItem] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const finalItem = item === "Otro" ? customItem : item;

  const save = async () => {
    if (!finalItem || !price) return;
    setSaving(true);
    await onSave({
      waitlist_id: guest.waitlist_id,
      customer_id: guest.customer_id,
      guest_name: guest.guest_name,
      item: finalItem,
      is_promo: false,
      price: parseFloat(price),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 480, padding: "24px 20px 32px",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          fontFamily: f.display, fontWeight: 700, fontSize: 18,
          color: T.text, marginBottom: 4,
        }}>Agregar consumo</div>
        <div style={{
          fontFamily: f.sans, fontSize: 14, color: T.textMed, marginBottom: 20,
        }}>{guest.guest_name}</div>

        {/* Quick item buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {PAID_ITEMS.map(i => (
            <button key={i} onClick={() => setItem(i)} style={{
              padding: "8px 16px", borderRadius: 10,
              border: `1.5px solid ${item === i ? T.gold : T.border}`,
              background: item === i ? T.goldLight : "#fff",
              fontFamily: f.sans, fontSize: 14, fontWeight: item === i ? 600 : 400,
              color: item === i ? T.gold : T.text, cursor: "pointer",
            }}>{i}</button>
          ))}
        </div>

        {item === "Otro" && (
          <input
            value={customItem} onChange={e => setCustomItem(e.target.value)}
            placeholder="Nombre del item..."
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: `1.5px solid ${T.border}`, fontFamily: f.sans,
              fontSize: 15, marginBottom: 12, outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}

        <div style={{
          fontFamily: f.sans, fontSize: 13, color: T.textMed,
          marginBottom: 6, fontWeight: 600,
        }}>Precio ($)</div>
        <input
          type="number" inputMode="decimal" value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="0.00"
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 10,
            border: `1.5px solid ${T.border}`, fontFamily: f.display,
            fontSize: 20, fontWeight: 600, marginBottom: 20,
            outline: "none", boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "14px 0", borderRadius: 12,
            border: `1.5px solid ${T.border}`, background: "#fff",
            fontFamily: f.display, fontWeight: 600, fontSize: 15,
            color: T.textMed, cursor: "pointer",
          }}>Cancelar</button>
          <button onClick={save} disabled={!finalItem || !price || saving} style={{
            flex: 1, padding: "14px 0", borderRadius: 12,
            border: "none", background: (!finalItem || !price) ? T.border : T.gold,
            fontFamily: f.display, fontWeight: 600, fontSize: 15,
            color: "#fff", cursor: (!finalItem || !price) ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}>{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Bar Dashboard ──────────────────────────────
export default function BarDashboard() {
  const { tenant } = useTenant();
  const [authed, setAuthed] = useState(false);
  const [redemptions, setRedemptions] = useState([]);
  const [waitlistMap, setWaitlistMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(null);

  useEffect(() => {
    document.title = "Meantime — Barra";
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    const { start, end } = todayRange();

    const [redemptRes, waitlistRes] = await Promise.all([
      supabase
        .from("bar_redemptions")
        .select("*")
        .gte("redeemed_at", start)
        .lte("redeemed_at", end)
        .order("redeemed_at", { ascending: false }),
      supabase
        .from("waitlist")
        .select("id, status, guest_name")
        .in("status", ["waiting", "notified", "extended", "seated"]),
    ]);

    if (redemptRes.data) setRedemptions(redemptRes.data);
    if (waitlistRes.data) {
      const m = {};
      waitlistRes.data.forEach(w => { m[w.id] = w; });
      setWaitlistMap(m);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [authed, fetchData]);

  // Realtime subscription on bar_redemptions
  useEffect(() => {
    if (!authed || !supabase) return;
    const channel = supabase
      .channel("bar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bar_redemptions" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authed, fetchData]);

  const saveConsumption = async (payload) => {
    if (!supabase) return;
    await supabase.from("bar_redemptions").insert({
      ...payload,
      redeemed_at: new Date().toISOString(),
    });
    fetchData();
  };

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} tenantPin={tenant?.pin} />;

  // -- Compute stats --
  const promos = redemptions.filter(r => r.is_promo !== false && r.is_promo !== 0);
  const paid = redemptions.filter(r => r.is_promo === false || r.is_promo === 0);
  const paidTotal = paid.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const totalRevenue = paidTotal;

  const statusOf = (wid) => {
    const w = waitlistMap[wid];
    if (!w) return { label: "Desconocido", color: T.textLight };
    if (w.status === "seated") return { label: "Sentado", color: T.success };
    return { label: "En cola", color: T.warn };
  };

  return (
    <div style={{
      minHeight: "100dvh", background: T.bgPage, fontFamily: f.sans,
      paddingBottom: 32,
    }}>
      {/* Header */}
      <div style={{
        background: T.accent, padding: "20px 20px 24px",
        borderRadius: "0 0 24px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{
              fontSize: 11, letterSpacing: 3, color: T.gold,
              textTransform: "uppercase", fontFamily: f.sans, fontWeight: 600,
              marginBottom: 2,
            }}>Meantime</div>
            <div style={{
              fontSize: 22, fontFamily: f.display, fontWeight: 700,
              color: "#fff",
            }}>Barra</div>
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.5)",
            fontFamily: f.sans,
          }}>{new Date().toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</div>
        </div>

        {/* Revenue summary cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10, marginTop: 20,
        }}>
          {/* Promos */}
          <div style={{
            background: "rgba(184,148,62,0.15)", borderRadius: 14,
            padding: "14px 12px", textAlign: "center",
          }}>
            <div style={{
              fontSize: 26, fontFamily: f.display, fontWeight: 700,
              color: T.gold,
            }}>{promos.length}</div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.6)",
              fontFamily: f.sans, marginTop: 2,
            }}>2x1 hoy</div>
          </div>
          {/* Paid */}
          <div style={{
            background: "rgba(255,255,255,0.07)", borderRadius: 14,
            padding: "14px 12px", textAlign: "center",
          }}>
            <div style={{
              fontSize: 26, fontFamily: f.display, fontWeight: 700,
              color: "#fff",
            }}>{paid.length}</div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.6)",
              fontFamily: f.sans, marginTop: 2,
            }}>Consumos</div>
          </div>
          {/* Revenue */}
          <div style={{
            background: "rgba(45,122,79,0.2)", borderRadius: 14,
            padding: "14px 12px", textAlign: "center",
          }}>
            <div style={{
              fontSize: 22, fontFamily: f.display, fontWeight: 700,
              color: "#7ED8A4",
            }}>${totalRevenue.toLocaleString("es-AR")}</div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.6)",
              fontFamily: f.sans, marginTop: 2,
            }}>Revenue</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px" }}>
        {loading ? (
          <div style={{
            textAlign: "center", padding: 60, color: T.textLight,
            fontFamily: f.sans, fontSize: 15,
          }}>Cargando...</div>
        ) : (
          <>
            {/* Promo Redemptions section */}
            <div style={{
              fontFamily: f.display, fontWeight: 700, fontSize: 16,
              color: T.text, marginBottom: 14, display: "flex",
              alignItems: "center", gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: T.gold, display: "inline-block",
              }} />
              Promociones 2x1 activas
            </div>

            {promos.length === 0 ? (
              <div style={{
                background: T.goldLight, borderRadius: 14,
                padding: "28px 20px", textAlign: "center",
                color: T.textMed, fontFamily: f.sans, fontSize: 14,
                marginBottom: 28, border: `1px solid ${T.cardBorder}`,
              }}>Ninguna promo canjeada hoy</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {promos.map(r => {
                  const st = statusOf(r.waitlist_id);
                  return (
                    <div key={r.id} style={{
                      background: T.card, borderRadius: 14,
                      border: `1px solid ${T.cardBorder}`,
                      boxShadow: T.shadow, padding: "16px 16px 14px",
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", marginBottom: 10,
                      }}>
                        <div>
                          <div style={{
                            fontFamily: f.display, fontWeight: 700,
                            fontSize: 16, color: T.text,
                          }}>{r.guest_name || "Sin nombre"}</div>
                          <div style={{
                            fontFamily: f.sans, fontSize: 13,
                            color: T.gold, fontWeight: 600, marginTop: 2,
                          }}>{r.item}</div>
                        </div>
                        <div style={{
                          fontSize: 11, fontFamily: f.sans, fontWeight: 600,
                          color: st.color, background: st.color === T.success ? T.successLight : T.warnLight,
                          padding: "4px 10px", borderRadius: 8,
                        }}>{st.label}</div>
                      </div>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center",
                      }}>
                        <div style={{
                          fontFamily: "'Courier New', monospace",
                          fontSize: 14, fontWeight: 700,
                          color: T.accent, background: T.accentLight,
                          padding: "4px 10px", borderRadius: 6,
                          letterSpacing: 1.5,
                        }}>{verificationCode(r.waitlist_id)}</div>
                        <div style={{
                          fontFamily: f.sans, fontSize: 12, color: T.textLight,
                        }}>{fmtTime(r.redeemed_at)}</div>
                      </div>
                      {/* Add consumption button */}
                      <button
                        onClick={() => setAddModal(r)}
                        style={{
                          marginTop: 12, width: "100%", padding: "10px 0",
                          borderRadius: 10, border: `1.5px solid ${T.border}`,
                          background: "#fff", fontFamily: f.sans,
                          fontSize: 13, fontWeight: 600, color: T.textMed,
                          cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>+</span> Agregar consumo
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paid Consumptions section */}
            <div style={{
              fontFamily: f.display, fontWeight: 700, fontSize: 16,
              color: T.text, marginBottom: 14, display: "flex",
              alignItems: "center", gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: T.success, display: "inline-block",
              }} />
              Consumos pagos hoy
            </div>

            {paid.length === 0 ? (
              <div style={{
                background: T.successLight, borderRadius: 14,
                padding: "28px 20px", textAlign: "center",
                color: T.textMed, fontFamily: f.sans, fontSize: 14,
                border: `1px solid ${T.cardBorder}`,
              }}>Sin consumos pagos registrados</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {paid.map(r => (
                  <div key={r.id} style={{
                    background: T.card, borderRadius: 12,
                    border: `1px solid ${T.cardBorder}`,
                    padding: "12px 16px",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{
                        fontFamily: f.display, fontWeight: 600,
                        fontSize: 14, color: T.text,
                      }}>{r.guest_name || "Sin nombre"}</div>
                      <div style={{
                        fontFamily: f.sans, fontSize: 13,
                        color: T.textMed,
                      }}>{r.item} &middot; {fmtTime(r.redeemed_at)}</div>
                    </div>
                    <div style={{
                      fontFamily: f.display, fontWeight: 700,
                      fontSize: 16, color: T.success,
                    }}>${parseFloat(r.price || 0).toLocaleString("es-AR")}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Consumption modal */}
      {addModal && (
        <AddConsumptionModal
          guest={addModal}
          onClose={() => setAddModal(null)}
          onSave={saveConsumption}
        />
      )}
    </div>
  );
}
