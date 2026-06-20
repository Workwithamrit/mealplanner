'use client';

import { useMemo } from 'react';
import { Clock, ChefHat } from 'lucide-react';
import { useMenuStore, dayOrSkeleton } from '@/lib/stores/meal';
import { buildPrepTasks } from '@/lib/meal-logic';
import { weekDatesFrom, formatDayLabel, dayBadge } from '@/lib/date';

export default function MealPrep() {
  const byDate = useMenuStore((s) => s.byDate);
  const weekStart = useMenuStore((s) => s.weekStart);
  const weekDates = useMemo(() => weekDatesFrom(weekStart), [weekStart]);
  const menu = useMemo(() => weekDates.map((d) => dayOrSkeleton(byDate, d)), [weekDates, byDate]);
  const prep = useMemo(() => buildPrepTasks(menu), [menu]);
  const total = weekDates.reduce((n, d) => n + (prep[d]?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ChefHat className="w-5 h-5 text-emerald-600" />
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Meal Prep Schedule</h2>
          <p className="text-sm text-slate-500">Soak, grind, ferment and marinate — timed off your week’s plan.</p>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-center text-slate-400 py-12">No advance prep needed yet. Regenerate or fill your week to see tasks.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {weekDates.map((date) => {
            const tasks = prep[date] ?? [];
            const badge = dayBadge(date);
            return (
              <div key={date} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="font-display font-semibold text-emerald-800 border-b border-emerald-100 pb-2 mb-3 flex items-center gap-2">
                  {formatDayLabel(date)}
                  {badge && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">{badge}</span>}
                </h3>
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nothing to prep.</p>
                ) : (
                  <ul className="space-y-3">
                    {tasks.map((t, i) => (
                      <li key={i} className="text-sm">
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-amber-600">
                          <Clock className="w-3 h-3" /> {t.timing}
                        </span>
                        <span className="text-slate-700 leading-snug">{t.task}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
