'use client';

import { useEffect, useState } from 'react';
import { useDishStore, useMenuStore, useConfigStore } from '@/lib/stores/meal';
import { SEED_DISHES } from '@/lib/seed-dishes';
import { DEFAULT_SLOTS, type DayMeals } from '@/types';

// Map legacy menu keys (meal names, used before slots had ids) → default slot ids.
const LEGACY_KEY: Record<string, string> = {
  'Early Morning': 'early-morning', Breakfast: 'breakfast', Lunch: 'lunch', Snack: 'snack', Dinner: 'dinner',
};

function reconcileMenu() {
  const slotIds = new Set(useConfigStore.getState().slots.map((s) => s.id));
  const menu = useMenuStore.getState().menu;
  let changed = false;
  const next = menu.map((d) => {
    const meals: DayMeals = { ...d.meals };
    for (const k of Object.keys(meals)) {
      const target = LEGACY_KEY[k];
      if (!slotIds.has(k) && target && slotIds.has(target)) {
        meals[target] = [...(meals[target] ?? []), ...meals[k]];
        delete meals[k];
        changed = true;
      }
    }
    return { ...d, meals };
  });
  if (changed) useMenuStore.getState().setMenu(next);
  useMenuStore.getState().syncSlots();
}

/**
 * Seeds the dish bank on first run and gates rendering until the persisted
 * (IndexedDB / shared Supabase) state has hydrated, so the UI never flashes
 * empty before the cloud value loads. Also migrates legacy plan keys.
 */
export default function SeedProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stores = [useDishStore, useConfigStore, useMenuStore];
    const done = new Set<number>();
    const check = () => {
      if (done.size < stores.length) return;
      useDishStore.getState().seed(SEED_DISHES);
      // Ensure config slots exist, then align the plan to them.
      if (useConfigStore.getState().slots.length === 0) useConfigStore.setState({ slots: DEFAULT_SLOTS });
      reconcileMenu();
      setReady(true);
    };
    const unsubs = stores.map((store, i) => {
      if (store.persist.hasHydrated()) { done.add(i); }
      return store.persist.onFinishHydration(() => { done.add(i); check(); });
    });
    check(); // in case all were already hydrated
    return () => unsubs.forEach((u) => u());
  }, []);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading your kitchen…</div>;
  }
  return <>{children}</>;
}
