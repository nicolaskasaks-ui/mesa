"use client";

import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════
// DESIGN TOKENS — OpenTable exact + Chuí green swap
// ═══════════════════════════════════════════════════
const T = {
  // OpenTable uses #DA3743 red — we swap to Chuí green
  accent: "#2D7A4F",
  accentLight: "#E8F5EE",
  accentSoft: "#F5FBF7",
  // Backgrounds
  bg: "#FFFFFF",
  bgPage: "#F6F6F4",
  // Cards — OpenTable uses white cards on light gray, very subtle shadow
  card: "#FFFFFF",
  shadow: "0 1px 4px rgba(0,0,0,0.06)",
  shadowHover: "0 2px 8px rgba(0,0,0,0.1)",
  radius: "16px",
  // Text — OpenTable uses very dark near-black + medium grays
  text: "#1B1B1B",
  textMed: "#6F6F6F",
  textLight: "#9B9B9B",
  textFaint: "#C5C5C5",
  // Borders
  border: "#EBEBEB",
  borderDark: "#D4D4D4",
  // Semantic
  warm: "#C4956A",
  warmBg: "#FDF6EF",
  warmBorder: "#ECD9C5",
  amber: "#D4842A",
  amberBg: "#FFF8F0",
  amberBorder: "#F0D9BD",
  red: "#DA3743",
  success: "#2D7A4F",
};

const f = {
  // OpenTable uses a clean sans-serif (their custom "Brandon" or system)
  // We use system sans for body, Georgia for the Mesa wordmark only
  sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
};

// ─── SMART MENU ROUTING ───
// hour + browser language → correct menu automatically
function getMenuKey() {
  const now = new Date();
  const h = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const lang = (typeof navigator !== "undefined" ? navigator.language : "es").toLowerCase();
  const en = lang.startsWith("en");
  // Weekends: night menu all day
  if (day === 0 || day === 6) return en ? "night_en" : "night_es";
  // Weekdays: time-based
  if (h >= 12 && h < 16) return en ? "noon_en" : "noon_es";
  if (h >= 16 && h < 19) return en ? "afternoon_en" : "afternoon_es";
  return en ? "night_en" : "night_es";
}
const MENU_TABS_ES = ["noon_es","afternoon_es","night_es","wines","bar"];
const MENU_TABS_EN = ["noon_en","afternoon_en","night_en","wines","bar"];
const MENU_TAB_LABELS = { noon_es:"Mediodía", noon_en:"Noon", afternoon_es:"Tarde", afternoon_en:"Afternoon", night_es:"Noche", night_en:"Evening", wines:"Vinos", bar:"Bebidas" };

const M = {
  noon_es: { sections: [
    { t:"Platitos", items:[{n:"Focaccia de masa madre a la leña",p:3000,g:["V"]},{n:"Gazpachito de sandía y tomate, ajoblanco, croutons",p:6500,g:["V"]},{n:"Paté de hongos, pickles de apio, vinagre de la casa",p:8000,g:["V","GF"]},{n:"Palta quemada, kimchi, leche de tigre",p:10500,g:["V","P","GF"]},{n:"Pimientos calahorra a la leña, salsa harissa, salvia frita",p:12000,g:["V","P","GF"]},{n:"Queso Llanero, vinagre de frutas, ají de Cachi, orégano",p:8000,p2:13500,g:["GF"]},{n:"Tomates reliquia, cebolla morada, AOVE",p:9500,g:["V","GF"]},{n:"Ensalada de mix de hojas, vinagreta de ají amarillo, limones quemados, nabos encurtidos",p:9200,g:["V","P","GF"]}]},
    { t:"Platos", items:[{n:"Canelón de ricota y cuartirolo, garrapiñada de almendras, salsa blanca gratinada a la leña",p:19200,g:[]},{n:"Fainá a la leña, ají vinagrero, cebollas quemadas",p:18900,g:["V","GF"]},{n:"Milanesa de gírgolas, puré de papas, manteca tostada",p:19300,g:[]},{n:"Ñoquis de sémola y queso romel, crema ahumada, tomates, alcaparrones",p:18300,g:[]},{n:"Tacos de gírgolas anticucheras, mole verde, alioli de huacatay",p:17900,g:["V","P","GF"]}]},
    { t:"Pizza", s:"48hs fermentación · harinas agroecológicas", items:[{n:"Fugazzeta; cebolla, parmesano, orégano",p:20500,g:[]},{n:"Boniato, escabeche de gírgolas, pesto, cajú",p:22000,g:["V"]},{n:"Marinara",p:19000,g:["V","P"]},{n:"Margherita; tomate orgánico, stracciatella, albahaca",p:22000,g:[]},{n:"Cuatro quesos",p:22000,g:[]}]},
    { t:"Sandwiches", s:"con chips de batata", items:[{n:"Milanesa de gírgolas, mostaza de cúrcuma, ketchup casero, huevo frito, pepino pickle",p:17000,g:["V*"]},{n:"Berenjena, reggianito, ají encurtido, alioli ahumado, cebolla crujiente",p:17000,g:["P"]}]},
    { t:"Dulces", items:[{n:"Butterscotch",p:7500,g:["GF"]},{n:"Pastelera de mango, honeycrumb, chocolate blanco",p:9800,g:["GF"]},{n:"Mousse de chocolate, merengue ácido, frutos rojos",p:12000,g:["V","GF"]},{n:"Carrot cake, glaseado de cajú",p:10500,g:["V","GF"]}]},
  ]},
  noon_en: { sections: [
    { t:"Small Plates", items:[{n:"Wood-fired sourdough focaccia",p:3000,g:["V"]},{n:"Tomato & watermelon gazpachito, ajoblanco, croutons",p:6500,g:["V","S","GF"]},{n:"Mushroom pâté, pickled celery, house vinegar",p:8000,g:["V","GF"]},{n:"Charred avocado, kimchi, 'leche de tigre'",p:10500,g:["V","S","GF"]},{n:"Wood-fired calahorra peppers, harissa, fried sage",p:12000,g:["V","S","GF"]},{n:"Burnt Llanero cheese, fruit vinegar, hot sauce, oregano",p:8000,p2:13500,g:["GF"]},{n:"Heirloom tomatoes, red onion, evoo",p:9500,g:["V","S","GF"]},{n:"Greens salad, yellow chilli vinaigrette, charred lemons, pickled turnips",p:9200,g:["V","GF"]}]},
    { t:"Plates", items:[{n:"Ricotta & cuartirolo cannelloni, almond praline, gratinated white sauce",p:19200,g:[]},{n:"Wood-fired faina, pickled chilli, roasted onions",p:18900,g:["V","GF"]},{n:"Oyster mushrooms milanesa, potato puree, noisette butter",p:19300,g:[]},{n:"Semolina & romel cheese gnocchi, smoked cream, capers, olives",p:18300,g:[]},{n:"Anticuchera oyster mushroom tacos, green mole, black mint aioli",p:17900,g:["V","S","GF"]}]},
    { t:"Pizza", s:"48hs fermentation · organic flour", items:[{n:"Fugazzeta; onions, parmesan, oregano",p:20500,g:[]},{n:"Sweet potato, pickled oyster mushrooms, basil pesto, cashew",p:22000,g:["V"]},{n:"Marinara",p:19000,g:["V","S"]},{n:"Margherita; organic tomato, stracciatella, basil",p:22000,g:[]},{n:"Four cheese",p:22000,g:[]}]},
    { t:"Sandwiches", s:"with sweet potato chips", items:[{n:"Oyster mushrooms milanesa, turmeric mustard, ketchup, egg, pickle",p:17000,g:["V*"]},{n:"Eggplant, Reggianito, pickled pepper, smoked aioli, crispy onion",p:17000,g:["S"]}]},
    { t:"Sweet", items:[{n:"Butterscotch",p:7500,g:["GF"]},{n:"Mango pastry cream, honeycrumb, white chocolate",p:9800,g:["GF"]},{n:"Chocolate mousse, tangy meringue, red berries",p:12000,g:["V","GF"]},{n:"Carrot cake, cashew frosting",p:10500,g:["V","GF"]}]},
  ]},
  afternoon_es: { sections: [
    { t:"Platitos", items:[{n:"Pan de pizza, oliva extra virgen",p:3900,g:["V"]},{n:"Paté de hongos, pickles de apio, vinagre de la casa",p:8000,g:["V","GF"]},{n:"Hummus de remolachas asadas, crema ácida, vinagreta de hierbas",p:7500,g:["GF"]},{n:"Papas tres cocciones, mayonesa de huevo frito, yema curada",p:12500,g:["GF"]},{n:"Costra de queso: gouda y provolone, cebollas quemadas, vegetales y jalapeño",p:13500,g:["P","GF"]},{n:"Guacamole, totopos, salsa verde, porotos, crema ácida, jalapeños",p:14500,g:["P","GF"]}]},
    { t:"Sandwiches", items:[{n:"Doble Magic: brioche, gírgolas, papas paille, salsa de chiles verdes",p:14000,g:["V","P"]},{n:"Milanesa de gírgolas, mostaza de cúrcuma, ketchup, huevo frito, pickle",p:17000,g:["V*"]},{n:"Berenjena, reggianito, ají encurtido, alioli ahumado, cebolla crujiente",p:17000,g:["P"]},{n:"Bao crujiente, melena de león anticuchera, alioli de jalapeños",p:13500,g:["V","P"]}]},
    { t:"Dulce", items:[{n:"Carrot cake",p:10500,g:["V","GF"]}]},
    { t:"Bebidas", items:[{n:"Vermut Carpano Rosso/Bianco + soda",p:13000,g:[],x:"2×"},{n:"Stella Artois",p:10000,g:[],x:"2×"}]},
  ]},
  afternoon_en: { sections: [
    { t:"Small Plates", items:[{n:"Pizza bread, evoo",p:3900,g:["V"]},{n:"Mushroom pâté, pickled celery, house vinegar",p:8000,g:["V","GF"]},{n:"Roasted beet hummus, sour cream, herb vinaigrette",p:7500,g:["GF"]},{n:"Smashed potatoes, fried egg mayo, cured yolk",p:12500,g:["GF"]},{n:"Crispy cheese crust: gouda & provolone, burnt onions, jalapeños",p:13500,g:["S","GF"]},{n:"Guacamole, totopos, green sauce, red beans, sour cream, jalapeños",p:14500,g:["S"]}]},
    { t:"Sandwiches", items:[{n:"Double Magic: brioche, oyster mushrooms, shoestring potatoes, green chili",p:14000,g:["V","S"]},{n:"Oyster mushrooms milanesa, turmeric mustard, ketchup, egg, pickle",p:17000,g:["V*"]},{n:"Eggplant, reggianito, smoked aioli, crispy onion",p:17000,g:["S"]},{n:"Crispy bao, lion's mane anticuchera, jalapeño aioli",p:13500,g:["V","S"]}]},
    { t:"Sweet", items:[{n:"Carrot cake",p:10500,g:["V","GF"]}]},
    { t:"Drinks", items:[{n:"Vermut Carpano Rosso/Bianco + soda",p:13000,g:[],x:"2×"},{n:"Stella Artois",p:10000,g:[],x:"2×"}]},
  ]},
  night_es: { sections: [
    { t:"Platitos", items:[{n:"Focaccia de masa madre a la leña",p:3300,g:["V"]},{n:"Gazpachito de sandía y tomate, ajoblanco, croutons",p:6500,g:["V"]},{n:"Paté de hongos, pickles de apio, vinagre de la casa",p:8900,g:["V","GF"]},{n:"Palta quemada, kimchi, leche de tigre",p:11700,g:["V","P","GF"]},{n:"Ensalada de verdes, vinagreta de ají amarillo, limones quemados",p:10500,g:["V","P","GF"]},{n:"Tostón de maíz frito, sandía ahumada, cremoso de palta y wasabi",p:9800,g:["V","GF"]},{n:"Queso Llanero, vinagre de frutas, ají de Cachi",p:8500,p2:14200,g:["GF"]},{n:"Tomates reliquia, cebolla morada, AOVE, orégano",p:9800,g:["V","GF"]},{n:"Maíz amarillo frito, manteca de ajo, tajín, mayo de jalapeños",p:8900,g:["P","GF"]}]},
    { t:"Platos", items:[{n:"Polenta blanca grillada, tomate reliquia y olivas, emulsión de albahaca, feta",p:23700,g:["GF"]},{n:"Omelette de berenjena ahumada, alioli quemado, ajíes amarillos",p:18900,g:["P","GF"]},{n:"Papa Anna, stracciatella, ajo negro",p:25700,g:["GF"]},{n:"Fainá a la leña, ají vinagrero, cebollas quemadas",p:21900,g:["V","GF"]},{n:"Melena de león al ajilli, ensalada coreana de pepinos y nabos",p:28700,g:["V","P","GF"]}]},
    { t:"Pizza", s:"48hs fermentación · harinas agroecológicas", items:[{n:"Fugazzeta; cebolla, parmesano, orégano",p:20500,g:[]},{n:"Boniato, escabeche de gírgolas, pesto, cajú",p:24000,g:["V"]},{n:"Marinara",p:20000,g:["V","P"]},{n:"Margherita; tomate orgánico, stracciatella, albahaca",p:24000,g:[]},{n:"Cuatro quesos",p:24000,g:[]}]},
    { t:"Dulces", items:[{n:"Butterscotch",p:8500,g:["GF"]},{n:"Pastelera de mango, honeycrumb, chocolate blanco",p:9800,g:["GF"]},{n:"Mousse de chocolate, merengue ácido, frutos rojos",p:12000,g:["V","GF"]},{n:"Torta vasca, mermelada de jalapeño y fruta de estación",p:12700,g:["P","GF"]}]},
  ]},
  night_en: { sections: [
    { t:"Small Plates", items:[{n:"Wood-fired sourdough focaccia",p:3300,g:["V"]},{n:"Tomato & watermelon gazpachito, ajoblanco, croutons",p:6500,g:["V","S","GF"]},{n:"Mushroom pâté, pickled celery, house vinegar",p:8900,g:["V","GF"]},{n:"Charred avocado, kimchi, 'leche de tigre'",p:11700,g:["V","S","GF"]},{n:"Greens salad, yellow chilli vinaigrette, charred lemons, pickled turnips",p:10500,g:["V","GF"]},{n:"Fried corn tortilla, smoked watermelon, avocado & wasabi cream",p:9800,g:["V","GF"]},{n:"Burnt Llanero cheese, fruit vinegar, hot sauce",p:8500,p2:14200,g:["GF"]},{n:"Heirloom tomatoes, red onion, evoo",p:9800,g:["V","GF"]},{n:"Fried yellow corn, garlic butter, tajin, jalapeño aioli",p:8900,g:["S","GF"]}]},
    { t:"Plates", items:[{n:"Grilled white polenta, heirloom tomato & olives, basil emulsion, feta",p:23700,g:["GF"]},{n:"Smoked eggplant omelette, burnt aioli, yellow chili",p:18900,g:["S","GF"]},{n:"Pommes Anna, stracciatella, black garlic",p:25700,g:["GF"]},{n:"Wood-fired faina, pickled chilli, roasted onions",p:21900,g:["V","GF"]},{n:"Ajilli Lion's mane, korean cucumber & turnip salad",p:28700,g:["V","S","GF"]}]},
    { t:"Pizza", s:"48hs fermentation · organic flour", items:[{n:"Fugazzeta; onions, parmesan, oregano",p:20500,g:[]},{n:"Sweet potato, pickled mushrooms, basil pesto, cashew",p:24000,g:["V"]},{n:"Marinara",p:20000,g:["V","S"]},{n:"Margherita; organic tomato, stracciatella, basil",p:24000,g:[]},{n:"Four cheese",p:24000,g:[]}]},
    { t:"Sweet", items:[{n:"Butterscotch",p:8500,g:["GF"]},{n:"Mango pastry cream, honeycrumb, white chocolate",p:9800,g:["GF"]},{n:"Chocolate mousse, tangy meringue, red berries",p:12000,g:["V","GF"]},{n:"Basque cake, jalapeño & seasonal fruit jam",p:12700,g:["S","GF"]}]},
  ]},
  wines: { sections: [
    { t:"Blancos & Naranjos", items:[{n:"Laborum, Torrontés 2024",p:39200,g:[]},{n:"Eléctrico, Sauv Blanc - Chardonnay 2024",p:38500,g:[]},{n:"Antro, Chardonnay 2025",p:28000,g:[]},{n:"El Raro, Sauvignon Blanc 2024",p:48000,g:[]},{n:"Esperando a Los Bárbaros, Sauv Blanc - Semillón 2024",p:36000,g:[]},{n:"Polígonos, Semillón 2024",p:49000,g:[]},{n:"Contra Corriente, Chardonnay 2022",p:54000,g:[]},{n:"Livverá, Naranjo Malvasía 2024",p:42900,g:[]},{n:"Verum, Naranjo 2024",p:37800,g:[]},{n:"Solito Va, Naranjo 2025",p:37500,g:[]},{n:"La Marchigiana, Moscatel 2024",p:32000,g:[]}]},
    { t:"Tintos", items:[{n:"Les Astronautes, Malbec 2025",p:29500,g:[]},{n:"Nat'Cool, Bonarda 2022",p:32800,g:[]},{n:"Ribera del Cuarzo, Merlot 2022",p:43800,g:[]},{n:"Negra Margen, Bonarda 2023",p:35000,g:[]},{n:"Cara Sur, Criolla Chica 2023",p:54000,g:[]},{n:"Ver Sacrum, Monastrell 2024",p:41600,g:[]},{n:"Elephant Gun, Malbec 2024",p:24500,g:[]},{n:"Finca La Catalina, Pinot Noir 2024",p:43500,g:[]},{n:"La Voja, Pinot Noir 2023",p:46800,g:[]},{n:"Chacra 55, Pinot Noir 2024",p:128000,g:[]},{n:"Angélica Zapata Alta, Cab Franc 2021",p:52000,g:[]},{n:"Las Cuerdas Cota 1500, Malbec - Cab Franc 2023",p:62400,g:[]},{n:"A Lisa, Malbec 2023",p:64000,g:[]},{n:"Naciente, Cab Franc - Malbec",p:41600,g:[]}]},
    { t:"Rosados", items:[{n:"La Imaginación al Poder, Merlot 2024",p:39000,g:[]},{n:"El Afinador, Cab Franc 2022",p:30000,g:[]},{n:"Humberto Canale, Rosé Noir 2025",p:30000,g:[]},{n:"Inconsciente, Merlot Rosé 2025",p:25800,g:[]},{n:"Rocamadre, Pinot Noir 2024",p:37800,g:[]}]},
    { t:"Espumosos", items:[{n:"Nox Pet Nat, Malbec 2023",p:43500,g:[]},{n:"Alma 4, Pinot Noir - Chardonnay 2021",p:52000,g:[]},{n:"Alma Negra, Blanc de Blancs",p:55000,g:[]},{n:"Zuccardi, Blanc de Blancs",p:80000,g:[]}]},
    { t:"Copas", items:[{n:"De la casa (Bonarda / Rosé / Chardonnay)",p:9000,g:[]},{n:"Del día",p:13500,g:[]},{n:"Sodeado (jarra + soda + hielo)",p:14500,g:[]}]},
  ]},
  bar: { sections: [
    { t:"Bar", items:[{n:"Vermut & Aperitivos",p:7000,g:[]},{n:"Penicillin de la casa",p:14500,g:[]},{n:"Fernet Branca",p:9500,g:[]},{n:"Gin Tonic (Beefeater)",p:13500,g:[]},{n:"Spritz (Aperol / Lillet / Ramazzotti)",p:13500,g:[]},{n:"Martini (Seco / Sucio / De la casa)",p:14000,g:[]},{n:"Negroni de Barrica",p:13000,g:[]},{n:"Negroni Perfecto",p:14000,g:[]},{n:"Michelada",p:9800,g:[]},{n:"Bloody Mary",p:16500,g:[]},{n:"Ron Fashioned",p:14000,g:[]}]},
    { t:"Cervezas", items:[{n:"Stella Artois Caña / Porrón",p:6000,p2:8000,g:[]},{n:"Corona Porrón",p:8500,g:[]},{n:"Michelob Ultra",p:8500,g:["GF"]},{n:"Stella Artois 0%",p:8000,g:[]},{n:"Corona 0%",p:8500,g:[]}]},
    { t:"Sin alcohol", items:[{n:"Aguas Aqa",p:2800,g:[]},{n:"Acqua Panna 505ml",p:7300,g:[]},{n:"S. Pellegrino 505ml",p:7300,g:[]},{n:"Coca-Cola",p:4000,g:[]},{n:"Kombucha Ginger Ale",p:8500,g:[]},{n:"Mocktail",p:11000,g:[]}]},
    { t:"Jugos Cold Press", items:[{n:"Remolacha, manzana, apio, jengibre",p:9500,g:[]},{n:"Naranja, zanahoria, pera, cúrcuma",p:9500,g:[]},{n:"Manzana verde, pepino, espinaca, jengibre",p:9500,g:[]},{n:"Shot energético: jengibre, cúrcuma, limón",p:4500,g:[]}]},
    { t:"Café & Infusiones", items:[{n:"Filtrado americano (Samba, Brasil)",p:3800,g:[]},{n:"Con leche o leche vegetal",p:4200,g:[]},{n:"Infusión Molle (cedrón, poleo, tomillo)",p:4800,p2:5900,g:[]},{n:"Infusión fría Molle 500cc",p:5500,g:[]}]},
  ]},
};
const OT = "https://www.opentable.com/r/chui-buenos-aires";

const ALLERGIES = [
  { id: "nuts", label: "Frutos secos", icon: "🥜" },
  { id: "gluten", label: "Gluten", icon: "🌾" },
  { id: "dairy", label: "Lácteos", icon: "🥛" },
  { id: "egg", label: "Huevo", icon: "🥚" },
  { id: "soy", label: "Soja", icon: "🫘" },
  { id: "vegan", label: "Vegano", icon: "🌱" },
];

// ─── OpenTable-style components ───

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.card, borderRadius: T.radius, padding: "16px",
      boxShadow: T.shadow, marginBottom: "12px", ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, disabled, outline, color, style: s }) {
  const c = color || T.accent;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "15px 24px", width: "100%", border: outline ? `1.5px solid ${c}` : "none",
      borderRadius: "12px", fontSize: "16px", fontWeight: "600",
      fontFamily: f.sans, cursor: disabled ? "default" : "pointer",
      background: outline ? "transparent" : disabled ? T.border : c,
      color: outline ? c : disabled ? T.textLight : "#fff",
      transition: "all 0.15s", textAlign: "center", boxSizing: "border-box", ...s,
    }}>{children}</button>
  );
}

function LevelBadge({ level }) {
  const map = {
    0: { label: "Nuevo", bg: "#F0F0F0", color: T.textMed },
    1: { label: "Verificado", bg: "#EDF4FA", color: "#5B8DB8" },
    2: { label: "Confiable", bg: T.accentLight, color: T.accent },
    3: { label: "★ Habitual", bg: T.warmBg, color: T.warm },
  };
  const l = map[level];
  return <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "600", background: l.bg, color: l.color, fontFamily: f.sans, whiteSpace: "nowrap" }}>{l.label}</span>;
}

function Label({ children }) {
  return <div style={{ fontSize: "13px", fontWeight: "600", color: T.textLight, marginBottom: "8px", fontFamily: f.sans }}>{children}</div>;
}

function PageTitle({ children }) {
  return <h1 style={{ fontSize: "28px", fontWeight: "700", color: T.text, margin: "0 0 4px", fontFamily: f.sans }}>{children}</h1>;
}

function Subtitle({ children }) {
  return <div style={{ fontSize: "15px", color: T.textMed, lineHeight: 1.5 }}>{children}</div>;
}

function MesaLogo({ size = 24 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: size * 0.3, height: size * 0.3, borderRadius: "50%", background: T.accent }} />
      <span style={{ fontFamily: f.serif, fontSize: size, color: T.text, letterSpacing: "-0.5px" }}>Mesa</span>
    </div>
  );
}

// OpenTable-style info row (icon + text inline)
function InfoRow({ items }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px", color: T.textMed, fontSize: "14px" }}>
          <span style={{ fontSize: "15px", opacity: 0.7 }}>{item.icon}</span>
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// OpenTable-style bottom tab bar
function TabBar({ active, onTab }) {
  const tabs = [
    { id: "first", icon: "🆕", label: "Walk-in" },
    { id: "returning", icon: "👤", label: "Recurrente" },
    { id: "waiting", icon: "⏱", label: "Espera" },
    { id: "post", icon: "🎓", label: "Post-visita" },
    { id: "hostess", icon: "📋", label: "Hostess" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, background: T.bg,
      borderTop: `1px solid ${T.border}`, display: "flex", padding: "6px 0 env(safe-area-inset-bottom, 8px)",
      zIndex: 100,
    }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onTab(t.id)} style={{
          flex: 1, padding: "8px 0 4px", background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
        }}>
          <span style={{ fontSize: "18px", opacity: active === t.id ? 1 : 0.5 }}>{t.icon}</span>
          <span style={{
            fontSize: "10px", fontWeight: active === t.id ? "700" : "400",
            color: active === t.id ? T.accent : T.textLight, fontFamily: f.sans,
          }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// VIEW 1: WALK-IN (primera vez)
// ═══════════════════════════════════════════════════
function WalkIn({ onNext, onMenu }) {
  const [step, setStep] = useState("welcome");
  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [allergy, setAllergy] = useState([]);
  const toggle = (id) => setAllergy((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  if (step === "welcome") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <Card style={{ textAlign: "center", padding: "36px 28px", maxWidth: "340px", width: "100%", marginBottom: "16px" }}>
          <div style={{ fontSize: "36px", marginBottom: "16px" }}>🌿</div>
          <PageTitle>Chuí</PageTitle>
          <div style={{ fontSize: "14px", color: T.textMed, marginBottom: "24px" }}>Loyola 1250, Villa Crespo</div>
          <div style={{ fontSize: "20px", fontWeight: "600", color: T.text, marginBottom: "8px", fontFamily: f.sans }}>Todas las mesas ocupadas</div>
          <Subtitle>Anotate y te avisamos al celular cuando tu mesa esté lista.</Subtitle>
        </Card>
        <div style={{ maxWidth: "340px", width: "100%" }}>
          <Btn onClick={() => setStep("location")}>Anotarme en la fila</Btn>
        </div>
      </div>
    );
  }

  if (step === "location") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <Card style={{ textAlign: "center", padding: "36px 28px", maxWidth: "340px", width: "100%" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%", background: T.accentSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "32px", margin: "0 auto 20px",
          }}>📍</div>
          <div style={{ fontSize: "20px", fontWeight: "600", color: T.text, marginBottom: "10px", fontFamily: f.sans }}>¿Querés ir a pasear mientras esperás?</div>
          <Subtitle>Compartí tu ubicación y te avisamos cuándo salir para llegar justo a tiempo.</Subtitle>
          <div style={{ fontSize: "13px", color: T.textLight, marginTop: "12px", lineHeight: 1.5 }}>
            Se usa solo mientras esperás.{"\n"}Se borra cuando te sentás.
          </div>
        </Card>
        <div style={{ maxWidth: "340px", width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Btn onClick={() => setStep("form")}>Compartir ubicación</Btn>
          <button onClick={() => setStep("form")} style={{ background: "none", border: "none", color: T.textLight, fontSize: "15px", cursor: "pointer", padding: "10px", fontFamily: f.sans }}>Ahora no</button>
        </div>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div style={{ minHeight: "100vh", background: T.bgPage, padding: "56px 20px 100px" }}>
        <PageTitle>Lista de espera</PageTitle>
        <div style={{ fontSize: "14px", color: T.textMed, marginBottom: "24px" }}>Chuí · Loyola 1250</div>

        <Card>
          <Label>Tu nombre</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre"
            style={{
              width: "100%", padding: "14px 16px", background: T.bgPage,
              border: `1.5px solid ${T.border}`, borderRadius: "12px",
              color: T.text, fontSize: "16px", outline: "none", boxSizing: "border-box",
              fontFamily: f.sans, transition: "border-color 0.15s",
            }}
            onFocus={(e) => e.target.style.borderColor = T.accent}
            onBlur={(e) => e.target.style.borderColor = T.border}
          />
        </Card>

        <Card>
          <Label>¿Cuántos son?</Label>
          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} onClick={() => setParty(n)} style={{
                flex: 1, padding: "14px 0",
                background: party === n ? T.accent : T.bgPage,
                border: `1.5px solid ${party === n ? T.accent : T.border}`,
                borderRadius: "12px", color: party === n ? "#fff" : T.textMed,
                fontSize: "16px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
                transition: "all 0.15s",
              }}>{n}{n === 6 ? "+" : ""}</button>
            ))}
          </div>
        </Card>

        {/* WhatsApp upgrade — styled like an OpenTable inline promo */}
        <Card style={{ background: T.accentSoft, border: `1px solid ${T.accent}22`, cursor: "pointer", display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "26px" }}>💬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: T.accent }}>¿Registrarte con WhatsApp?</div>
            <div style={{ fontSize: "13px", color: T.textMed, marginTop: "2px" }}>La próxima podés anotarte desde donde quieras</div>
          </div>
          <span style={{ color: T.textLight, fontSize: "20px" }}>›</span>
        </Card>

        <div style={{ marginTop: "8px" }}>
          <Btn onClick={() => setStep("allergies")} disabled={!name}>Continuar</Btn>
        </div>
      </div>
    );
  }

  // Allergies
  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "56px 20px 100px" }}>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🍽️</div>
        <div style={{ fontSize: "22px", fontWeight: "600", color: T.text, fontFamily: f.sans }}>¿Tenés alergias alimentarias?</div>
        <Subtitle>Se lo informamos al camarero cada vez que vengas.</Subtitle>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
        {ALLERGIES.map((a) => {
          const sel = allergy.includes(a.id);
          return (
            <Card key={a.id} onClick={() => toggle(a.id)} style={{
              cursor: "pointer", display: "flex", alignItems: "center", gap: "12px",
              marginBottom: 0, padding: "16px",
              border: sel ? `2px solid ${T.accent}` : "2px solid transparent",
              background: sel ? T.accentSoft : T.card,
            }}>
              <span style={{ fontSize: "22px" }}>{a.icon}</span>
              <span style={{ fontSize: "15px", fontWeight: "500", color: sel ? T.accent : T.textMed }}>{a.label}</span>
            </Card>
          );
        })}
      </div>

      <Btn onClick={onNext}>{allergy.length ? "Listo, anotarme" : "No tengo, anotarme"}</Btn>
      <button onClick={onNext} style={{ width: "100%", background: "none", border: "none", color: T.textLight, fontSize: "14px", cursor: "pointer", padding: "14px", fontFamily: f.sans, marginTop: "4px" }}>Prefiero no decir</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// VIEW 2: RETURNING CUSTOMER
// ═══════════════════════════════════════════════════
function Returning({ onNext, onMenu }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "56px 20px 100px" }}>
      <PageTitle>Lista de espera</PageTitle>
      <div style={{ fontSize: "14px", color: T.textMed, marginBottom: "20px" }}>Chuí · Loyola 1250</div>

      {/* Welcome — like an OpenTable reservation card */}
      <Card style={{ textAlign: "center", padding: "28px 20px" }}>
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>👋</div>
        <div style={{ fontSize: "24px", fontWeight: "700", color: T.text, fontFamily: f.sans, marginBottom: "8px" }}>¡Hola Laura!</div>
        <LevelBadge level={2} />
        <div style={{ marginTop: "12px" }}>
          <InfoRow items={[{ icon: "🪑", text: "4 visitas" }, { icon: "⚠️", text: "Frutos secos, lácteos" }]} />
        </div>
      </Card>

      {/* Quick join */}
      <Card>
        <Label>¿2 personas como siempre?</Label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} style={{
              flex: 1, padding: "14px 0",
              background: n === 2 ? T.accent : T.bgPage,
              border: `1.5px solid ${n === 2 ? T.accent : T.border}`,
              borderRadius: "12px", color: n === 2 ? "#fff" : T.textMed,
              fontSize: "16px", fontWeight: "600", cursor: "pointer", fontFamily: f.sans,
            }}>{n}</button>
          ))}
        </div>
        <Btn onClick={onNext}>Anotarme · Estoy en camino</Btn>
      </Card>

      {/* Menu — OpenTable card style with chevron */}
      <Card onClick={onMenu} style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>📖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "16px", fontWeight: "600", color: T.text }}>Ver el menú</div>
          <div style={{ fontSize: "14px", color: T.textMed }}>Elegí qué pedir mientras esperás</div>
        </div>
        <span style={{ color: T.textFaint, fontSize: "22px" }}>›</span>
      </Card>

      {/* Progress — like OpenTable rewards */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <Label>Tu progreso</Label>
          <LevelBadge level={2} />
        </div>
        <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
          {[0, 1, 2, 3].map((l) => (
            <div key={l} style={{ flex: 1, height: "6px", borderRadius: "3px", background: l <= 2 ? T.accent : T.border }} />
          ))}
        </div>
        <div style={{ fontSize: "14px", color: T.textMed }}>1 visita más para <span style={{ color: T.warm, fontWeight: "700" }}>★ Habitual</span></div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// VIEW 3: WAIT SCREEN
// ═══════════════════════════════════════════════════
function Wait({ onMenu }) {
  const [locOn, setLocOn] = useState(false);
  const [transport, setTransport] = useState(null); // "walk", "bike", "car"
  const [phase, setPhase] = useState("waiting");
  const [ext, setExt] = useState(null);
  const [pos, setPos] = useState(3);
  const [wait, setWait] = useState(20);
  const walkTimes = { walk: 12, bike: 6, car: 4 };
  const walk = walkTimes[transport] || 12;
  const transportLabels = { walk: "🚶 A pie", bike: "🚲 En bici", car: "🚗 En auto" };

  useEffect(() => {
    if (!locOn || !transport) return;
    const t = [];
    t.push(setTimeout(() => { setPhase("smart"); setWait(14); }, 3500));
    t.push(setTimeout(() => { setPhase("wont_arrive"); }, 7500));
    return () => t.forEach(clearTimeout);
  }, [locOn, transport]);

  const doExt = (m) => { setExt(m); setPhase("extended"); setWait(m); setTimeout(() => setPhase("ready"), 4500); };
  const doPass = () => { setPhase("passed"); setPos(4); setWait(26); setTimeout(() => { setPhase("smart"); setPos(3); setWait(14); }, 5000); };
  const doCancel = () => setPhase("cancelled");

  const pct = Math.max(0, Math.min(100, ((40 - wait) / 40) * 100));

  if (phase === "cancelled") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <Card style={{ textAlign: "center", padding: "36px 28px", maxWidth: "340px", width: "100%" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>👋</div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: T.text, fontFamily: f.sans, marginBottom: "8px" }}>Lugar cancelado</div>
          <Subtitle>Te esperamos la próxima.</Subtitle>
          <div style={{ marginTop: "14px" }}><LevelBadge level={2} /></div>
        </Card>
        <div style={{ maxWidth: "340px", width: "100%", marginTop: "8px" }}>
          <a href={OT} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
            <Btn outline color={T.accent}>Reservar en OpenTable →</Btn>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, display: "flex", flexDirection: "column", paddingBottom: "80px" }}>
      {/* Top */}
      <div style={{ padding: "56px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <PageTitle>Tu espera</PageTitle>
          <div style={{ fontSize: "14px", color: T.textMed }}>Chuí</div>
        </div>
        <LevelBadge level={2} />
      </div>

      <div style={{ padding: "16px 20px", flex: 1 }}>
        {/* Position ring */}
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 16px" }}>
          <div style={{
            width: "148px", height: "148px", borderRadius: "50%",
            background: `conic-gradient(${phase === "passed" ? T.textFaint : T.accent} ${pct}%, ${T.border} ${pct}%)`,
            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.6s",
          }}>
            <div style={{
              width: "128px", height: "128px", borderRadius: "50%", background: T.bgPage,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              {phase === "passed" ? (
                <><div style={{ fontSize: "22px" }}>⏭️</div><div style={{ fontSize: "13px", color: T.textLight, marginTop: "4px" }}>Siguiente mesa</div></>
              ) : phase === "ready" ? (
                <><div style={{ fontSize: "28px" }}>🪑</div><div style={{ fontSize: "14px", color: T.accent, fontWeight: "600", marginTop: "4px" }}>¡Tu mesa!</div></>
              ) : (
                <><div style={{ fontSize: "44px", fontWeight: "700", color: T.text, fontFamily: f.sans }}>{pos}°</div><div style={{ fontSize: "13px", color: T.textLight }}>en la fila</div></>
              )}
            </div>
          </div>
        </div>

        {/* Wait time */}
        <Card style={{ textAlign: "center" }}>
          <Label>{phase === "extended" ? "Tiempo extra activo" : phase === "passed" ? "Nueva espera" : "Espera estimada"}</Label>
          <div style={{ fontSize: "36px", fontWeight: "700", color: T.text, fontFamily: f.sans }}>~{wait} min</div>
          {phase === "extended" && <div style={{ fontSize: "14px", color: T.amber, marginTop: "6px", fontWeight: "600" }}>+{ext} min agregados</div>}
        </Card>

        {/* Bar upsell — warm tone, 25% discount incentive */}
        {phase === "waiting" && !locOn && (
          <Card style={{ background: T.warmBg, border: `1px solid ${T.warmBorder}`, padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🍸</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: T.text }}>¿Preferís esperar en la barra?</div>
                <div style={{ fontSize: "14px", color: T.textMed, marginTop: "2px" }}>Te avisamos cuando tu mesa esté lista.</div>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: "12px", padding: "14px 16px", border: `1px solid ${T.warmBorder}`, display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "22px" }}>💬</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: T.warm }}>25% off en tu primer trago</div>
                <div style={{ fontSize: "13px", color: T.textMed }}>Registrate con WhatsApp y arrancá por la barra</div>
              </div>
              <span style={{ color: T.textFaint, fontSize: "20px" }}>›</span>
            </div>
          </Card>
        )}

        {/* Action row */}
        {phase === "waiting" && (
          <div style={{ display: "flex", gap: "10px" }}>
            <Card onClick={onMenu} style={{ flex: 1, textAlign: "center", padding: "16px", marginBottom: 0, cursor: "pointer" }}>
              <div style={{ fontSize: "20px" }}>📖</div>
              <div style={{ fontSize: "14px", fontWeight: "500", color: T.text, marginTop: "6px" }}>Ver menú</div>
            </Card>
            {!locOn && (
              <Card onClick={() => setLocOn(true)} style={{
                flex: 1.5, textAlign: "center", padding: "16px", marginBottom: 0,
                cursor: "pointer", background: T.accentSoft, border: `1px solid ${T.accent}22`,
              }}>
                <div style={{ fontSize: "20px" }}>🚶</div>
                <div style={{ fontSize: "14px", fontWeight: "500", color: T.accent, marginTop: "6px" }}>Salí a pasear</div>
              </Card>
            )}
          </div>
        )}

        {/* Location — transport selector or active status */}
        {locOn && !transport && !["wont_arrive", "passed", "cancelled"].includes(phase) && phase !== "ready" && (
          <Card style={{ background: T.accentSoft, border: `1px solid ${T.accent}20` }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: T.accent, marginBottom: "12px" }}>¿Cómo te movés?</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {["walk","bike","car"].map((m) => (
                <button key={m} onClick={() => setTransport(m)} style={{
                  flex: 1, padding: "14px 8px", background: T.bg, border: `1.5px solid ${T.border}`,
                  borderRadius: "12px", cursor: "pointer", textAlign: "center", fontFamily: f.sans,
                  transition: "border-color 0.15s",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = T.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}>
                  <div style={{ fontSize: "22px" }}>{transportLabels[m].split(" ")[0]}</div>
                  <div style={{ fontSize: "13px", color: T.textMed, marginTop: "4px" }}>{transportLabels[m].split(" ").slice(1).join(" ")}</div>
                </button>
              ))}
            </div>
          </Card>
        )}
        {locOn && transport && !["wont_arrive", "passed", "cancelled"].includes(phase) && phase !== "ready" && (
          <Card style={{ background: T.accentSoft, border: `1px solid ${T.accent}20`, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "18px" }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", color: T.accent, fontSize: "15px" }}>Podés salir a pasear tranquilo</div>
              <div style={{ fontSize: "14px", color: T.textMed }}>Estás a {walk} min {transportLabels[transport].toLowerCase()} · Te avisamos cuándo volver</div>
            </div>
          </Card>
        )}

        {/* ═══ SMART NOTIFICATION ═══ */}
        {phase === "smart" && locOn && (
          <Card style={{ background: T.accentSoft, border: `1.5px solid ${T.accent}30` }}>
            <div style={{ fontSize: "16px", fontWeight: "600", color: T.text, marginBottom: "6px" }}>
              {transport === "car" ? "🚗" : transport === "bike" ? "🚲" : "🚶"} ¡Salí ahora, Laura!
            </div>
            <div style={{ fontSize: "15px", color: T.textMed, lineHeight: 1.6 }}>
              Tu mesa estará lista en <strong style={{ color: T.text }}>{wait} min</strong> y estás a <strong style={{ color: T.text }}>{walk} min</strong> {transport === "car" ? "en auto" : transport === "bike" ? "en bici" : "caminando"}.
            </div>
          </Card>
        )}

        {/* ═══ WON'T ARRIVE OPTIONS ═══ */}
        {phase === "wont_arrive" && (
          <Card style={{ padding: 0, overflow: "hidden", border: `1.5px solid ${T.amberBorder}` }}>
            <div style={{ background: T.amberBg, padding: "18px 20px", borderBottom: `1px solid ${T.amberBorder}` }}>
              <div style={{ fontSize: "16px", fontWeight: "600", color: T.amber }}>⚠️ ¿Necesitás más tiempo?</div>
              <div style={{ fontSize: "14px", color: T.textMed, marginTop: "4px" }}>Tu mesa estará lista antes de que llegues.</div>
            </div>
            <div style={{ padding: "16px" }}>
              {[
                { icon: "🕐", l: "5 minutos más", s: "Mantenés tu lugar", fn: () => doExt(5) },
                { icon: "🕐", l: "10 minutos más", s: "Mantenés tu lugar", fn: () => doExt(10) },
                { icon: "⏭️", l: "Dejar pasar este turno", s: "Esperás la siguiente mesa", fn: doPass },
              ].map((o, i) => (
                <button key={i} onClick={o.fn} style={{
                  width: "100%", padding: "16px 18px", background: T.bgPage,
                  border: `1.5px solid ${T.border}`, borderRadius: "14px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px",
                  textAlign: "left", boxSizing: "border-box", transition: "border-color 0.15s",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = T.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}>
                  <span style={{ fontSize: "20px" }}>{o.icon}</span>
                  <div>
                    <div style={{ color: T.text, fontWeight: "600", fontSize: "15px" }}>{o.l}</div>
                    <div style={{ color: T.textLight, fontSize: "13px", marginTop: "2px" }}>{o.s}</div>
                  </div>
                </button>
              ))}
              <button onClick={doCancel} style={{ width: "100%", padding: "12px", background: "none", border: "none", color: T.textLight, fontSize: "14px", cursor: "pointer", fontFamily: f.sans }}>
                Cancelar mi lugar
              </button>
            </div>
          </Card>
        )}

        {/* Extended */}
        {phase === "extended" && (
          <Card style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>🕐</span>
            <div>
              <div style={{ fontWeight: "600", color: T.amber, fontSize: "15px" }}>+{ext} min agregados</div>
              <div style={{ fontSize: "14px", color: T.textMed }}>Vení lo antes posible</div>
            </div>
          </Card>
        )}

        {/* Ready */}
        {phase === "ready" && (
          <Card style={{ background: T.accentSoft, border: `1.5px solid ${T.accent}30`, textAlign: "center", padding: "24px" }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: T.accent, fontFamily: f.sans }}>🪑 ¡Laura, tu mesa te espera!</div>
            <div style={{ fontSize: "15px", color: T.textMed, marginTop: "8px" }}>Acercate al hostess cuando llegues.</div>
          </Card>
        )}

        {/* Passed */}
        {phase === "passed" && (
          <Card style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>⏭️</span>
            <div>
              <div style={{ fontWeight: "600", color: T.textMed, fontSize: "15px" }}>Dejaste pasar este turno</div>
              <div style={{ fontSize: "14px", color: T.textLight }}>Te avisamos para la siguiente</div>
            </div>
          </Card>
        )}

        {/* Chat */}
        {!["wont_arrive", "cancelled", "ready"].includes(phase) && (
          <div style={{ marginTop: "4px" }}><Btn outline>💬 Mensaje al restaurante</Btn></div>
        )}
      </div>

      {/* Bottom cancel */}
      {!["wont_arrive", "cancelled"].includes(phase) && (
        <div style={{ textAlign: "center", padding: "0 20px 16px" }}>
          <button onClick={doCancel} style={{ background: "none", border: "none", color: T.red, fontSize: "14px", cursor: "pointer", fontFamily: f.sans, opacity: 0.6 }}>Cancelar mi lugar</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// VIEW 4: POST-VISIT
// ═══════════════════════════════════════════════════
function PostVisit() {
  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, padding: "56px 20px 100px" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "44px", marginBottom: "12px" }}>🎉</div>
        <PageTitle>¡Gracias por venir!</PageTitle>
        <Subtitle>Esperamos que hayas disfrutado.</Subtitle>
      </div>

      {/* Level up */}
      <Card style={{ textAlign: "center", padding: "24px", background: T.accentSoft, border: `1px solid ${T.accent}20` }}>
        <Label>Tu progreso</Label>
        <div style={{ display: "flex", gap: "4px", margin: "10px 0" }}>
          {[0, 1, 2, 3].map((l) => (
            <div key={l} style={{ flex: 1, height: "6px", borderRadius: "3px", background: l <= 2 ? T.accent : T.border }} />
          ))}
        </div>
        <div style={{ fontSize: "15px", color: T.text }}>5 visitas · <LevelBadge level={2} /></div>
        <div style={{ fontSize: "14px", color: T.textMed, marginTop: "8px" }}>1 visita más para <span style={{ color: T.warm, fontWeight: "700" }}>★ Habitual</span></div>
        <div style={{ fontSize: "13px", color: T.textLight, marginTop: "4px" }}>Prioridad en hora pico</div>
      </Card>

      {/* OpenTable education */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>💡</div>
          <div style={{ fontSize: "17px", fontWeight: "600", color: T.text }}>¿Sabías que podés reservar?</div>
        </div>
        <div style={{ fontSize: "15px", color: T.textMed, lineHeight: 1.7, marginBottom: "16px" }}>
          La próxima vez, reservá y tu mesa te espera cuando llegues. O si preferís el plan walk-in, llegá un ratito antes y arrancá en la barra 🍸
        </div>
        <a href={OT} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
          <Btn outline color={T.accent}>Reservar en OpenTable →</Btn>
        </a>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// VIEW 5: HOSTESS DASHBOARD
// ═══════════════════════════════════════════════════
function Hostess() {
  const [tab, setTab] = useState("queue");
  const Q = [
    { name: "María G.", party: 2, wait: 2, status: "notified", dist: "Aquí", level: 3, ago: 22, ch: "💬", allergy: [] },
    { name: "Santiago R.", party: 4, wait: 12, status: "waiting", dist: "300m", level: 2, ago: 14, ch: "🔗", allergy: ["Gluten"] },
    { name: "Camila F.", party: 2, wait: 20, status: "extended", dist: "1.2km", level: 2, ago: 8, ch: "📸", allergy: ["Frutos secos", "Lácteos"] },
    { name: "Tomás B.", party: 6, wait: 28, status: "waiting", dist: "—", level: 1, ago: 5, ch: "◻️", allergy: [] },
    { name: "Sin nombre", party: 2, wait: 35, status: "waiting", dist: "Barra", level: 0, ago: 2, ch: "◻️", allergy: [] },
  ];
  const stMap = {
    waiting: { bg: "#F0F0F0", color: T.textMed, t: "Esperando" },
    notified: { bg: T.accentLight, color: T.accent, t: "Notificado" },
    extended: { bg: T.amberBg, color: T.amber, t: "+5 min" },
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bgPage, paddingBottom: "80px" }}>
      <div style={{ padding: "56px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <PageTitle>Chuí</PageTitle>
            <div style={{ fontSize: "14px", color: T.textMed }}>{Q.length} en espera · ~8 min rotación</div>
          </div>
          <MesaLogo size={22} />
        </div>

        <div style={{ display: "flex", marginTop: "20px", borderBottom: `2px solid ${T.border}` }}>
          {[["queue", "Cola"], ["stats", "Stats"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "12px 0", background: "none", border: "none",
              borderBottom: tab === k ? `2.5px solid ${T.accent}` : "2.5px solid transparent",
              color: tab === k ? T.text : T.textLight, fontSize: "15px", fontWeight: "600",
              cursor: "pointer", fontFamily: f.sans, marginBottom: "-2px",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "queue" && (
        <div style={{ padding: "16px 20px" }}>
          {Q.map((e, i) => {
            const st = stMap[e.status] || stMap.waiting;
            return (
              <Card key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%", background: T.bgPage,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: "700", color: T.textMed, fontFamily: f.sans,
                    }}>{i + 1}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "600", fontSize: "16px", color: T.text }}>{e.name}</span>
                        <LevelBadge level={e.level} />
                      </div>
                      <div style={{ fontSize: "13px", color: T.textMed, marginTop: "3px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                        <span>{e.ch}</span>
                        <span>{e.party} pers</span>
                        <span>·</span>
                        <span>hace {e.ago} min</span>
                        {e.allergy.length > 0 && <>
                          <span>·</span>
                          <span style={{ color: T.amber, fontWeight: "600" }}>⚠️ {e.allergy.join(", ")}</span>
                        </>}
                      </div>
                    </div>
                  </div>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", background: st.bg, color: st.color, whiteSpace: "nowrap" }}>{st.t}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <InfoRow items={[
                    { icon: "⏱", text: `~${e.wait} min` },
                    { icon: "📍", text: e.dist },
                  ]} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    {e.status === "waiting" && (
                      <button style={{
                        padding: "8px 18px", background: T.bgPage, border: `1.5px solid ${T.border}`,
                        borderRadius: "10px", color: T.text, fontSize: "13px", fontWeight: "600",
                        cursor: "pointer", fontFamily: f.sans,
                      }}>Notificar</button>
                    )}
                    {(e.status === "notified" || e.status === "extended") && (
                      <button style={{
                        padding: "8px 18px", background: T.accent, border: "none",
                        borderRadius: "10px", color: "#fff", fontSize: "13px", fontWeight: "600",
                        cursor: "pointer", fontFamily: f.sans,
                      }}>Sentar</button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "stats" && (
        <div style={{ padding: "16px 20px" }}>
          <Label>Hoy</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
            {[
              { l: "Espera prom.", v: "18 min" },
              { l: "Sentados", v: "47" },
              { l: "En barra", v: "8" },
              { l: "No-show rate", v: "2.1%" },
            ].map((s) => (
              <Card key={s.l} style={{ textAlign: "center", padding: "18px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: T.text, fontFamily: f.sans }}>{s.v}</div>
                <div style={{ fontSize: "13px", color: T.textLight, marginTop: "4px" }}>{s.l}</div>
              </Card>
            ))}
          </div>

          <Label>Extensiones hoy</Label>
          <Card>
            {[["Pidieron 5 min más", "4"], ["Pidieron 10 min más", "2"], ["Dejaron pasar turno", "1"], ["Cancelaron activamente", "0"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "10px" }}>
                <span style={{ color: T.textMed }}>{l}</span>
                <span style={{ color: T.text, fontWeight: "600" }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "12px", marginTop: "4px", fontSize: "14px", color: T.accent, fontWeight: "600" }}>
              ~5 no-shows evitados con extensiones
            </div>
          </Card>

          <Label>Base de datos</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[{ l: "Usuarios", v: "284" }, { l: "Con acceso remoto", v: "89" }, { l: "Recurrentes", v: "34" }, { l: "Con alergias", v: "41" }].map((s) => (
              <Card key={s.l} style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontSize: "22px", fontWeight: "700", color: T.text }}>{s.v}</div>
                <div style={{ fontSize: "12px", color: T.textLight, marginTop: "4px" }}>{s.l}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MENU OVERLAY — native render, auto-routed
// ═══════════════════════════════════════════════════
function MenuOverlay({ onClose }) {
  const defaultKey = getMenuKey();
  const lang = (typeof navigator !== "undefined" ? navigator.language : "es").toLowerCase();
  const en = lang.startsWith("en");
  const tabs = en ? MENU_TABS_EN : MENU_TABS_ES;
  const [active, setActive] = useState(defaultKey);
  const menu = M[active];
  const tagColors = { V: { bg: "#E8F5EE", c: "#2D7A4F" }, "V*": { bg: "#E8F5EE", c: "#2D7A4F" }, P: { bg: "#FFF0E0", c: "#D4842A" }, S: { bg: "#FFF0E0", c: "#D4842A" }, GF: { bg: "#F0ECFF", c: "#7B61C4" } };
  const fmt = (p) => p >= 1000 ? `${(p/1000).toFixed(p % 1000 === 0 ? 0 : 1)}k` : p;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column" }} onClick={onClose}>
      <div style={{ margin: "40px 8px 8px", flex: 1, borderRadius: "20px", overflow: "hidden", background: T.bg, display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "16px 20px 0", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: T.text, fontFamily: f.sans }}>📖 Menú</div>
            <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "50%", background: T.bgPage, border: "none", cursor: "pointer", fontSize: "16px", color: T.textMed, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "0" }}>
            {tabs.map((k) => (
              <button key={k} onClick={() => setActive(k)} style={{
                padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: active === k ? "700" : "500", fontFamily: f.sans,
                color: active === k ? T.accent : T.textLight, whiteSpace: "nowrap",
                borderBottom: active === k ? `2.5px solid ${T.accent}` : "2.5px solid transparent",
                marginBottom: "-1px", transition: "all 0.15s",
              }}>{MENU_TAB_LABELS[k]}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", WebkitOverflowScrolling: "touch" }}>
          {menu.sections.map((sec, si) => (
            <div key={si} style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "18px", fontWeight: "700", color: T.text, fontFamily: f.sans, marginBottom: sec.s ? "2px" : "12px" }}>{sec.t}</div>
              {sec.s && <div style={{ fontSize: "12px", color: T.textLight, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{sec.s}</div>}
              {sec.items.map((item, ii) => (
                <div key={ii} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: ii < sec.items.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ flex: 1, paddingRight: "12px" }}>
                    <div style={{ fontSize: "15px", color: T.text, lineHeight: 1.4 }}>{item.n}</div>
                    {item.g.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                        {item.g.map((tag) => {
                          const tc = tagColors[tag] || { bg: "#f0f0f0", c: T.textMed };
                          return <span key={tag} style={{ fontSize: "11px", fontWeight: "600", padding: "2px 7px", borderRadius: "6px", background: tc.bg, color: tc.c }}>{tag}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {item.x && <span style={{ fontSize: "11px", color: T.textLight, marginRight: "4px" }}>{item.x}</span>}
                    <span style={{ fontSize: "15px", fontWeight: "600", color: T.text }}>${item.p.toLocaleString()}</span>
                    {item.p2 && <span style={{ fontSize: "13px", color: T.textLight }}> / ${item.p2.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div style={{ textAlign: "center", padding: "16px 0 24px", fontSize: "13px", color: T.textLight }}>
            {en ? "Please let us know about any food allergies." : "Avisanos si tenés alguna alergia o intolerancia."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function MesaV4() {
  const [view, setView] = useState("first");
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div style={{ fontFamily: f.sans, maxWidth: "430px", margin: "0 auto", position: "relative", minHeight: "100vh" }}>
      {view === "first" && <WalkIn onNext={() => setView("waiting")} onMenu={() => setShowMenu(true)} />}
      {view === "returning" && <Returning onNext={() => setView("waiting")} onMenu={() => setShowMenu(true)} />}
      {view === "waiting" && <Wait onMenu={() => setShowMenu(true)} />}
      {view === "post" && <PostVisit />}
      {view === "hostess" && <Hostess />}
      <TabBar active={view} onTab={setView} />

      {/* Menu overlay — native render, smart time+language routing */}
      {showMenu && <MenuOverlay onClose={() => setShowMenu(false)} />}
    </div>
  );
}
