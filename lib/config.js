// ═══════════════════════════════════════════════════
// WHITE-LABEL CONFIG — Change this file to rebrand
// for any restaurant. All restaurant-specific values
// live here.
// ═══════════════════════════════════════════════════

export const CONFIG = {
  restaurant: {
    name: "Chuí",
    address: "Loyola 1250, Villa Crespo",
    lat: -34.59013,
    lng: -58.44112,
    walkAroundRadius: 300,
    walkAroundMinutes: 15,
    otLink: "https://www.opentable.com/r/chui-buenos-aires",
    instagram: "@chui.ba",
    instagramUrl: "https://instagram.com/chui.ba",
    googleReviewUrl: "https://g.page/chui-ba/review",
    logo: "/logo-dark.png",
    pin: "1250",
  },
  branding: {
    accentColor: "#2D7A4F",
    goldColor: "#B8943E",
  },
  features: {
    barPromo: true,
    walkAround: true,
    referral: true,
    preOrder: true,
    gpsTracking: true,
  },
  waitlist: {
    arrivalMinutes: 10,
    graceMinutes: 5,
    autoCleanupHours: 6,
    longWaitHours: 3,
  },
};
