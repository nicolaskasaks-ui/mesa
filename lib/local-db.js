// Local JSON-file database with Supabase-compatible query builder
// Replaces Supabase for fully local operation — no cloud dependency

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), ".local-db");

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function readTable(table) {
  const p = filePath(table);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

function writeTable(table, rows) {
  fs.writeFileSync(filePath(table), JSON.stringify(rows, null, 2), "utf8");
}

// Relationship config — maps "table(fields)" to foreign key
const RELATIONS = {
  // bicha_pack_purchases.pack_id → bicha_packs.id
  "bicha_pack_purchases.bicha_packs": { fk: "pack_id", pk: "id" },
  // bicha_wallet_transactions → bicha_wallets via phone
  "bicha_wallet_transactions.bicha_wallets": { fk: "phone", pk: "phone" },
  // waitlist.customer_id → customers.id
  "waitlist.customers": { fk: "customer_id", pk: "id" },
  // tables → waitlist via current_waitlist_id or similar
  "tables.waitlist": { fk: "current_waitlist_id", pk: "id" },
};

// Parse select string for relationships: "*, bicha_packs(name, description)"
function parseSelect(selectStr) {
  if (!selectStr) return { fields: "*", joins: [] };
  const joins = [];
  // Match patterns like: tableName(field1, field2, ...)
  const joinRegex = /(\w+)\(([^)]+)\)/g;
  let cleaned = selectStr;
  let match;
  while ((match = joinRegex.exec(selectStr)) !== null) {
    joins.push({ table: match[1], fields: match[2].split(",").map((f) => f.trim()) });
    cleaned = cleaned.replace(match[0], "").replace(/,\s*,/, ",").replace(/,\s*$/, "").replace(/^\s*,/, "");
  }
  const fields = cleaned.trim() || "*";
  return { fields, joins };
}

function applyFieldSelection(row, fields) {
  if (!row) return row;
  if (fields === "*") return { ...row };
  const fieldList = fields.split(",").map((f) => f.trim());
  const result = {};
  for (const f of fieldList) {
    if (f in row) result[f] = row[f];
  }
  return result;
}

function matchesFilter(row, filters) {
  for (const f of filters) {
    const val = row[f.field];
    switch (f.op) {
      case "eq":
        if (val !== f.value) return false;
        break;
      case "neq":
        if (val === f.value) return false;
        break;
      case "gt":
        if (!(val > f.value)) return false;
        break;
      case "gte":
        if (!(val >= f.value)) return false;
        break;
      case "lt":
        if (!(val < f.value)) return false;
        break;
      case "lte":
        if (!(val <= f.value)) return false;
        break;
      case "in":
        if (!f.value.includes(val)) return false;
        break;
      case "ilike": {
        const pattern = f.value.replace(/%/g, ".*");
        if (!new RegExp(pattern, "i").test(val || "")) return false;
        break;
      }
      case "not": {
        // f.value = { operator, value }
        if (f.value.operator === "is" && f.value.value === null) {
          if (val == null) return false;
        }
        break;
      }
    }
  }
  return true;
}

// Query builder that mimics Supabase's chaining API
class QueryBuilder {
  constructor(table, operation, payload) {
    this._table = table;
    this._op = operation; // "select" | "insert" | "update" | "delete" | "upsert"
    this._payload = payload;
    this._filters = [];
    this._orders = [];
    this._limitN = null;
    this._single = false;
    this._selectStr = "*";
    this._countMode = false;
    this._headMode = false;
    this._chainSelect = null; // for .insert().select() etc
  }

  select(fields, opts) {
    if (this._op === "select") {
      this._selectStr = fields || "*";
      if (opts?.count === "exact") this._countMode = true;
      if (opts?.head) this._headMode = true;
    } else {
      // Chained select after insert/update/upsert
      this._chainSelect = fields || "*";
    }
    return this;
  }

  eq(field, value) { this._filters.push({ field, op: "eq", value }); return this; }
  neq(field, value) { this._filters.push({ field, op: "neq", value }); return this; }
  gt(field, value) { this._filters.push({ field, op: "gt", value }); return this; }
  gte(field, value) { this._filters.push({ field, op: "gte", value }); return this; }
  lt(field, value) { this._filters.push({ field, op: "lt", value }); return this; }
  lte(field, value) { this._filters.push({ field, op: "lte", value }); return this; }
  in(field, values) { this._filters.push({ field, op: "in", value: values }); return this; }
  ilike(field, pattern) { this._filters.push({ field, op: "ilike", value: pattern }); return this; }
  not(field, operator, value) { this._filters.push({ field, op: "not", value: { operator, value } }); return this; }

  order(field, opts) {
    this._orders.push({ field, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n) { this._limitN = n; return this; }

  single() {
    this._single = true;
    return this;
  }

  // Execute and resolve — this makes QueryBuilder thenable
  then(resolve, reject) {
    try {
      const result = this._execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else resolve({ data: null, error: { message: err.message } });
    }
  }

  _execute() {
    switch (this._op) {
      case "select": return this._execSelect();
      case "insert": return this._execInsert();
      case "update": return this._execUpdate();
      case "delete": return this._execDelete();
      case "upsert": return this._execUpsert();
      default: return { data: null, error: { message: "Unknown operation" } };
    }
  }

  _execSelect() {
    let rows = readTable(this._table);
    rows = rows.filter((r) => matchesFilter(r, this._filters));

    if (this._countMode && this._headMode) {
      return { count: rows.length, data: null, error: null };
    }

    // Sort
    for (const o of [...this._orders].reverse()) {
      rows.sort((a, b) => {
        const av = a[o.field], bv = b[o.field];
        if (av == null && bv == null) return 0;
        if (av == null) return o.ascending ? -1 : 1;
        if (bv == null) return o.ascending ? 1 : -1;
        if (av < bv) return o.ascending ? -1 : 1;
        if (av > bv) return o.ascending ? 1 : -1;
        return 0;
      });
    }

    if (this._limitN != null) rows = rows.slice(0, this._limitN);

    // Parse select for joins + field selection
    const { fields, joins } = parseSelect(this._selectStr);

    rows = rows.map((row) => {
      let r = applyFieldSelection(row, fields);
      for (const join of joins) {
        const relKey = `${this._table}.${join.table}`;
        const rel = RELATIONS[relKey];
        if (rel) {
          const foreignRows = readTable(join.table);
          const match = foreignRows.find((fr) => fr[rel.pk] === row[rel.fk]);
          r[join.table] = match ? applyFieldSelection(match, join.fields.join(", ")) : null;
        }
      }
      return r;
    });

    if (this._single) {
      return { data: rows[0] || null, error: rows[0] ? null : { message: "No rows found" } };
    }

    if (this._countMode) {
      return { data: rows, count: rows.length, error: null };
    }

    return { data: rows, error: null };
  }

  _execInsert() {
    const rows = readTable(this._table);
    const isArray = Array.isArray(this._payload);
    const items = isArray ? this._payload : [this._payload];
    const inserted = [];

    for (const item of items) {
      const record = {
        id: item.id || randomUUID(),
        ...item,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      };
      rows.push(record);
      inserted.push(record);
    }

    writeTable(this._table, rows);

    if (this._chainSelect != null) {
      let result = inserted;
      const { fields, joins } = parseSelect(this._chainSelect);
      result = result.map((row) => {
        let r = applyFieldSelection(row, fields);
        for (const join of joins) {
          const relKey = `${this._table}.${join.table}`;
          const rel = RELATIONS[relKey];
          if (rel) {
            const foreignRows = readTable(join.table);
            const match = foreignRows.find((fr) => fr[rel.pk] === row[rel.fk]);
            r[join.table] = match ? applyFieldSelection(match, join.fields.join(", ")) : null;
          }
        }
        return r;
      });
      if (this._single) return { data: result[0] || null, error: null };
      return { data: isArray ? result : result, error: null };
    }

    return { data: isArray ? inserted : inserted[0], error: null };
  }

  _execUpdate() {
    let rows = readTable(this._table);
    const updated = [];

    rows = rows.map((row) => {
      if (matchesFilter(row, this._filters)) {
        const newRow = { ...row, ...this._payload, updated_at: this._payload.updated_at || new Date().toISOString() };
        updated.push(newRow);
        return newRow;
      }
      return row;
    });

    writeTable(this._table, rows);

    if (this._chainSelect != null) {
      let result = updated;
      const { fields, joins } = parseSelect(this._chainSelect);
      result = result.map((row) => {
        let r = applyFieldSelection(row, fields);
        for (const join of joins) {
          const relKey = `${this._table}.${join.table}`;
          const rel = RELATIONS[relKey];
          if (rel) {
            const foreignRows = readTable(join.table);
            const match = foreignRows.find((fr) => fr[rel.pk] === row[rel.fk]);
            r[join.table] = match ? applyFieldSelection(match, join.fields.join(", ")) : null;
          }
        }
        return r;
      });
      if (this._single) return { data: result[0] || null, error: null };
      return { data: result, error: null };
    }

    return { data: updated, error: null };
  }

  _execDelete() {
    let rows = readTable(this._table);
    const before = rows.length;
    rows = rows.filter((r) => !matchesFilter(r, this._filters));
    writeTable(this._table, rows);
    return { data: null, error: null, count: before - rows.length };
  }

  _execUpsert() {
    const rows = readTable(this._table);
    const items = Array.isArray(this._payload) ? this._payload : [this._payload];
    const result = [];

    for (const item of items) {
      // Match by id or by phone (for bot_state/wallets)
      const idx = rows.findIndex((r) =>
        (item.id && r.id === item.id) ||
        (item.phone && r.phone === item.phone && !item.id)
      );
      const record = {
        ...(idx >= 0 ? rows[idx] : {}),
        ...item,
        id: idx >= 0 ? rows[idx].id : (item.id || randomUUID()),
        updated_at: item.updated_at || new Date().toISOString(),
      };
      if (!record.created_at) record.created_at = new Date().toISOString();

      if (idx >= 0) {
        rows[idx] = record;
      } else {
        rows.push(record);
      }
      result.push(record);
    }

    writeTable(this._table, rows);
    return { data: result.length === 1 ? result[0] : result, error: null };
  }
}

// Table proxy — mimics supabaseServer.from("table")
class TableRef {
  constructor(table) {
    this._table = table;
  }
  select(fields, opts) {
    const qb = new QueryBuilder(this._table, "select");
    return qb.select(fields, opts);
  }
  insert(data) {
    return new QueryBuilder(this._table, "insert", data);
  }
  update(data) {
    return new QueryBuilder(this._table, "update", data);
  }
  delete() {
    return new QueryBuilder(this._table, "delete");
  }
  upsert(data) {
    return new QueryBuilder(this._table, "upsert", data);
  }
}

// Main client object — drop-in replacement for supabaseServer
export const localDB = {
  from(table) {
    return new TableRef(table);
  },
};
