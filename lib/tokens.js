// ═══════════════════════════════════════════════════
// DESIGN TOKENS — Meantime · Restaurant Waitlist
// Ultra-premium hospitality aesthetic
// ═══════════════════════════════════════════════════
export const T = {
  // Primary palette — warm neutrals + deep black accent
  accent: "#1A1A1A",
  accentLight: "#F0EEEB",
  accentSoft: "#F7F6F3",

  // Backgrounds
  bg: "#FFFFFF",
  bgPage: "#FAF9F7",
  bgWarm: "#F5F3EF",

  // Cards
  card: "#FFFFFF",
  cardBorder: "#EDEBE7",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  radius: "20px",
  radiusSm: "14px",

  // Typography
  text: "#1A1A1A",
  textMed: "#5C5C5C",
  textLight: "#9A9590",

  // Borders
  border: "#E5E2DD",

  // Status
  success: "#2D7A4F",
  successLight: "#E8F5EE",
  warn: "#C4872A",
  warnLight: "#FFF6EC",
  danger: "#B83B3B",

  // Bicha accent (terracotta red, Juicy Marbles inspired)
  bicha: "#C84B31",
  bichaLight: "#C84B3120",

  // Special
  gold: "#B8943E",
  goldLight: "#FBF7EE",
};

// Google Fonts loaded in layout.js
export const f = {
  display: "'Outfit', sans-serif",
  sans: "'Nunito', -apple-system, sans-serif",
};

// App config
export const APP_NAME = "Meantime";

// Restaurant config (overridable per restaurant in future)
export const RESTAURANT = {
  name: "Chuí",
  address: "Loyola 1250, Villa Crespo",
  lat: -34.5962, lng: -58.4353,
  walkAroundRadius: 300,
  walkAroundMinutes: 15,
  otLink: "https://www.opentable.com/r/chui-buenos-aires",
};
