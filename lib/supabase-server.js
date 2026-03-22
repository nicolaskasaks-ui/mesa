// Database adapter — uses local JSON-file DB (no cloud dependency)
import { localDB } from "./local-db";

export const supabaseServer = localDB;
