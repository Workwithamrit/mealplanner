'use client';

import { useMemo, useState } from 'react';
import { Clock, ChefHat, Pencil, X, Undo2 } from 'lucide-react';
import { useMenuStore, dayOrSkeleton, usePrepOverridesStore } from '@/lib/stores/meal';
import { buildPrepTasks } from '@/lib/meal-logic';
import { weekDatesFrom, formatDayLabel, dayBadge } from '@/lib/date';

export default function MealPrep() {
  const byDate = useMenuStore((s) => s.byDate);
  const weekStart = useMenuStore((s) => s.weekStart);
  const dismissed = usePrepOverridesStore((s) => s.dismissed);
  const edits = usePrepOverridesStore((s) => s.edits);
  const dismiss = usePrepOverridesStore((s) => s.dismiss);
  const restore = usePrepOverridesStore((s) => s.restore);
  const setEdit = usePrepOverridesStore((s) => s.setEdit);

  const weekDates = useMemo(() => weekDatesFrom(weekStart), [weekStart]);
  const menu = useMemo(() => weekDates.map((d) => dayOrSkeleton(byDate, d)), [weekDates, byDate]);
  const prep = useMemo(() => buildPrepTasks(menu), [menu]);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (key: string, current: string) => { setEditingKey(key); setDraft(current); };
  const commitEdit = () => {
    if (editingKey) setEdit(editingKey, draft.trim());
    setEditingKey(null);
  };

  const total = weekDates.reduce(
    (n, date) => n + (prep[date] ?? []).filter((t) => !dismissed.includes(`prep:${date}::${t.task}`)).length,
    0,
  );

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
            const allTasks = prep[date] ?? [];
            const tasks = allTasks.filter((t) => !dismissed.includes(`prep:${date}::${t.task}`));
            const hiddenKeys = allTasks.map((t) => `prep:${date}::${t.task}`).filter((k) => dismissed.includes(k));
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
                    {tasks.map((t) => {
                      const key = `prep:${date}::${t.task}`;
                      const text = edits[key] ?? t.task;
                      return (
                        <li key={key} className="text-sm group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-amber-600">
                                <Clock className="w-3 h-3" /> {t.timing}
                              </span>
                              {editingKey === key ? (
                                <input
                                  autoFocus
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                                  className="mt-0.5 w-full text-sm text-slate-700 border border-emerald-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              ) : (
                                <span className="text-slate-700 leading-snug block">{text}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(key, text)} title="Edit" className="text-slate-400 hover:text-emerald-600 p-0.5"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => dismiss(key)} title="Remove" className="text-slate-400 hover:text-red-500 p-0.5"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {hiddenKeys.length > 0 && (
                  <button onClick={() => hiddenKeys.forEach(restore)} className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-600">
                    <Undo2 className="w-3 h-3" /> {hiddenKeys.length} removed — restore
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
