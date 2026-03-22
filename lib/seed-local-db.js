// Seed script for local JSON database
// Run: node lib/seed-local-db.js

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), ".local-db");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function write(table, data) {
  const p = path.join(DATA_DIR, `${table}.json`);
  // Don't overwrite if already exists
  if (fs.existsSync(p)) {
    const existing = JSON.parse(fs.readFileSync(p, "utf8"));
    if (existing.length > 0) {
      console.log(`  ⏭️  ${table}: already has ${existing.length} rows, skipping`);
      return;
    }
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
  console.log(`  ✅ ${table}: seeded ${data.length} rows`);
}

const now = new Date().toISOString();

// Menu items
write("bicha_menu_items", [
  { id: randomUUID(), name: "IPA Artesanal", price: 3500, category: "birras", description: "Pinta de IPA local", available: true, created_at: now },
  { id: randomUUID(), name: "Lager Rubia", price: 3000, category: "birras", description: "Pinta rubia clásica", available: true, created_at: now },
  { id: randomUUID(), name: "Stout Negra", price: 3500, category: "birras", description: "Pinta stout cremosa", available: true, created_at: now },
  { id: randomUUID(), name: "Fernet con Coca", price: 4000, category: "tragos", description: "El clásico argentino", available: true, created_at: now },
  { id: randomUUID(), name: "Negroni", price: 5000, category: "tragos", description: "Gin, Campari, Vermut", available: true, created_at: now },
  { id: randomUUID(), name: "Gin Tonic", price: 5000, category: "tragos", description: "Gin con tónica premium", available: true, created_at: now },
  { id: randomUUID(), name: "Empanadas de Carne x3", price: 4500, category: "comida", description: "Trío de empanadas de carne", available: true, created_at: now },
  { id: randomUUID(), name: "Empanadas JyQ x3", price: 4500, category: "comida", description: "Trío de empanadas jamón y queso", available: true, created_at: now },
  { id: randomUUID(), name: "Papas Fritas", price: 4000, category: "comida", description: "Porción de papas con salsas", available: true, created_at: now },
  { id: randomUUID(), name: "Tabla de Picada", price: 7500, category: "comida", description: "Fiambres, quesos, aceitunas", available: true, created_at: now },
  { id: randomUUID(), name: "Ping Pong 1h", price: 5000, category: "juegos", description: "1 hora de mesa de ping pong", available: true, created_at: now },
  { id: randomUUID(), name: "Pool 1h", price: 6000, category: "juegos", description: "1 hora de mesa de pool", available: true, created_at: now },
  { id: randomUUID(), name: "Metegol 1h", price: 4000, category: "juegos", description: "1 hora de metegol", available: true, created_at: now },
]);

// Packs
write("bicha_packs", [
  { id: randomUUID(), name: "Trío de Birras", description: "3 pintas a elección", category: "birras", units: 3, price: 9000, includes_game: false, game_type: null, active: true, created_at: now },
  { id: randomUUID(), name: "Docena de Birras", description: "12 pintas a elección + 1h juego gratis", category: "birras", units: 12, price: 33000, includes_game: true, game_type: null, active: true, created_at: now },
  { id: randomUUID(), name: "Trío de Fernets", description: "3 fernets con Coca", category: "fernets", units: 3, price: 10500, includes_game: false, game_type: null, active: true, created_at: now },
  { id: randomUUID(), name: "Trío de Empanadas", description: "3 empanadas del mismo sabor", category: "empanadas", units: 3, price: 4000, includes_game: false, game_type: null, active: true, created_at: now },
  { id: randomUUID(), name: "Docena de Empanadas", description: "12 empanadas del mismo sabor + 1h juego gratis", category: "empanadas", units: 12, price: 14000, includes_game: true, game_type: null, active: true, created_at: now },
]);

// Empty tables (just create the files)
for (const t of ["bicha_tickets", "bicha_customers", "bicha_wallets", "bicha_wallet_transactions", "bicha_bot_state", "bicha_pack_purchases", "tables", "waitlist", "customers", "preorders", "bar_redemptions"]) {
  const p = path.join(DATA_DIR, `${t}.json`);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, "[]", "utf8");
    console.log(`  ✅ ${t}: created (empty)`);
  } else {
    console.log(`  ⏭️  ${t}: already exists`);
  }
}

// Seed default tables for restaurant mode
const tablesFile = path.join(DATA_DIR, "tables.json");
const tablesData = JSON.parse(fs.readFileSync(tablesFile, "utf8"));
if (tablesData.length === 0) {
  const defaultTables = [];
  for (let i = 1; i <= 10; i++) {
    defaultTables.push({
      id: i,
      name: `Mesa ${i}`,
      capacity: i <= 4 ? 2 : i <= 7 ? 4 : 6,
      status: "available",
      current_waitlist_id: null,
      seated_at: null,
      created_at: now,
    });
  }
  fs.writeFileSync(tablesFile, JSON.stringify(defaultTables, null, 2), "utf8");
  console.log("  ✅ tables: seeded 10 default tables");
}

console.log("\n🍺 La Bicha local DB ready!");
