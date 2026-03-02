// ═══════════════════════════════════════════════════
// DESIGN TOKENS — Meantime · Restaurant Waitlist
// Premium hospitality aesthetic
// ═══════════════════════════════════════════════════
export const T = {
  accent: "#2D7A4F", accentLight: "#E8F5EE", accentSoft: "#F5FBF7",
  bg: "#FFFFFF", bgPage: "#FAFAF8",
  card: "#FFFFFF", shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)", radius: "16px",
  text: "#1A1A1A", textMed: "#6B6B6B", textLight: "#9B9B9B",
  border: "#EBEBEB",
  warn: "#D4942A", danger: "#C93B3B",
};

// Google Fonts loaded in layout.js
export const f = {
  display: "'DM Serif Display', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// App config
export const APP_NAME = "Meantime";

// Restaurant config (overridable per restaurant in future)
export const RESTAURANT = {
  name: "Chuí",
  address: "Loyola 1250, Villa Crespo",
  lat: -34.5975, lng: -58.4365,
  walkAroundRadius: 300,
  walkAroundMinutes: 15,
  otLink: "https://www.opentable.com/r/chui-buenos-aires",
};
