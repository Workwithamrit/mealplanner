import { get, set, del } from 'idb-keyval';
import { createJSONStorage } from 'zustand/middleware';
import { getSupabase } from '../supabase';

/**
 * Hybrid persistence — identical strategy to OvO so both apps share one DB.
 *
 * - When Supabase is configured, every store's state is the single source of
 *   truth in the shared `kv_store` table (web + mobile + OvO see the same
 *   data). IndexedDB is kept as a fast local cache / offline fallback.
 * - When Supabase is NOT configured, behaviour is local-only IndexedDB —
 *   nothing breaks until the env keys are set.
 *
 * Conflict policy: last write wins (correct for a single user across devices).
 */

const TABLE = 'kv_store';

async function cloudGet(key: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from(TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return (data?.value as string) ?? null;
}

async function cloudSet(key: string, value: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() });
}

async function cloudDel(key: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from(TABLE).delete().eq('key', key);
}

export const indexedDBStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    const local = (await get(name)) ?? null;
    if (!getSupabase()) return local;
    try {
      const cloud = await cloudGet(name);
      if (cloud !== null) {
        if (cloud !== local) await set(name, cloud); // refresh local cache
        return cloud;
      }
      // Cloud has nothing yet — migrate existing local data upward.
      if (local !== null) { await cloudSet(name, local); }
      return local;
    } catch {
      return local; // offline / transient error → use local cache
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value); // local cache always
    try { await cloudSet(name, value); } catch { /* offline — local keeps it */ }
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
    try { await cloudDel(name); } catch { /* ignore */ }
  },
}));
