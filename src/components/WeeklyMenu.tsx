'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RefreshCw, Plus, Trash2, Check, Sparkles, X, Users, Replace, Store, Loader2, Ban, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  useMenuStore, useDishStore, useConfigStore, dishToPlanInstance, peopleForSlot, logActivity, dayOrSkeleton,
} from '@/lib/stores/meal';
import { generateWeek, generateOneDay, dayPersonMacros } from '@/lib/meal-logic';
import { smartFillDay, generateDishByName } from '@/lib/ai';
import { cn, isVegName } from '@/lib/utils';
import {
  type DietType, type Dish, type DailyMenu, type MealPlanDish, type MealSlot, type DayMeals, type Macros, type Person, ZERO_MACROS,
} from '@/types';
import { weekDatesFrom, shiftWeek, weekStartSunday, todayISO, formatDayLabel, formatDayShort, formatDayNum, dayBadge, isTodayISO } from '@/lib/date';

export default function WeeklyMenu() {
  const byDate = useMenuStore((s) => s.byDate);
  const weekStart = useMenuStore((s) => s.weekStart);
  const setWeekStart = useMenuStore((s) => s.setWeekStart);
  const setMenuForDates = useMenuStore((s) => s.setMenuForDates);
  const setDayDiet = useMenuStore((s) => s.setDayDiet);
  const setDayMeals = useMenuStore((s) => s.setDayMeals);
  const addDishToMeals = useMenuStore((s) => s.addDishToMeals);
  const removeDishFromMeal = useMenuStore((s) => s.removeDishFromMeal);
  const setPortion = useMenuStore((s) => s.setPortion);
  const setStatus = useMenuStore((s) => s.setStatus);
  const setReplacement = useMenuStore((s) => s.setReplacement);
  const setExternal = useMenuStore((s) => s.setExternal);
  const { dishes, addDish } = useDishStore();
  const slots = useConfigStore((s) => s.slots);
  const portionOptions = useConfigStore((s) => s.portionOptions);

  const weekDates = weekDatesFrom(weekStart);

  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ date: string; diet: DietType } | null>(null);
  const [addTarget, setAddTarget] = useState<{ date: string } | null>(null);
  const [addValue, setAddValue] = useState('');
  const [addSlots, setAddSlots] = useState<Set<string>>(new Set());
  const [replaceTarget, setReplaceTarget] = useState<{ date: string; slotId: string; id: string } | null>(null);
  const [replaceValue, setReplaceValue] = useState('');
  const [extTarget, setExtTarget] = useState<{ date: string; slot: MealSlot; dish: MealPlanDish } | null>(null);

  const [mobileFocus, setMobileFocus] = useState(() => (weekDates.includes(todayISO()) ? todayISO() : weekDates[0]));
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    dayRefs.current[mobileFocus]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [mobileFocus]);

  const goWeek = (dir: -1 | 1) => {
    const newStart = shiftWeek(weekStart, dir);
    setWeekStart(newStart);
    const nd = weekDatesFrom(newStart);
    setMobileFocus(nd.includes(todayISO()) ? todayISO() : nd[0]);
  };
  const jumpToThisWeek = () => { const ws = weekStartSunday(todayISO()); setWeekStart(ws); setMobileFocus(todayISO()); };
  const mobilePrev = () => {
    const i = weekDates.indexOf(mobileFocus);
    if (i > 0) { setMobileFocus(weekDates[i - 1]); return; }
    const newStart = shiftWeek(weekStart, -1);
    setWeekStart(newStart);
    setMobileFocus(weekDatesFrom(newStart)[6]);
  };
  const mobileNext = () => {
    const i = weekDates.indexOf(mobileFocus);
    if (i < weekDates.length - 1) { setMobileFocus(weekDates[i + 1]); return; }
    const newStart = shiftWeek(weekStart, 1);
    setWeekStart(newStart);
    setMobileFocus(weekDatesFrom(newStart)[0]);
  };

  const regenerateWeek = () => {
    setMenuForDates(generateWeek(weekDates.map((d) => dayOrSkeleton(byDate, d)), dishes));
    logActivity('Regenerated week', `${formatDayNum(weekDates[0])} – ${formatDayNum(weekDates[6])} re-planned from the dish bank`);
  };
  const regenerateDay = (date: string, diet: DietType) => {
    setDayMeals(date, generateOneDay(date, diet, dishes));
    logActivity('Regenerated day', `${formatDayLabel(date)} re-planned as ${diet}`);
  };

  const onDietChange = (date: string, diet: DietType) => {
    setDayDiet(date, diet);
    const dayPlan = dayOrSkeleton(byDate, date);
    const hasContent = Object.values(dayPlan.meals).some((m) => m.length > 0);
    if (hasContent) setConfirm({ date, diet });
    else regenerateDay(date, diet);
  };

  const aiFillDay = async (date: string, diet: DietType) => {
    setBusyDate(date);
    try {
      const result = await smartFillDay(formatDayLabel(date), diet, dishes);
      const usedNames = new Set<string>();
      const meals: DayMeals = {};
      for (const slot of slots) {
        const picks = (result[slot.category] ?? []).filter((p) => !usedNames.has(p.name.toLowerCase()));
        meals[slot.id] = picks
          .map((p) => dishes.find((d) => d.name.toLowerCase() === p.name.toLowerCase()))
          .filter((d): d is Dish => !!d)
          .map((d) => { usedNames.add(d.name.toLowerCase()); return dishToPlanInstance(d, date, slot.id); });
      }
      setDayMeals(date, meals);
      logActivity('AI smart-fill', `${formatDayLabel(date)} planned by Claude`);
    } catch (e) {
      alert(`AI fill failed: ${e instanceof Error ? e.message : 'unknown error'}\nUsing the local generator instead.`);
      regenerateDay(date, diet);
    } finally {
      setBusyDate(null);
    }
  };

  const resolveDish = (name: string, category: Dish['type']): Dish => {
    const existing = dishes.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const created = addDish({ name, type: category, diet: isVegName(name) ? 'Veg' : 'Non-Veg', accompaniments: '', macros: { ...ZERO_MACROS }, ingredients: [], instructions: [] });
    logActivity('Added dish to bank', name);
    return created;
  };

  const openAdd = (date: string, slotId: string) => { setAddTarget({ date }); setAddValue(''); setAddSlots(new Set([slotId])); };
  const toggleAddSlot = (id: string) => setAddSlots((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submitAdd = () => {
    if (!addTarget || !addValue.trim() || addSlots.size === 0) return;
    const slotIds = Array.from(addSlots);
    const firstSlot = slots.find((s) => slotIds.includes(s.id));
    const dish = resolveDish(addValue.trim(), firstSlot?.category ?? 'Lunch');
    addDishToMeals(addTarget.date, slotIds, dish);
    const slotLabels = slots.filter((s) => slotIds.includes(s.id)).map((s) => s.label).join(', ');
    logActivity('Added to plan', `${dish.name} → ${formatDayLabel(addTarget.date)} (${slotLabels})`);
    setAddTarget(null); setAddValue(''); setAddSlots(new Set());
  };

  const openReplace = (date: string, slotId: string, id: string) => { setReplaceTarget({ date, slotId, id }); setReplaceValue(''); };
  const submitReplace = () => {
    if (!replaceTarget || !replaceValue.trim()) return;
    const slot = slots.find((s) => s.id === replaceTarget.slotId);
    const dish = resolveDish(replaceValue.trim(), slot?.category ?? 'Lunch');
    setReplacement(replaceTarget.date, replaceTarget.slotId, replaceTarget.id, dish.name, dish.macros);
    logActivity('Marked actual', `Had ${dish.name} instead (${formatDayLabel(replaceTarget.date)})`);
    setReplaceTarget(null); setReplaceValue('');
  };

  const cycleSkip = (date: string, slotId: string, dish: MealPlanDish) => {
    const next = dish.status === 'skipped' ? 'planned' : 'skipped';
    setStatus(date, slotId, dish.id, next);
    logActivity('Marked actual', `${dish.name} ${next === 'skipped' ? 'skipped' : 'as planned'} (${formatDayLabel(date)})`);
  };

  const removeFromPlan = (date: string, slotId: string, dish: MealPlanDish) => {
    removeDishFromMeal(date, slotId, dish.id);
    logActivity('Removed from plan', `${dish.name} (${formatDayLabel(date)} ${slots.find((s) => s.id === slotId)?.label})`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Your Week</h2>
          <p className="text-sm text-slate-500">Built only from your Dish Bank. Set portions, then mark what was actually eaten.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1">
            <button onClick={() => goWeek(-1)} aria-label="Previous week" className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center px-2 min-w-[140px]">
              <div className="text-sm font-semibold text-slate-700">{formatDayNum(weekDates[0])} – {formatDayNum(weekDates[6])}</div>
              <button onClick={jumpToThisWeek} className="text-[11px] text-emerald-600 hover:underline">Jump to this week</button>
            </div>
            <button onClick={() => goWeek(1)} aria-label="Next week" className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={regenerateWeek} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors min-h-12">
            <RefreshCw className="w-4 h-4" /> Regenerate Week
          </button>
        </div>
      </div>

      {/* Desktop — full week, card grid, no horizontal scroll (#7) */}
      <div className="hidden lg:grid grid-cols-7 gap-3">
        {weekDates.map((date) => (
          <DayCard key={date} date={date} day={dayOrSkeleton(byDate, date)} slots={slots} mobile={false} busy={busyDate === date}
            onDietChange={(diet) => onDietChange(date, diet)}
            onAiFill={() => aiFillDay(date, dayOrSkeleton(byDate, date).diet)}
            onAddTarget={(slotId) => openAdd(date, slotId)}
            onRemove={(slotId, dish) => removeFromPlan(date, slotId, dish)}
            onPortion={(slotId, id, p) => setPortion(date, slotId, id, p)}
            onToggleSkip={(slotId, dish) => cycleSkip(date, slotId, dish)}
            onReplace={(slotId, id) => openReplace(date, slotId, id)}
            onExternal={(slot, dish) => setExtTarget({ date, slot, dish })}
          />
        ))}
      </div>

      {/* Mobile — one day at a time with yesterday/tomorrow peeking in (#8) */}
      <div className="lg:hidden space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button onClick={mobilePrev} aria-label="Previous day" className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="font-display font-semibold text-slate-800 text-sm">{formatDayLabel(mobileFocus)}</div>
            {dayBadge(mobileFocus) && <div className="text-[11px] font-semibold uppercase text-emerald-600">{dayBadge(mobileFocus)}</div>}
          </div>
          <button onClick={mobileNext} aria-label="Next day" className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 flex-shrink-0">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-[12%] pb-2 no-scrollbar">
          {weekDates.map((date) => (
            <div key={date} ref={(el) => { dayRefs.current[date] = el; }} className="w-[76%] sm:w-[55%] shrink-0 snap-center">
              <DayCard date={date} day={dayOrSkeleton(byDate, date)} slots={slots} mobile busy={busyDate === date}
                onDietChange={(diet) => onDietChange(date, diet)}
                onAiFill={() => aiFillDay(date, dayOrSkeleton(byDate, date).diet)}
                onAddTarget={(slotId) => openAdd(date, slotId)}
                onRemove={(slotId, dish) => removeFromPlan(date, slotId, dish)}
                onPortion={(slotId, id, p) => setPortion(date, slotId, id, p)}
                onToggleSkip={(slotId, dish) => cycleSkip(date, slotId, dish)}
                onReplace={(slotId, id) => openReplace(date, slotId, id)}
                onExternal={(slot, dish) => setExtTarget({ date, slot, dish })}
              />
            </div>
          ))}
        </div>
        <div className="text-center">
          <button onClick={jumpToThisWeek} className="text-[11px] text-emerald-600 hover:underline">Jump to this week</button>
        </div>
      </div>

      <datalist id="portion-suggestions">{portionOptions.map((p) => <option key={p} value={p} />)}</datalist>

      {confirm && (
        <Modal onClose={() => setConfirm(null)} title={`${formatDayLabel(confirm.date)} is now ${confirm.diet}`}>
          <p className="text-sm text-slate-600">Regenerate the menu for this day only, using {confirm.diet} dishes from your bank?</p>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setConfirm(null)} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Keep current</button>
            <button onClick={() => { regenerateDay(confirm.date, confirm.diet); setConfirm(null); }} className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Regenerate</button>
          </div>
        </Modal>
      )}

      {addTarget && (
        <Modal onClose={() => setAddTarget(null)} title={`Add to ${formatDayLabel(addTarget.date)}`}>
          <DishNameInput value={addValue} onChange={setAddValue} onEnter={submitAdd} dishes={dishes} placeholder="Type to search the bank, or a new dish…" />
          <p className="text-[11px] text-slate-400 mt-2 mb-1">If it’s not in the bank, it’s added automatically.</p>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add to which meals? (#4 — pick one or more)</span>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            {slots.map((slot) => {
              const checked = addSlots.has(slot.id);
              return (
                <label key={slot.id} className={cn('flex items-center gap-2 px-2.5 rounded-lg border text-sm cursor-pointer min-h-12',
                  checked ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600')}>
                  <input type="checkbox" checked={checked} onChange={() => toggleAddSlot(slot.id)} className="w-4 h-4 accent-emerald-600" />
                  {slot.label}
                </label>
              );
            })}
          </div>
          <ModalActions onCancel={() => setAddTarget(null)} onConfirm={submitAdd} disabled={!addValue.trim() || addSlots.size === 0} confirmLabel={addSlots.size > 1 ? `Add to ${addSlots.size} meals` : 'Add'} />
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
            setExternal(extTarget.date, extTarget.slot.id, extTarget.dish.id, kind, name, macros);
            logActivity('Marked actual', `${kind === 'ordered' ? 'Ordered' : 'Ate out'}: ${name} (${formatDayLabel(extTarget.date)} ${extTarget.slot.label})`);
            setExtTarget(null);
          }}
        />
      )}
    </div>
  );
}

function DayCard({ date, day, slots, mobile, busy, onDietChange, onAiFill, onAddTarget, onRemove, onPortion, onToggleSkip, onReplace, onExternal }: {
  date: string; day: DailyMenu; slots: MealSlot[]; mobile: boolean; busy: boolean;
  onDietChange: (diet: DietType) => void; onAiFill: () => void; onAddTarget: (slotId: string) => void;
  onRemove: (slotId: string, dish: MealPlanDish) => void; onPortion: (slotId: string, id: string, p: string) => void;
  onToggleSkip: (slotId: string, dish: MealPlanDish) => void; onReplace: (slotId: string, id: string) => void;
  onExternal: (slot: MealSlot, dish: MealPlanDish) => void;
}) {
  const badge = dayBadge(date);
  const today = isTodayISO(date);
  const personTotals = dayPersonMacros(day);
  const people = Object.keys(personTotals) as Person[];

  return (
    <div className={cn('rounded-2xl border bg-white flex flex-col gap-3 min-w-0', mobile ? 'p-4' : 'p-3', today ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200')}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-semibold text-slate-800 text-sm truncate">{mobile ? formatDayLabel(date) : formatDayShort(date)}</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            {!mobile && <span>{formatDayNum(date)}</span>}
            {badge && <span className="font-semibold uppercase text-emerald-600">{badge}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <select value={day.diet} onChange={(e) => onDietChange(e.target.value as DietType)}
            className={cn('text-[11px] font-semibold uppercase tracking-wide px-2 rounded border bg-white', mobile ? 'min-h-12 py-2' : 'py-1', day.diet === 'Veg' ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200')}>
            <option value="Veg">Veg</option>
            <option value="Non-Veg">Non-Veg</option>
          </select>
          <button title="AI smart-fill this day" onClick={onAiFill} disabled={busy}
            className={cn('rounded border border-slate-200 text-violet-600 hover:bg-violet-50 disabled:opacity-50 flex items-center justify-center flex-shrink-0', mobile ? 'w-12 h-12' : 'p-1.5')}>
            <Sparkles className={cn(mobile ? 'w-4 h-4' : 'w-3.5 h-3.5', busy && 'animate-pulse')} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {slots.map((slot) => {
          const list = day.meals[slot.id] ?? [];
          const slotPeople = peopleForSlot(slot.id, date);
          return (
            <div key={slot.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{slot.label}</span>
                <span className={cn('flex items-center gap-0.5 text-[10px]', slotPeople.length > 2 ? 'text-amber-600' : 'text-slate-300')} title={slotPeople.join(', ')}>
                  <Users className="w-3 h-3" />{slotPeople.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {list.map((dish) => (
                  <PlanChip key={dish.id} dish={dish} large={mobile} portionListId="portion-suggestions"
                    onRemove={() => onRemove(slot.id, dish)}
                    onPortion={(p) => onPortion(slot.id, dish.id, p)}
                    onToggleSkip={() => onToggleSkip(slot.id, dish)}
                    onReplace={() => onReplace(slot.id, dish.id)}
                    onExternal={() => onExternal(slot, dish)}
                  />
                ))}
                <button onClick={() => onAddTarget(slot.id)}
                  className={cn('flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-dashed border-slate-200',
                    mobile ? 'min-h-12 py-2' : 'py-1.5')}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {people.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
          {people.map((p) => {
            const m = personTotals[p] as Macros;
            return (
              <div key={p} className="text-[10px] bg-slate-50 rounded-lg px-2 py-1.5">
                <span className="font-semibold text-slate-700">{p}</span>
                <div className="text-slate-500 tabular-nums leading-snug">{Math.round(m.calories)} kcal · {Math.round(m.protein)}P · {Math.round(m.carbs)}C · {Math.round(m.fat)}F</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanChip({ dish, large, portionListId, onRemove, onPortion, onToggleSkip, onReplace, onExternal }: {
  dish: MealPlanDish; large?: boolean; portionListId: string;
  onRemove: () => void; onPortion: (p: string) => void; onToggleSkip: () => void; onReplace: () => void; onExternal: () => void;
}) {
  const veg = dish.diet ? dish.diet === 'Veg' : isVegName(dish.name);
  const skipped = dish.status === 'skipped';
  const external = dish.status === 'ordered' || dish.status === 'outside';
  const replaced = dish.status === 'replaced';
  return (
    <div className={cn('group rounded-lg border text-xs relative', large ? 'p-2.5' : 'p-1.5', veg ? 'bg-[var(--veg)] border-[var(--veg-border)]' : 'bg-[var(--nonveg)] border-[var(--nonveg-border)]', skipped && 'opacity-50')}>
      <div className="flex items-start gap-2">
        <button onClick={onToggleSkip} title={skipped ? 'Skipped — tap to restore' : 'Eaten as planned — tap to skip'}
          className={cn('rounded border flex items-center justify-center flex-shrink-0', large ? 'w-12 h-12' : 'w-3.5 h-3.5 mt-0.5', skipped ? 'bg-white border-slate-300' : 'bg-emerald-500 border-emerald-500')}>
          {skipped ? <Ban className={large ? 'w-5 h-5 text-slate-400' : 'w-2.5 h-2.5 text-slate-400'} /> : <Check className={large ? 'w-5 h-5 text-white' : 'w-2.5 h-2.5 text-white'} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn('font-medium text-slate-800 leading-tight flex items-center gap-1', large && 'text-sm', skipped && 'line-through')}>
            <span className="truncate">{dish.name}</span>
            {dish.isDessert && <span title="Dessert" className="flex-shrink-0">🍰</span>}
          </div>
          {dish.accompaniments && <div className="text-[10px] text-slate-500 italic leading-tight">w/ {dish.accompaniments}</div>}
          {replaced && dish.actualName && <div className="text-[10px] text-amber-600 leading-tight">→ had: {dish.actualName}</div>}
          {external && dish.actualName && <div className="text-[10px] text-sky-600 leading-tight">→ {dish.status === 'ordered' ? 'ordered' : 'ate out'}: {dish.actualName}</div>}
          <input list={portionListId} value={dish.portion ?? ''} onChange={(e) => onPortion(e.target.value)} placeholder="+ portion"
            className={cn('mt-1 w-full bg-white/70 border border-white rounded px-1.5 text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-400', large ? 'min-h-12 text-xs' : 'py-0.5 text-[10px]')} />
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onReplace} title="Had something else" className={cn('flex items-center justify-center text-slate-400 hover:text-amber-500', large ? 'w-12 h-12' : 'w-3 h-3')}>
            <Replace className={large ? 'w-4 h-4' : 'w-3 h-3'} />
          </button>
          <button onClick={onExternal} title="Ordered in / ate outside" className={cn('flex items-center justify-center text-slate-400 hover:text-sky-500', large ? 'w-12 h-12' : 'w-3 h-3')}>
            <Store className={large ? 'w-4 h-4' : 'w-3 h-3'} />
          </button>
          <button onClick={onRemove} title="Remove" className={cn('flex items-center justify-center text-slate-400 hover:text-red-500', large ? 'w-12 h-12' : 'w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity')}>
            <Trash2 className={large ? 'w-4 h-4' : 'w-3 h-3'} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExternalModal({ target, onClose, onSave }: {
  target: { date: string; slot: MealSlot; dish: MealPlanDish };
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
    <Modal onClose={onClose} title={`Ordered / ate out · ${formatDayLabel(target.date)} ${target.slot.label}`}>
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
      <button onClick={onCancel} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg min-h-12">Cancel</button>
      <button onClick={onConfirm} disabled={disabled} className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 min-h-12">{confirmLabel}</button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
