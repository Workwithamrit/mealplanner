'use client';

import { useState } from 'react';
import { RefreshCw, Plus, Trash2, Check, Sparkles, X, Users, Replace, Store, Loader2, Ban } from 'lucide-react';
import {
  useMenuStore, useDishStore, useConfigStore, dishToPlanInstance, peopleForSlot, logActivity,
} from '@/lib/stores/meal';
import { generateWeek, generateOneDay } from '@/lib/meal-logic';
import { smartFillDay, generateDishByName } from '@/lib/ai';
import { cn, isVegName } from '@/lib/utils';
import {
  type WeekDay, type DietType, type Dish, type MealPlanDish, type MealSlot, type DayMeals, type Macros, ZERO_MACROS,
} from '@/types';

export default function WeeklyMenu() {
  const {
    menu, setMenu, setDayDiet, setDayMeals, addDishToMeal, removeDishFromMeal,
    setPortion, setStatus, setReplacement, setExternal,
  } = useMenuStore();
  const { dishes, addDish } = useDishStore();
  const slots = useConfigStore((s) => s.slots);
  const portionOptions = useConfigStore((s) => s.portionOptions);

  const [busyDay, setBusyDay] = useState<WeekDay | null>(null);
  const [confirm, setConfirm] = useState<{ day: WeekDay; diet: DietType } | null>(null);
  const [addTarget, setAddTarget] = useState<{ day: WeekDay; slot: MealSlot } | null>(null);
  const [addValue, setAddValue] = useState('');
  const [replaceTarget, setReplaceTarget] = useState<{ day: WeekDay; slotId: string; id: string } | null>(null);
  const [replaceValue, setReplaceValue] = useState('');
  const [extTarget, setExtTarget] = useState<{ day: WeekDay; slot: MealSlot; dish: MealPlanDish } | null>(null);

  const regenerateWeek = () => { setMenu(generateWeek(menu, dishes)); logActivity('Regenerated week', 'Full week re-planned from the dish bank'); };
  const regenerateDay = (day: WeekDay, diet: DietType) => { setDayMeals(day, generateOneDay(day, diet, dishes)); logActivity('Regenerated day', `${day} re-planned as ${diet}`); };

  const onDietChange = (day: WeekDay, diet: DietType) => {
    setDayDiet(day, diet);
    const dayPlan = menu.find((d) => d.day === day);
    const hasContent = dayPlan && Object.values(dayPlan.meals).some((m) => m.length > 0);
    if (hasContent) setConfirm({ day, diet });
    else regenerateDay(day, diet);
  };

  const aiFillDay = async (day: WeekDay, diet: DietType) => {
    setBusyDay(day);
    try {
      const result = await smartFillDay(day, diet, dishes);
      const usedNames = new Set<string>();
      const meals: DayMeals = {};
      for (const slot of slots) {
        const picks = (result[slot.category] ?? []).filter((p) => !usedNames.has(p.name.toLowerCase()));
        meals[slot.id] = picks
          .map((p) => dishes.find((d) => d.name.toLowerCase() === p.name.toLowerCase()))
          .filter((d): d is Dish => !!d)
          .map((d) => { usedNames.add(d.name.toLowerCase()); return dishToPlanInstance(d, day, slot.id); });
      }
      setDayMeals(day, meals);
      logActivity('AI smart-fill', `${day} planned by Claude`);
    } catch (e) {
      alert(`AI fill failed: ${e instanceof Error ? e.message : 'unknown error'}\nUsing the local generator instead.`);
      regenerateDay(day, diet);
    } finally {
      setBusyDay(null);
    }
  };

  const resolveDish = (name: string, category: Dish['type']): Dish => {
    const existing = dishes.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const created = addDish({ name, type: category, diet: isVegName(name) ? 'Veg' : 'Non-Veg', accompaniments: '', macros: { ...ZERO_MACROS }, ingredients: [], instructions: [] });
    logActivity('Added dish to bank', name);
    return created;
  };

  const submitAdd = () => {
    if (!addTarget || !addValue.trim()) return;
    const dish = resolveDish(addValue.trim(), addTarget.slot.category);
    addDishToMeal(addTarget.day, addTarget.slot.id, dishToPlanInstance(dish, addTarget.day, addTarget.slot.id));
    logActivity('Added to plan', `${dish.name} → ${addTarget.day} ${addTarget.slot.label}`);
    setAddTarget(null); setAddValue('');
  };

  const submitReplace = () => {
    if (!replaceTarget || !replaceValue.trim()) return;
    const slot = slots.find((s) => s.id === replaceTarget.slotId);
    const dish = resolveDish(replaceValue.trim(), slot?.category ?? 'Lunch');
    setReplacement(replaceTarget.day, replaceTarget.slotId, replaceTarget.id, dish.name, dish.macros);
    logActivity('Marked actual', `Had ${dish.name} instead (${replaceTarget.day})`);
    setReplaceTarget(null); setReplaceValue('');
  };

  const cycleSkip = (day: WeekDay, slotId: string, dish: MealPlanDish) => {
    const next = dish.status === 'skipped' ? 'planned' : 'skipped';
    setStatus(day, slotId, dish.id, next);
    logActivity('Marked actual', `${dish.name} ${next === 'skipped' ? 'skipped' : 'as planned'} (${day})`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Your Week</h2>
          <p className="text-sm text-slate-500">Built only from your Dish Bank. Set portions, then mark what was actually eaten.</p>
        </div>
        <button onClick={regenerateWeek} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Regenerate Week
        </button>
      </div>

      <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse min-w-[980px]">
          <thead>
            <tr>
              <th className="p-2 text-left w-24 sticky left-0 bg-white z-10" />
              {menu.map((d) => (
                <th key={d.day} className="p-2 align-top min-w-[160px]">
                  <div className="font-display font-semibold text-slate-700 text-sm">{d.day}</div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <select value={d.diet} onChange={(e) => onDietChange(d.day, e.target.value as DietType)}
                      className={cn('flex-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded border bg-white', d.diet === 'Veg' ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200')}>
                      <option value="Veg">Veg</option>
                      <option value="Non-Veg">Non-Veg</option>
                    </select>
                    <button title="AI smart-fill this day" onClick={() => aiFillDay(d.day, d.diet)} disabled={busyDay === d.day}
                      className="p-1.5 rounded border border-slate-200 text-violet-600 hover:bg-violet-50 disabled:opacity-50">
                      <Sparkles className={cn('w-3.5 h-3.5', busyDay === d.day && 'animate-pulse')} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id} className="align-top">
                <td className="p-2 sticky left-0 bg-white z-10">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">{slot.label}</span>
                </td>
                {menu.map((d) => {
                  const list = d.meals[slot.id] ?? [];
                  const people = peopleForSlot(slot.id, d.day);
                  const kidsIncluded = people.length > 2;
                  return (
                    <td key={`${d.day}-${slot.id}`} className="p-1.5 border-l border-slate-100 group">
                      <div className="flex flex-col gap-1.5">
                        {list.map((dish) => (
                          <PlanChip key={dish.id} dish={dish} portionListId="portion-suggestions"
                            onRemove={() => { removeDishFromMeal(d.day, slot.id, dish.id); logActivity('Removed from plan', `${dish.name} (${d.day} ${slot.label})`); }}
                            onPortion={(p) => setPortion(d.day, slot.id, dish.id, p)}
                            onToggleSkip={() => cycleSkip(d.day, slot.id, dish)}
                            onReplace={() => { setReplaceTarget({ day: d.day, slotId: slot.id, id: dish.id }); setReplaceValue(''); }}
                            onExternal={() => setExtTarget({ day: d.day, slot, dish })}
                          />
                        ))}
                        <div className="flex items-center justify-between">
                          <button onClick={() => { setAddTarget({ day: d.day, slot }); setAddValue(''); }} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 hover:text-emerald-600">
                            <Plus className="w-3 h-3" /> Add
                          </button>
                          <span className={cn('flex items-center gap-0.5 text-[10px]', kidsIncluded ? 'text-amber-600' : 'text-slate-300')} title={people.join(', ')}>
                            <Users className="w-3 h-3" />{people.length}
                          </span>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <datalist id="portion-suggestions">{portionOptions.map((p) => <option key={p} value={p} />)}</datalist>

      {confirm && (
        <Modal onClose={() => setConfirm(null)} title={`${confirm.day} is now ${confirm.diet}`}>
          <p className="text-sm text-slate-600">Regenerate the menu for {confirm.day} only, using {confirm.diet} dishes from your bank?</p>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setConfirm(null)} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Keep current</button>
            <button onClick={() => { regenerateDay(confirm.day, confirm.diet); setConfirm(null); }} className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Regenerate {confirm.day}</button>
          </div>
        </Modal>
      )}

      {addTarget && (
        <Modal onClose={() => setAddTarget(null)} title={`Add to ${addTarget.day} · ${addTarget.slot.label}`}>
          <DishNameInput value={addValue} onChange={setAddValue} onEnter={submitAdd} dishes={dishes} placeholder="Type to search the bank, or a new dish…" />
          <p className="text-[11px] text-slate-400 mt-2">If it’s not in the bank, it’s added automatically.</p>
          <ModalActions onCancel={() => setAddTarget(null)} onConfirm={submitAdd} disabled={!addValue.trim()} confirmLabel="Add" />
        </Modal>
      )}

      {replaceTarget && (
        <Modal onClose={() => setReplaceTarget(null)} title="Had something else?">
          <p className="text-sm text-slate-600 mb-3">Record what was actually eaten. A new dish is saved to your bank.</p>
          <DishNameInput value={replaceValue} onChange={setReplaceValue} onEnter={submitReplace} dishes={dishes} placeholder="What did you have instead?" />
          <ModalActions onCancel={() => setReplaceTarget(null)} onConfirm={submitReplace} disabled={!replaceValue.trim()} confirmLabel="Save actual" />
        </Modal>
      )}

      {extTarget && (
        <ExternalModal
          target={extTarget}
          onClose={() => setExtTarget(null)}
          onSave={(kind, name, macros) => {
            setExternal(extTarget.day, extTarget.slot.id, extTarget.dish.id, kind, name, macros);
            logActivity('Marked actual', `${kind === 'ordered' ? 'Ordered' : 'Ate out'}: ${name} (${extTarget.day} ${extTarget.slot.label})`);
            setExtTarget(null);
          }}
        />
      )}
    </div>
  );
}

function PlanChip({ dish, portionListId, onRemove, onPortion, onToggleSkip, onReplace, onExternal }: {
  dish: MealPlanDish; portionListId: string;
  onRemove: () => void; onPortion: (p: string) => void; onToggleSkip: () => void; onReplace: () => void; onExternal: () => void;
}) {
  const veg = dish.diet ? dish.diet === 'Veg' : isVegName(dish.name);
  const skipped = dish.status === 'skipped';
  const external = dish.status === 'ordered' || dish.status === 'outside';
  const replaced = dish.status === 'replaced';
  return (
    <div className={cn('rounded-lg border p-1.5 text-xs relative', veg ? 'bg-[var(--veg)] border-[var(--veg-border)]' : 'bg-[var(--nonveg)] border-[var(--nonveg-border)]', skipped && 'opacity-50')}>
      <div className="flex items-start gap-1.5">
        <button onClick={onToggleSkip} title={skipped ? 'Skipped — click to restore' : 'Eaten as planned — click to skip'}
          className={cn('mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0', skipped ? 'bg-white border-slate-300' : 'bg-emerald-500 border-emerald-500')}>
          {skipped ? <Ban className="w-2.5 h-2.5 text-slate-400" /> : <Check className="w-2.5 h-2.5 text-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn('font-medium text-slate-800 leading-tight', skipped && 'line-through')}>{dish.name}</div>
          {dish.accompaniments && <div className="text-[10px] text-slate-500 italic leading-tight">w/ {dish.accompaniments}</div>}
          {replaced && dish.actualName && <div className="text-[10px] text-amber-600 leading-tight">→ had: {dish.actualName}</div>}
          {external && dish.actualName && <div className="text-[10px] text-sky-600 leading-tight">→ {dish.status === 'ordered' ? 'ordered' : 'ate out'}: {dish.actualName}</div>}
          <input list={portionListId} value={dish.portion ?? ''} onChange={(e) => onPortion(e.target.value)} placeholder="+ portion"
            className="mt-1 w-full bg-white/70 border border-white rounded px-1 py-0.5 text-[10px] text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={onReplace} title="Had something else" className="text-slate-300 hover:text-amber-500"><Replace className="w-3 h-3" /></button>
          <button onClick={onExternal} title="Ordered in / ate outside" className="text-slate-300 hover:text-sky-500"><Store className="w-3 h-3" /></button>
          <button onClick={onRemove} title="Remove" className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
}

function ExternalModal({ target, onClose, onSave }: {
  target: { day: WeekDay; slot: MealSlot; dish: MealPlanDish };
  onClose: () => void;
  onSave: (kind: 'ordered' | 'outside', name: string, macros?: Macros) => void;
}) {
  const [kind, setKind] = useState<'ordered' | 'outside'>('ordered');
  const [name, setName] = useState('');
  const [macros, setMacros] = useState<Macros>({ ...ZERO_MACROS });
  const [busy, setBusy] = useState(false);
  const has = Object.values(macros).some((v) => v > 0);

  const estimate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await generateDishByName({ name: name.trim(), diet: target.dish.diet, type: target.slot.category });
      setMacros(r.macros);
    } catch (e) {
      alert(`Couldn't estimate: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title={`Ordered / ate out · ${target.day} ${target.slot.label}`}>
      <div className="flex bg-slate-100 rounded-lg p-1 mb-3">
        {(['ordered', 'outside'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn('flex-1 py-1.5 text-sm font-medium rounded-md', kind === k ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500')}>
            {k === 'ordered' ? 'Ordered in' : 'Ate outside'}
          </button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What did you have? e.g. Veg Biryani" autoFocus
        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
      <div className="grid grid-cols-4 gap-2 mt-3">
        {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="text-center">
            <span className="block text-[10px] uppercase text-slate-400">{k === 'calories' ? 'Kcal' : k.slice(0, 4)}</span>
            <input type="number" min={0} value={macros[k] || ''} onChange={(e) => setMacros((m) => ({ ...m, [k]: Number(e.target.value) || 0 }))}
              className="w-full px-1 py-1 border border-slate-200 rounded text-sm text-center" />
          </label>
        ))}
      </div>
      <button onClick={estimate} disabled={busy || !name.trim()} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:text-violet-800 disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Estimate calories with Claude
      </button>
      <p className="text-[11px] text-slate-400 mt-2">Optional — leave macros at 0 if unknown (counts as 0 in the tracker).</p>
      <ModalActions onCancel={onClose} onConfirm={() => onSave(kind, name.trim() || (kind === 'ordered' ? 'Ordered in' : 'Ate outside'), has ? macros : undefined)} disabled={false} confirmLabel="Save" />
    </Modal>
  );
}

function DishNameInput({ value, onChange, onEnter, dishes, placeholder }: { value: string; onChange: (v: string) => void; onEnter: () => void; dishes: Dish[]; placeholder: string }) {
  return (
    <>
      <input list="bank-dish-names" autoFocus value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter()} placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
      <datalist id="bank-dish-names">{dishes.map((d) => <option key={d.id} value={d.name} />)}</datalist>
    </>
  );
}

function ModalActions({ onCancel, onConfirm, disabled, confirmLabel }: { onCancel: () => void; onConfirm: () => void; disabled: boolean; confirmLabel: string }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onCancel} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
      <button onClick={onConfirm} disabled={disabled} className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">{confirmLabel}</button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
