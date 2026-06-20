'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useConfigStore, logActivity } from '@/lib/stores/meal';
import { MEAL_TYPES, PEOPLE, type MealType, type Person } from '@/types';
import { cn } from '@/lib/utils';

export default function Settings() {
  const {
    slots, portionOptions, peopleBySlot,
    addSlot, removeSlot, renameSlot, setSlotCategory, moveSlot, setPortionOptions, setSlotPeople, resetConfig,
  } = useConfigStore();

  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<MealType>('Snack');
  const [portionText, setPortionText] = useState(portionOptions.join(', '));

  const addNewSlot = () => {
    if (!newLabel.trim()) return;
    addSlot(newLabel.trim(), newCategory);
    logActivity('Config', `Added meal "${newLabel.trim()}" (${newCategory})`);
    setNewLabel('');
  };

  const savePortions = () => {
    const opts = portionText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    setPortionOptions(opts);
    logActivity('Config', 'Updated portion options');
  };

  const togglePerson = (slotId: string, scope: 'weekday' | 'weekend', person: Person) => {
    const current = peopleBySlot[slotId]?.[scope] ?? [];
    const next = current.includes(person) ? current.filter((p) => p !== person) : [...current, person];
    setSlotPeople(slotId, scope, next);
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Configurator</h2>
          <p className="text-sm text-slate-500">Customise meals, who eats each one, and portion options.</p>
        </div>
      </div>

      {/* Meal slots */}
      <section className="space-y-3">
        <h3 className="font-display font-semibold text-slate-800">Meals of the day</h3>
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <div key={slot.id} className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <input value={slot.label} onChange={(e) => renameSlot(slot.id, e.target.value)} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-medium" />
                <select value={slot.category} onChange={(e) => setSlotCategory(slot.id, e.target.value as MealType)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm" title="Dish pool & planning rule">
                  {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => moveSlot(slot.id, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => moveSlot(slot.id, 1)} disabled={i === slots.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm(`Remove "${slot.label}"? Its planned items will be cleared.`)) { removeSlot(slot.id); logActivity('Config', `Removed meal "${slot.label}"`); } }} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              {/* People per slot */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(['weekday', 'weekend'] as const).map((scope) => (
                  <div key={scope}>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-1">{scope}</div>
                    <div className="flex flex-wrap gap-1">
                      {PEOPLE.map((person) => {
                        const on = (peopleBySlot[slot.id]?.[scope] ?? []).includes(person);
                        return (
                          <button key={person} onClick={() => togglePerson(slot.id, scope, person)}
                            className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border', on ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-400 border-slate-200')}>
                            {person}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">New meal name</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Evening Tea" className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Based on</label>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as MealType)} className="block mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
              {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={addNewSlot} disabled={!newLabel.trim()} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add meal
          </button>
        </div>
      </section>

      {/* Portion options */}
      <section className="space-y-3">
        <h3 className="font-display font-semibold text-slate-800">Portion options</h3>
        <p className="text-sm text-slate-500">Comma-separated suggestions shown when setting a portion in the planner.</p>
        <textarea value={portionText} onChange={(e) => setPortionText(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
        <button onClick={savePortions} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium">Save portions</button>
      </section>

      <section>
        <button onClick={() => { if (confirm('Reset all configurator settings to defaults?')) { resetConfig(); setPortionText(useConfigStore.getState().portionOptions.join(', ')); logActivity('Config', 'Reset configurator to defaults'); } }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500">
          <RotateCcw className="w-4 h-4" /> Reset configurator to defaults
        </button>
      </section>
    </div>
  );
}
