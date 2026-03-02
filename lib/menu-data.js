// Menu data + smart routing
// ─── SMART MENU ROUTING ───
// hour + browser language → correct menu automatically
export function getMenuKey() {
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
export const MENU_TABS_ES = ["noon_es","afternoon_es","night_es","wines","bar"];
export const MENU_TABS_EN = ["noon_en","afternoon_en","night_en","wines","bar"];
export const MENU_TAB_LABELS = { noon_es:"Mediodía", noon_en:"Noon", afternoon_es:"Tarde", afternoon_en:"Afternoon", night_es:"Noche", night_en:"Evening", wines:"Vinos", bar:"Bebidas" };

export const M = {
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
