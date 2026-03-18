import { createClient } from "@supabase/supabase-js";

// Server-side client with service role key — bypasses RLS
// Only use in API routes (server-side), never expose to client
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseServer = url && serviceKey ? createClient(url, serviceKey) : null;
