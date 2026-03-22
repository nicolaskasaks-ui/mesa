// Client-side DB adapter — calls /api/db to query local JSON database
// Drop-in replacement for Supabase client SDK

class ClientQueryBuilder {
  constructor(table, operation, payload) {
    this._table = table;
    this._op = operation;
    this._payload = payload;
    this._filters = [];
    this._orders = [];
    this._limitN = null;
    this._single = false;
    this._selectStr = "*";
    this._countMode = false;
    this._headMode = false;
    this._chainSelect = null;
  }

  select(fields, opts) {
    if (this._op === "select") {
      this._selectStr = fields || "*";
      if (opts?.count === "exact") this._countMode = true;
      if (opts?.head) this._headMode = true;
    } else {
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

  order(field, opts) { this._orders.push({ field, ascending: opts?.ascending !== false }); return this; }
  limit(n) { this._limitN = n; return this; }
  single() { this._single = true; return this; }

  subscribe() { return this; } // no-op for realtime compat

  then(resolve, reject) {
    this._execute().then(resolve).catch(reject);
  }

  async _execute() {
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: this._table,
          operation: this._op,
          payload: this._payload,
          filters: this._filters.length > 0 ? this._filters : undefined,
          orders: this._orders.length > 0 ? this._orders : undefined,
          limitN: this._limitN,
          single: this._single || undefined,
          selectStr: this._selectStr !== "*" ? this._selectStr : undefined,
          countMode: this._countMode || undefined,
          headMode: this._headMode || undefined,
          chainSelect: this._chainSelect,
        }),
      });
      return await res.json();
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }
}

class ClientTableRef {
  constructor(table) { this._table = table; }
  select(fields, opts) {
    const qb = new ClientQueryBuilder(this._table, "select");
    return qb.select(fields, opts);
  }
  insert(data) { return new ClientQueryBuilder(this._table, "insert", data); }
  update(data) { return new ClientQueryBuilder(this._table, "update", data); }
  delete() { return new ClientQueryBuilder(this._table, "delete"); }
  upsert(data) { return new ClientQueryBuilder(this._table, "upsert", data); }
}

// No-op channel for realtime compatibility
class NoopChannel {
  on() { return this; }
  subscribe() { return this; }
}

export const supabase = {
  from(table) { return new ClientTableRef(table); },
  channel() { return new NoopChannel(); },
  removeChannel() {},
};
