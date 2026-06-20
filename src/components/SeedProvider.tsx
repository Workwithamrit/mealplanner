'use client';

import { useEffect, useState } from 'react';
import { useDishStore } from '@/lib/stores/meal';
import { SEED_DISHES } from '@/lib/seed-dishes';

/**
 * Seeds the dish bank on first run and gates rendering until the persisted
 * (IndexedDB / shared Supabase) state has hydrated, so the UI never flashes
 * empty before the cloud value loads.
 */
export default function SeedProvider({ children }: { children: React.ReactNode }) {
  const seed = useDishStore((s) => s.seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useDishStore.persist.onFinishHydration(() => {
      seed(SEED_DISHES);
      setHydrated(true);
    });
    // Already hydrated before the listener attached.
    if (useDishStore.persist.hasHydrated()) {
      seed(SEED_DISHES);
      setHydrated(true);
    }
    return unsub;
  }, [seed]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading your kitchen…
      </div>
    );
  }
  return <>{children}</>;
}
