-- ═══════════════════════════════════════════════════
-- LA BICHA — Database Setup
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Menu items
CREATE TABLE IF NOT EXISTS bicha_menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL, -- 'birras', 'tragos', 'comida', 'juegos', 'otros'
  description TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tickets (orders)
CREATE TABLE IF NOT EXISTS bicha_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number INT NOT NULL,
  guest_name TEXT NOT NULL,
  phone TEXT,
  table_sector TEXT NOT NULL,
  items_json JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  estimated_minutes INT DEFAULT 15,
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers (loyalty)
CREATE TABLE IF NOT EXISTS bicha_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  stamps_count INT DEFAULT 0,
  total_orders INT DEFAULT 0,
  last_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Packs (definitions)
CREATE TABLE IF NOT EXISTS bicha_packs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'birras', 'empanadas', 'fernets'
  units INT NOT NULL DEFAULT 3,
  price NUMERIC(10,2) NOT NULL,
  includes_game BOOLEAN DEFAULT false,
  game_type TEXT, -- 'pingpong', 'pool', 'metegol', null
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pack purchases
CREATE TABLE IF NOT EXISTS bicha_pack_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id UUID REFERENCES bicha_packs(id),
  redeem_code TEXT UNIQUE NOT NULL, -- 6-char code for QR redemption
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- 'mercadopago', 'transferencia', 'efectivo'
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'rejected')),
  remaining INT NOT NULL DEFAULT 0,
  game_available BOOLEAN DEFAULT false,
  game_type TEXT,
  purchased_at TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE bicha_tickets;

-- Sample menu items
INSERT INTO bicha_menu_items (name, price, category, description) VALUES
  ('IPA Artesanal', 3500, 'birras', 'Pinta de IPA local'),
  ('Lager Rubia', 3000, 'birras', 'Pinta rubia clásica'),
  ('Stout Negra', 3500, 'birras', 'Pinta stout cremosa'),
  ('Fernet con Coca', 4000, 'tragos', 'El clásico argentino'),
  ('Negroni', 5000, 'tragos', 'Gin, Campari, Vermut'),
  ('Gin Tonic', 5000, 'tragos', 'Gin con tónica premium'),
  ('Empanadas de Carne x3', 4500, 'comida', 'Trío de empanadas de carne'),
  ('Empanadas JyQ x3', 4500, 'comida', 'Trío de empanadas jamón y queso'),
  ('Papas Fritas', 4000, 'comida', 'Porción de papas con salsas'),
  ('Tabla de Picada', 7500, 'comida', 'Fiambres, quesos, aceitunas'),
  ('Ping Pong 1h', 5000, 'juegos', '1 hora de mesa de ping pong'),
  ('Pool 1h', 6000, 'juegos', '1 hora de mesa de pool'),
  ('Metegol 1h', 4000, 'juegos', '1 hora de metegol');

-- Sample packs
INSERT INTO bicha_packs (name, description, category, units, price, includes_game, game_type) VALUES
  ('Trío de Birras', '3 pintas a elección', 'birras', 3, 9000, false, null),
  ('Docena de Birras', '12 pintas a elección + 1h juego gratis', 'birras', 12, 33000, true, null),
  ('Trío de Fernets', '3 fernets con Coca', 'fernets', 3, 10500, false, null),
  ('Trío de Empanadas', '3 empanadas del mismo sabor', 'empanadas', 3, 4000, false, null),
  ('Docena de Empanadas', '12 empanadas del mismo sabor + 1h juego gratis', 'empanadas', 12, 14000, true, null);
