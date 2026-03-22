// Generic local-DB proxy — allows client-side pages to query local JSON DB
// via fetch calls instead of direct Supabase client SDK

import { localDB } from "../../../lib/local-db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const ops = await req.json(); // array of operations
    const results = [];

    for (const op of Array.isArray(ops) ? ops : [ops]) {
      const result = await executeOp(op);
      results.push(result);
    }

    return NextResponse.json(Array.isArray(ops) ? results : results[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function executeOp({ table, operation, payload, filters, orders, limitN, single, selectStr, countMode, headMode, chainSelect }) {
  let qb;

  switch (operation) {
    case "select":
      qb = localDB.from(table).select(selectStr || "*", countMode ? { count: "exact", head: !!headMode } : undefined);
      break;
    case "insert":
      qb = localDB.from(table).insert(payload);
      if (chainSelect != null) qb = qb.select(chainSelect);
      break;
    case "update":
      qb = localDB.from(table).update(payload);
      if (chainSelect != null) qb = qb.select(chainSelect);
      break;
    case "delete":
      qb = localDB.from(table).delete();
      break;
    case "upsert":
      qb = localDB.from(table).upsert(payload);
      break;
    default:
      return { data: null, error: { message: "Unknown operation" } };
  }

  // Apply filters
  if (filters) {
    for (const f of filters) {
      switch (f.op) {
        case "eq": qb = qb.eq(f.field, f.value); break;
        case "neq": qb = qb.neq(f.field, f.value); break;
        case "gt": qb = qb.gt(f.field, f.value); break;
        case "gte": qb = qb.gte(f.field, f.value); break;
        case "lt": qb = qb.lt(f.field, f.value); break;
        case "lte": qb = qb.lte(f.field, f.value); break;
        case "in": qb = qb.in(f.field, f.value); break;
        case "ilike": qb = qb.ilike(f.field, f.value); break;
        case "not": qb = qb.not(f.field, f.value.operator, f.value.value); break;
      }
    }
  }

  if (orders) {
    for (const o of orders) qb = qb.order(o.field, { ascending: o.ascending });
  }

  if (limitN != null) qb = qb.limit(limitN);
  if (single) qb = qb.single();

  return await qb;
}
