'use client';

import { useMemo, useState } from 'react';
import { ShoppingCart, AlarmClock, Pencil, X, Undo2 } from 'lucide-react';
import { useMenuStore, dayOrSkeleton, usePrepOverridesStore } from '@/lib/stores/meal';
import { buildIngredientPlan } from '@/lib/meal-logic';
import { weekDatesFrom, formatDayLabel, dayBadge } from '@/lib/date';

export default function Ingredients() {
  const byDate = useMenuStore((s) => s.byDate);
  const weekStart = useMenuStore((s) => s.weekStart);
  const dismissed = usePrepOverridesStore((s) => s.dismissed);
  const edits = usePrepOverridesStore((s) => s.edits);
  const dismiss = usePrepOverridesStore((s) => s.dismiss);
  const restore = usePrepOverridesStore((s) => s.restore);
  const setEdit = usePrepOverridesStore((s) => s.setEdit);

  const weekDates = useMemo(() => weekDatesFrom(weekStart), [weekStart]);
  const menu = useMemo(() => weekDates.map((d) => dayOrSkeleton(byDate, d)), [weekDates, byDate]);
  const plan = useMemo(() => buildIngredientPlan(menu), [menu]);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (key: string, current: string) => { setEditingKey(key); setDraft(current); };
  const commitEdit = () => {
    if (editingKey) setEdit(editingKey, draft.trim());
    setEditingKey(null);
  };

  const total = weekDates.reduce(
    (n, date) => n + (plan[date] ?? []).filter((l) => !dismissed.includes(`ing:${date}::${l.item}`)).length,
    0,
  );

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
          {weekDates.map((date) => {
            const allLines = plan[date] ?? [];
            const lines = allLines.filter((l) => !dismissed.includes(`ing:${date}::${l.item}`));
            const hiddenKeys = allLines.map((l) => `ing:${date}::${l.item}`).filter((k) => dismissed.includes(k));
            if (lines.length === 0 && hiddenKeys.length === 0) return null;
            const badge = dayBadge(date);
            return (
              <div key={date} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="font-display font-semibold text-emerald-800 border-b border-emerald-100 pb-2 mb-3 flex items-center gap-2">
                  {formatDayLabel(date)}
                  {badge && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">{badge}</span>}
                </h3>
                {lines.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nothing left to procure.</p>
                ) : (
                  <ul className="space-y-3">
                    {lines.map((l) => {
                      const key = `ing:${date}::${l.item}`;
                      const defaultText = `${l.item} — for ${l.forDish} (${l.meal}) — ${l.availableBy}`;
                      const edited = edits[key];
                      return (
                        <li key={key} className="text-sm group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {editingKey === key ? (
                                <input
                                  autoFocus
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                                  className="w-full text-sm text-slate-700 border border-emerald-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              ) : edited ? (
                                <span className="text-slate-800 font-medium leading-snug block">{edited}</span>
                              ) : (
                                <>
                                  <div className="font-medium text-slate-800">{l.item}</div>
                                  <div className="text-[11px] text-slate-500">for {l.forDish} · {l.meal}</div>
                                  <div className="flex items-center gap-1 text-[11px] text-amber-600 font-medium mt-0.5">
                                    <AlarmClock className="w-3 h-3" /> {l.availableBy}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(key, edited ?? defaultText)} title="Edit" className="text-slate-400 hover:text-emerald-600 p-0.5"><Pencil className="w-3.5 h-3.5" /></button>
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
