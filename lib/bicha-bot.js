// La Bicha — WhatsApp Bot Conversation Engine
// Handles incoming messages and returns response text

import { supabaseServer } from "./supabase-server";

const CATEGORY_LABELS = {
  birras: "🍺 Birras",
  tragos: "🍸 Tragos",
  comida: "🍔 Comida",
  juegos: "🎮 Juegos",
};
const CATEGORY_ORDER = ["birras", "tragos", "comida", "juegos"];

const GAME_LABELS = { pingpong: "🏓 Ping Pong", pool: "🎱 Pool", metegol: "⚽ Metegol" };

function fmt(n) { return "$" + Number(n).toLocaleString("es-AR"); }

// Get or create bot state for a phone
async function getState(phone) {
  const { data } = await supabaseServer
    .from("bicha_bot_state")
    .select("*")
    .eq("phone", phone)
    .single();
  if (data) return data;
  // Create new
  await supabaseServer.from("bicha_bot_state").insert({ phone, state: "idle", data: {} });
  return { phone, state: "idle", data: {} };
}

async function setState(phone, state, data = {}) {
  await supabaseServer.from("bicha_bot_state").upsert({
    phone, state, data, updated_at: new Date().toISOString(),
  });
}

// Get or create wallet
async function getWallet(phone, name) {
  const { data } = await supabaseServer
    .from("bicha_wallets")
    .select("*")
    .eq("phone", phone)
    .single();
  if (data) return data;
  if (!name) name = "Cliente";
  const { data: w } = await supabaseServer
    .from("bicha_wallets")
    .insert({ phone, name, balance: 0 })
    .select()
    .single();
  return w;
}

// Generate redeem code
function generateRedeemCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Generate next ticket number for today
async function nextTicketNumber() {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabaseServer
    .from("bicha_tickets")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today + "T00:00:00")
    .lte("created_at", today + "T23:59:59");
  return (count || 0) + 1;
}

// Main menu
function mainMenu(name) {
  return `Hola${name ? " " + name : ""}! Bienvenido a *La Bicha* 🍺

Escribi el numero de lo que quieras:

1️⃣ Ver menu y pedir
2️⃣ Ver packs
3️⃣ Mi wallet
4️⃣ Mis packs activos
5️⃣ Cargar creditos

O escribi *hola* en cualquier momento para volver aca.`;
}

// Process an incoming message
export async function processMessage(phone, body) {
  if (!supabaseServer) return "Sistema no disponible. Intenta mas tarde.";

  const msg = (body || "").trim();
  const msgLower = msg.toLowerCase();

  // Global reset
  if (["hola", "hi", "menu", "inicio", "0", "volver"].includes(msgLower)) {
    const wallet = await getWallet(phone);
    await setState(phone, "idle");
    return mainMenu(wallet?.name !== "Cliente" ? wallet.name : null);
  }

  const botState = await getState(phone);
  const { state, data: stateData } = botState;

  // ─── IDLE / FIRST CONTACT ───
  if (state === "idle" || state === "ask_name") {
    if (state === "ask_name") {
      // They just told us their name
      await getWallet(phone, msg);
      await setState(phone, "idle");
      return mainMenu(msg);
    }

    // Check if wallet exists
    const wallet = await getWallet(phone);
    if (wallet.name === "Cliente") {
      await setState(phone, "ask_name");
      return "Hola! Antes de empezar, como te llamas?";
    }

    // Parse main menu choice
    if (msg === "1") {
      // Show menu categories
      await setState(phone, "menu_categories");
      let text = "📋 *Menu de La Bicha*\n\n";
      CATEGORY_ORDER.forEach((cat, i) => {
        text += `${i + 1}️⃣ ${CATEGORY_LABELS[cat]}\n`;
      });
      text += "\nEscribi el numero de la categoria.";
      return text;
    }
    if (msg === "2") {
      return await showPacks(phone);
    }
    if (msg === "3") {
      return await showWallet(phone);
    }
    if (msg === "4") {
      return await showMyPacks(phone);
    }
    if (msg === "5") {
      return await showTopUp(phone);
    }

    return mainMenu(wallet.name !== "Cliente" ? wallet.name : null);
  }

  // ─── MENU CATEGORIES ───
  if (state === "menu_categories") {
    const catIdx = parseInt(msg) - 1;
    if (catIdx >= 0 && catIdx < CATEGORY_ORDER.length) {
      const cat = CATEGORY_ORDER[catIdx];
      return await showMenuCategory(phone, cat);
    }
    return "Numero no valido. Escribi 1-" + CATEGORY_ORDER.length + " o *hola* para volver.";
  }

  // ─── MENU ITEMS (viewing a category) ───
  if (state === "menu_items") {
    const items = stateData.items || [];
    const cart = stateData.cart || [];
    const itemIdx = parseInt(msg) - 1;

    if (msgLower === "v" || msgLower === "ver") {
      // Show cart
      return showCart(cart);
    }

    if (msgLower === "c" || msgLower === "confirmar") {
      if (cart.length === 0) return "Tu carrito esta vacio. Agrega algo primero.";
      await setState(phone, "confirm_order", { cart });
      return showCart(cart) + "\n\nConfirmas el pedido?\n1️⃣ Si, confirmar\n2️⃣ No, seguir eligiendo\n3️⃣ Vaciar carrito";
    }

    if (msgLower === "cat" || msgLower === "categorias") {
      await setState(phone, "menu_categories", { cart });
      let text = "📋 *Categorias*\n\n";
      CATEGORY_ORDER.forEach((cat, i) => {
        text += `${i + 1}️⃣ ${CATEGORY_LABELS[cat]}\n`;
      });
      text += "\nEscribi el numero.";
      if (cart.length > 0) text += `\n🛒 Tenes ${cart.length} item(s) en el carrito.`;
      return text;
    }

    if (itemIdx >= 0 && itemIdx < items.length) {
      const item = items[itemIdx];
      cart.push({ name: item.name, price: Number(item.price), quantity: 1, id: item.id });
      await setState(phone, "menu_items", { ...stateData, cart });
      const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
      return `✅ ${item.name} agregado!\n🛒 Carrito: ${cart.length} items — ${fmt(total)}\n\nSeguir eligiendo o escribi *c* para confirmar.`;
    }

    return "Escribi el numero del item, *cat* para cambiar categoria, *v* para ver carrito, o *c* para confirmar.";
  }

  // ─── CONFIRM ORDER ───
  if (state === "confirm_order") {
    if (msg === "1") {
      // Create ticket
      const cart = stateData.cart || [];
      const wallet = await getWallet(phone);
      const ticket_number = await nextTicketNumber();
      const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);

      // Upsert customer
      const { data: existing } = await supabaseServer
        .from("bicha_customers")
        .select("id, stamps_count, total_orders")
        .eq("phone", phone)
        .single();

      if (existing) {
        await supabaseServer.from("bicha_customers").update({
          name: wallet.name,
          total_orders: existing.total_orders + 1,
          stamps_count: existing.stamps_count + 1,
          last_visit: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabaseServer.from("bicha_customers").insert({
          name: wallet.name, phone, stamps_count: 1, total_orders: 1,
          last_visit: new Date().toISOString(),
        });
      }

      const { data: ticket } = await supabaseServer.from("bicha_tickets").insert({
        ticket_number,
        guest_name: wallet.name,
        phone,
        table_sector: "WhatsApp",
        items_json: cart,
        total,
        status: "pending",
        estimated_minutes: 15,
      }).select().single();

      await setState(phone, "idle");
      const num = String(ticket_number).padStart(3, "0");
      return `✅ *Pedido confirmado!*\n\n🎫 Tu numero: *#${num}*\n💰 Total: ${fmt(total)}\n📍 Retira en el mostrador\n\nTe aviso por aca cuando este listo!\n\nEscribi *hola* para volver al menu.`;
    }
    if (msg === "2") {
      await setState(phone, "menu_categories", { cart: stateData.cart });
      let text = "📋 *Categorias*\n\n";
      CATEGORY_ORDER.forEach((cat, i) => {
        text += `${i + 1}️⃣ ${CATEGORY_LABELS[cat]}\n`;
      });
      return text;
    }
    if (msg === "3") {
      await setState(phone, "menu_categories", { cart: [] });
      return "🗑️ Carrito vaciado.\n\nEscribi el numero de la categoria para empezar de nuevo.";
    }
    return "Escribi 1 para confirmar, 2 para seguir eligiendo, o 3 para vaciar carrito.";
  }

  // ─── PACKS LIST ───
  if (state === "packs_list") {
    const packs = stateData.packs || [];
    const idx = parseInt(msg) - 1;
    if (idx >= 0 && idx < packs.length) {
      const pack = packs[idx];
      await setState(phone, "pack_payment", { pack });
      let text = `📦 *${pack.name}*\n${pack.description}\n💰 ${fmt(pack.price)}`;
      if (pack.includes_game) text += `\n🎮 Incluye 1h de juego gratis`;
      text += "\n\nComo queres pagar?\n1️⃣ 💵 Efectivo (en el mostrador)\n2️⃣ 🏦 Transferencia\n3️⃣ 💳 MercadoPago";
      return text;
    }
    return "Numero no valido. Elegí un pack o escribi *hola* para volver.";
  }

  // ─── PACK PAYMENT METHOD ───
  if (state === "pack_payment") {
    const pack = stateData.pack;
    const methods = { "1": "efectivo", "2": "transferencia", "3": "mercadopago" };
    const method = methods[msg];
    if (!method) return "Escribi 1, 2 o 3 para elegir el metodo de pago.";

    if (pack.includes_game) {
      await setState(phone, "pack_game", { pack, payment_method: method });
      return "🎮 Elegi tu juego gratis:\n1️⃣ 🏓 Ping Pong\n2️⃣ 🎱 Pool\n3️⃣ ⚽ Metegol";
    }

    return await createPackPurchase(phone, pack, method, null);
  }

  // ─── PACK GAME SELECTION ───
  if (state === "pack_game") {
    const games = { "1": "pingpong", "2": "pool", "3": "metegol" };
    const game = games[msg];
    if (!game) return "Escribi 1, 2 o 3 para elegir el juego.";
    return await createPackPurchase(phone, stateData.pack, stateData.payment_method, game);
  }

  // ─── TOP UP AMOUNT ───
  if (state === "topup_amount") {
    const amount = parseInt(msg.replace(/\D/g, ""));
    if (!amount || amount < 1000) return "Monto minimo: $1.000. Escribi el monto o *hola* para volver.";

    await setState(phone, "topup_method", { amount });
    return `Cargar ${fmt(amount)} a tu wallet.\n\nComo pagas?\n1️⃣ 💵 Efectivo (en el mostrador)\n2️⃣ 🏦 Transferencia (CBU: 000000000000 · Alias: labicha.bar)\n3️⃣ 💳 MercadoPago`;
  }

  // ─── TOP UP METHOD ───
  if (state === "topup_method") {
    const methods = { "1": "efectivo", "2": "transferencia", "3": "mercadopago" };
    const method = methods[msg];
    if (!method) return "Escribi 1, 2 o 3.";

    const wallet = await getWallet(phone);
    const { data: tx } = await supabaseServer.from("bicha_wallet_transactions").insert({
      phone,
      type: "topup",
      amount: stateData.amount,
      description: `Carga de creditos via ${method}`,
      payment_method: method,
      status: "pending",
    }).select().single();

    await setState(phone, "idle");

    const methodLabels = { efectivo: "💵 Efectivo", transferencia: "🏦 Transferencia", mercadopago: "💳 MercadoPago" };
    let text = `⏳ *Carga pendiente*\n\nMonto: ${fmt(stateData.amount)}\nMetodo: ${methodLabels[method]}`;
    if (method === "transferencia") {
      text += "\n\n📋 Datos para transferir:\nCBU: 000000000000\nAlias: labicha.bar";
    }
    if (method === "efectivo") {
      text += "\n\nPaga en el mostrador y el staff confirma tu carga.";
    }
    text += "\n\nTe aviso cuando se acredite!";
    return text;
  }

  // Fallback
  await setState(phone, "idle");
  const wallet = await getWallet(phone);
  return mainMenu(wallet?.name !== "Cliente" ? wallet.name : null);
}

// ─── HELPERS ───

async function showMenuCategory(phone, cat) {
  const { data: items } = await supabaseServer
    .from("bicha_menu_items")
    .select("*")
    .eq("category", cat)
    .eq("available", true)
    .order("name");

  if (!items || items.length === 0) {
    return `No hay items disponibles en ${CATEGORY_LABELS[cat]}. Escribi *hola* para volver.`;
  }

  // Preserve existing cart from state
  const botState = await getState(phone);
  const cart = botState.data?.cart || [];

  await setState(phone, "menu_items", { cat, items, cart });

  let text = `${CATEGORY_LABELS[cat]}\n\n`;
  items.forEach((item, i) => {
    text += `${i + 1}️⃣ ${item.name} — ${fmt(item.price)}\n`;
    if (item.description) text += `   _${item.description}_\n`;
  });
  text += "\nEscribi el numero para agregar al carrito.";
  text += "\n*cat* = cambiar categoria · *v* = ver carrito · *c* = confirmar pedido";
  return text;
}

function showCart(cart) {
  if (cart.length === 0) return "🛒 Tu carrito esta vacio.";
  let text = "🛒 *Tu carrito:*\n\n";
  let total = 0;
  cart.forEach((item, i) => {
    text += `${item.quantity}x ${item.name} — ${fmt(item.price * item.quantity)}\n`;
    total += item.price * item.quantity;
  });
  text += `\n💰 *Total: ${fmt(total)}*`;
  return text;
}

async function showPacks(phone) {
  const { data: packs } = await supabaseServer
    .from("bicha_packs")
    .select("*")
    .eq("active", true)
    .order("price");

  if (!packs || packs.length === 0) return "No hay packs disponibles ahora.";

  await setState(phone, "packs_list", { packs });

  let text = "📦 *Packs disponibles*\n\n";
  packs.forEach((p, i) => {
    text += `${i + 1}️⃣ *${p.name}* — ${fmt(p.price)}\n`;
    text += `   ${p.description}`;
    if (p.includes_game) text += " + 🎮 1h juego";
    text += "\n";
  });
  text += "\nEscribi el numero del pack que queres.";
  return text;
}

async function showWallet(phone) {
  const wallet = await getWallet(phone);
  await setState(phone, "idle");

  let text = `💰 *Tu Wallet*\n\n`;
  text += `Saldo: *${fmt(wallet.balance)}*\n`;

  // Show recent transactions
  const { data: txns } = await supabaseServer
    .from("bicha_wallet_transactions")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(5);

  if (txns && txns.length > 0) {
    text += "\nUltimos movimientos:\n";
    txns.forEach((tx) => {
      const sign = tx.type === "topup" || tx.type === "refund" ? "+" : "-";
      const status = tx.status === "confirmed" ? "✅" : "⏳";
      text += `${status} ${sign}${fmt(tx.amount)} — ${tx.description || tx.type}\n`;
    });
  }

  text += "\nEscribi *5* para cargar creditos o *hola* para el menu.";
  return text;
}

async function showMyPacks(phone) {
  const { data: packs } = await supabaseServer
    .from("bicha_pack_purchases")
    .select("*, bicha_packs(name, description)")
    .eq("phone", phone)
    .gt("remaining", 0)
    .order("purchased_at", { ascending: false });

  await setState(phone, "idle");

  if (!packs || packs.length === 0) {
    return "No tenes packs activos.\n\nEscribi *2* para ver packs disponibles o *hola* para el menu.";
  }

  let text = "🎟️ *Tus packs activos*\n\n";
  packs.forEach((p) => {
    const status = p.payment_status === "confirmed" ? "✅" : "⏳ Pago pendiente";
    text += `📦 *${p.bicha_packs?.name}*\n`;
    text += `   Codigo: *${p.redeem_code}*\n`;
    text += `   Restantes: ${p.remaining}\n`;
    text += `   Estado: ${status}\n`;
    if (p.game_available) {
      text += `   🎮 Juego: ${GAME_LABELS[p.game_type] || "disponible"}\n`;
    }
    text += "\n";
  });

  text += "Mostra tu codigo al staff para canjear.\nEscribi *hola* para volver al menu.";
  return text;
}

async function showTopUp(phone) {
  await setState(phone, "topup_amount");
  return "💰 *Cargar creditos*\n\nCuanto queres cargar? Escribi el monto (ej: 5000, 10000).\n\nMinimo: $1.000";
}

async function createPackPurchase(phone, pack, paymentMethod, gameType) {
  const wallet = await getWallet(phone);
  const redeem_code = generateRedeemCode();

  const { data: purchase } = await supabaseServer.from("bicha_pack_purchases").insert({
    pack_id: pack.id,
    redeem_code,
    guest_name: wallet.name,
    phone,
    payment_method: paymentMethod,
    payment_status: "pending",
    remaining: pack.units,
    game_available: pack.includes_game,
    game_type: gameType || null,
  }).select("*, bicha_packs(name)").single();

  await setState(phone, "idle");

  const methodLabels = { efectivo: "💵 Efectivo", transferencia: "🏦 Transferencia", mercadopago: "💳 MercadoPago" };
  let text = `⏳ *Pack reservado!*\n\n`;
  text += `📦 ${pack.name}\n`;
  text += `💰 ${fmt(pack.price)}\n`;
  text += `🎟️ Codigo: *${redeem_code}*\n`;
  text += `💳 Pago: ${methodLabels[paymentMethod]}`;

  if (paymentMethod === "transferencia") {
    text += "\n\n📋 Datos para transferir:\nCBU: 000000000000\nAlias: labicha.bar";
  }
  if (paymentMethod === "efectivo") {
    text += "\n\nPaga en el mostrador.";
  }
  if (gameType) {
    text += `\n🎮 Juego elegido: ${GAME_LABELS[gameType]}`;
  }

  text += "\n\nEl staff va a confirmar tu pago. Te aviso por aca!";
  return text;
}
