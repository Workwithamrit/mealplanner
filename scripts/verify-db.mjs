/**
 * Verify SwYam shares OvO's Supabase `kv_store`, and seed the meal data into it.
 *
 * Usage (reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local, or pass them inline):
 *   node scripts/verify-db.mjs
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-db.mjs --seed
 *
 * Flags:
 *   --seed   also write the seed dish bank to `ovo-meal-dishes` (idempotent;
 *            skips if the key already has dishes).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { SEED_DISHES } from '../src/lib/seed-dishes.ts';

function fromEnvFile() {
  try {
    const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const get = (k) => (txt.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').replace(/^["']|["']$/g, '').trim();
    return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') };
  } catch {
    return { url: '', key: '' };
  }
}

const env = fromEnvFile();
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || env.url;
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.key;
const doSeed = process.argv.includes('--seed');

if (!url || !key) {
  console.error('❌ Missing Supabase URL / anon key. Put them in .env.local or pass SUPABASE_URL / SUPABASE_ANON_KEY.');
  process.exit(1);
}

const sb = createClient(url, key);

async function main() {
  console.log(`🔌 Connecting to ${url}`);

  // 1) Prove it's the shared (OvO) DB by listing existing keys.
  const { data: rows, error } = await sb.from('kv_store').select('key, updated_at').order('updated_at', { ascending: false });
  if (error) { console.error('❌ kv_store read failed:', error.message); process.exit(1); }
  console.log(`✅ kv_store reachable — ${rows.length} keys present:`);
  for (const r of rows) console.log(`   • ${r.key}  (updated ${r.updated_at})`);

  const ovoKeys = rows.filter((r) => r.key.startsWith('ovo-') && !r.key.startsWith('ovo-meal-'));
  console.log(ovoKeys.length ? `✅ Found ${ovoKeys.length} OvO key(s) — same database confirmed.` : 'ℹ️  No OvO app keys yet (OvO may not have synced on this device).');

  // 2) Round-trip a health-check key in the exact storage shape the app uses.
  const hcKey = 'ovo-meal-_healthcheck';
  const stamp = new Date().toISOString();
  await sb.from('kv_store').upsert({ key: hcKey, value: JSON.stringify({ ok: true, at: stamp }), updated_at: stamp });
  const { data: hc } = await sb.from('kv_store').select('value').eq('key', hcKey).maybeSingle();
  console.log(`✅ Write/read round-trip OK: ${hc?.value}`);
  await sb.from('kv_store').delete().eq('key', hcKey);

  // 3) Optionally seed the dish bank so OvO can read meal data immediately.
  if (doSeed) {
    const { data: existing } = await sb.from('kv_store').select('value').eq('key', 'ovo-meal-dishes').maybeSingle();
    const parsed = existing?.value ? JSON.parse(existing.value) : null;
    const hasDishes = parsed?.state?.dishes?.length || parsed?.dishes?.length;
    if (hasDishes) {
      console.log(`ℹ️  ovo-meal-dishes already has ${hasDishes} dishes — leaving as is.`);
    } else {
      // zustand persist envelope: { state: {...}, version: 0 }
      const envelope = { state: { dishes: SEED_DISHES }, version: 0 };
      await sb.from('kv_store').upsert({ key: 'ovo-meal-dishes', value: JSON.stringify(envelope), updated_at: new Date().toISOString() });
      console.log(`✅ Seeded ovo-meal-dishes with ${SEED_DISHES.length} dishes into OvO's DB.`);
    }
  }

  console.log('\n🎉 Shared-DB verification complete.');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
