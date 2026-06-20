'use client';

import { useMemo } from 'react';
import { BarChart3, History } from 'lucide-react';
import { useMenuStore, useActivityStore, dayOrSkeleton } from '@/lib/stores/meal';
import { actualMacros, sumMacros, type Macros, type DailyMenu } from '@/types';
import { weekDatesFrom, formatDayLabel, dayBadge } from '@/lib/date';
import { cn } from '@/lib/utils';

function dayMacros(day: DailyMenu): { planned: Macros; actual: Macros } {
  const all = Object.values(day.meals).flat();
  return {
    planned: sumMacros(all.map((d) => d.macros)),
    actual: sumMacros(all.map(actualMacros)),
  };
}

const round = (n: number) => Math.round(n);

export default function Tracker() {
  const byDate = useMenuStore((s) => s.byDate);
  const weekStart = useMenuStore((s) => s.weekStart);
  const entries = useActivityStore((s) => s.entries);
  const clear = useActivityStore((s) => s.clear);

  const weekDates = useMemo(() => weekDatesFrom(weekStart), [weekStart]);
  const menu = useMemo(() => weekDates.map((d) => dayOrSkeleton(byDate, d)), [weekDates, byDate]);

  const rows = useMemo(() => menu.map((d) => ({ date: d.date, ...dayMacros(d) })), [menu]);
  const weekPlanned = useMemo(() => sumMacros(rows.map((r) => r.planned)), [rows]);
  const weekActual = useMemo(() => sumMacros(rows.map((r) => r.actual)), [rows]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Weekly Tracker</h2>
            <p className="text-sm text-slate-500">Proposed nutrition vs what was actually eaten.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{k}{k === 'calories' ? '' : ' (g)'}</div>
              <div className="text-lg font-semibold text-slate-800">{round(weekActual[k])}</div>
              <div className="text-[11px] text-slate-400">planned {round(weekPlanned[k])}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="p-3">Day</th>
                <th className="p-3 text-right">Calories</th>
                <th className="p-3 text-right">Protein</th>
                <th className="p-3 text-right">Carbs</th>
                <th className="p-3 text-right">Fat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = dayBadge(r.date);
                return (
                  <tr key={r.date} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 font-medium text-slate-700">
                      {formatDayLabel(r.date)}
                      {badge && <span className="ml-1.5 text-[10px] font-semibold uppercase text-emerald-600">{badge}</span>}
                    </td>
                    {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => {
                      const diff = round(r.actual[k]) - round(r.planned[k]);
                      return (
                        <td key={k} className="p-3 text-right tabular-nums">
                          <span className="text-slate-800">{round(r.actual[k])}</span>
                          <span className="text-slate-300"> / {round(r.planned[k])}</span>
                          {diff !== 0 && (
                            <span className={cn('ml-1 text-[10px]', diff > 0 ? 'text-amber-600' : 'text-sky-600')}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400">Actual / planned. Dishes with no input are assumed eaten as planned; skipped dishes count as zero.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            <h3 className="font-display text-lg font-semibold text-slate-800">Activity log</h3>
          </div>
          {entries.length > 0 && <button onClick={clear} className="text-xs text-slate-400 hover:text-red-500">Clear</button>}
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet. Changes will appear here, attributed to whoever is signed in.</p>
        ) : (
          <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 shadow-sm">
            {entries.slice(0, 50).map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                  e.user === 'Swati' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700')}>{e.user}</span>
                <span className="text-slate-700 flex-1"><span className="font-medium">{e.action}</span> · {e.detail}</span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(e.at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
