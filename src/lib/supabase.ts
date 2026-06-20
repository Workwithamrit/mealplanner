import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase — the SAME project OvO uses, so SwYam's meal data lives in
 * the same `kv_store` table and the OvO Assistant can read it later.
 *
 * Set on the SwYam Vercel project (identical values to OvO):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Until those are present the app runs fully on local IndexedDB.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export const isSupabaseConfigured = () => getSupabase() !== null;
