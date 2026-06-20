'use client';

import { useMemo } from 'react';
import { ShoppingCart, AlarmClock } from 'lucide-react';
import { useMenuStore } from '@/lib/stores/meal';
import { buildIngredientPlan } from '@/lib/meal-logic';
import { DAYS_OF_WEEK } from '@/types';

export default function Ingredients() {
  const menu = useMenuStore((s) => s.menu);
  const plan = useMemo(() => buildIngredientPlan(menu), [menu]);
  const total = Object.values(plan).reduce((n, list) => n + list.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-emerald-600" />
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Ingredients &amp; Timing</h2>
          <p className="text-sm text-slate-500">Key items to procure or soak, and by when, for the week’s plan.</p>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-center text-slate-400 py-12">No special ingredients flagged yet. Fill your week to generate this list.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DAYS_OF_WEEK.map((day) => {
            const lines = plan[day];
            if (lines.length === 0) return null;
            return (
              <div key={day} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="font-display font-semibold text-emerald-800 border-b border-emerald-100 pb-2 mb-3">{day}</h3>
                <ul className="space-y-3">
                  {lines.map((l, i) => (
                    <li key={i} className="text-sm">
                      <div className="font-medium text-slate-800">{l.item}</div>
                      <div className="text-[11px] text-slate-500">for {l.forDish} · {l.meal}</div>
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 font-medium mt-0.5">
                        <AlarmClock className="w-3 h-3" /> {l.availableBy}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
