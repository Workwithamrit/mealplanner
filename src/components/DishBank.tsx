'use client';

import { useMemo, useState } from 'react';
import {
  Plus, Trash2, Pencil, Check, X, Link2, Loader2, Sparkles, Lightbulb, Youtube, Leaf,
} from 'lucide-react';
import { useDishStore, logActivity } from '@/lib/stores/meal';
import { buildRecommendations } from '@/lib/meal-logic';
import { parseLink, generateDishByName } from '@/lib/ai';
import { SEED_DISHES } from '@/lib/seed-dishes';
import { cn } from '@/lib/utils';
import { MEAL_TYPES, type Dish, type DietType, type MealType, ZERO_MACROS } from '@/types';

type DietFilter = 'All' | DietType;
type MealFilter = 'All' | MealType;

export default function DishBank() {
  const { dishes, addDish, updateDish, removeDish, resetTo } = useDishStore();

  const [filterDiet, setFilterDiet] = useState<DietFilter>('All');
  const [filterMeal, setFilterMeal] = useState<MealFilter>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const filtered = useMemo(
    () => dishes.filter((d) => (filterDiet === 'All' || d.diet === filterDiet) && (filterMeal === 'All' || d.type === filterMeal)),
    [dishes, filterDiet, filterMeal],
  );

  const recommendations = useMemo(() => buildRecommendations(dishes), [dishes]);

  // Logged wrappers so every bank change is attributed to the current user (#9).
  const addDishLogged: AddDishFn = (d) => {
    const created = addDish(d);
    logActivity('Added dish to bank', created.name);
    return created;
  };
  const updateDishLogged = (id: string, u: Partial<Dish>) => {
    updateDish(id, u);
    logActivity('Edited dish', u.name ?? dishes.find((x) => x.id === id)?.name ?? id);
  };
  const removeDishLogged = (id: string) => {
    logActivity('Removed dish', dishes.find((x) => x.id === id)?.name ?? id);
    removeDish(id);
  };

  const acceptRecommendation = (r: ReturnType<typeof buildRecommendations>[number]) => {
    addDishLogged({
      name: r.name, type: r.meal, diet: r.diet, accompaniments: r.accompaniments,
      macros: { ...ZERO_MACROS }, ingredients: [], instructions: [],
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">Dish Bank</h2>
          <p className="text-sm text-slate-500">{dishes.length} dishes · the only source the planner draws from.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { if (confirm('Reset the dish bank to the SwYam defaults? Custom dishes will be lost.')) resetTo(SEED_DISHES); }}
            className="px-3 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
          >
            Reset
          </button>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium">
            <Plus className="w-4 h-4" /> Add Dish
          </button>
        </div>
      </div>

      {/* Recommendations (#8) */}
      {recommendations.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="font-display font-semibold text-amber-900 text-sm">Recommended for your bank</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((r) => (
              <div key={r.name} className="bg-white rounded-lg border border-amber-100 p-3 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-slate-800">{r.name}</span>
                  <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded', r.diet === 'Veg' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{r.diet}</span>
                </div>
                <span className="text-[11px] text-slate-500">{r.meal}{r.accompaniments && ` · w/ ${r.accompaniments}`}</span>
                <button
                  onClick={() => acceptRecommendation(r)}
                  className="mt-2 self-start flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <Plus className="w-3 h-3" /> Accept &amp; add to bank
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters (#9) */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <Filter label="Diet" value={filterDiet} onChange={(v) => setFilterDiet(v as DietFilter)} options={['All', 'Veg', 'Non-Veg']} />
        <Filter label="Meal" value={filterMeal} onChange={(v) => setFilterMeal(v as MealFilter)} options={['All', ...MEAL_TYPES]} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-12">No dishes match these filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => <DishCard key={d.id} dish={d} onUpdate={updateDishLogged} onRemove={removeDishLogged} />)}
        </div>
      )}

      {modalOpen && <AddDishModal onClose={() => setModalOpen(false)} onAdd={addDishLogged} />}
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function DishCard({ dish, onUpdate, onRemove }: { dish: Dish; onUpdate: (id: string, u: Partial<Dish>) => void; onRemove: (id: string) => void }) {
  const veg = dish.diet === 'Veg';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dish.name);
  const [acc, setAcc] = useState(dish.accompaniments);
  const [type, setType] = useState<MealType>(dish.type);
  const [diet, setDiet] = useState<DietType>(dish.diet);

  const save = () => {
    onUpdate(dish.id, {
      name: name.trim() || dish.name,
      accompaniments: acc.split(',').map((s) => s.trim()).filter(Boolean).join(', '),
      type,
      diet,
    });
    setEditing(false);
  };

  // Per-dish enrichment (#1): healthy low-oil recipe via Claude, or from a video.
  const [enrichBusy, setEnrichBusy] = useState<'recipe' | 'video' | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [enrichErr, setEnrichErr] = useState('');

  const applyRecipe = (r: { ingredients?: string[]; instructions?: string[]; macros?: Dish['macros']; accompaniments?: string; sourceUrl?: string }) => {
    onUpdate(dish.id, {
      ingredients: r.ingredients?.length ? r.ingredients : dish.ingredients,
      instructions: r.instructions?.length ? r.instructions : dish.instructions,
      macros: r.macros ?? dish.macros,
      accompaniments: dish.accompaniments || r.accompaniments || '',
      sourceUrl: r.sourceUrl || dish.sourceUrl,
    });
  };

  const genHealthy = async () => {
    setEnrichBusy('recipe'); setEnrichErr('');
    try { applyRecipe(await generateDishByName({ name: dish.name, diet: dish.diet, type: dish.type, accompaniments: dish.accompaniments })); }
    catch (e) { setEnrichErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setEnrichBusy(null); }
  };

  const fetchVideo = async () => {
    if (!videoUrl.trim()) return;
    setEnrichBusy('video'); setEnrichErr('');
    try { applyRecipe(await parseLink(videoUrl.trim())); setShowVideo(false); setVideoUrl(''); }
    catch (e) { setEnrichErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setEnrichBusy(null); }
  };

  return (
    <div className={cn('rounded-2xl border p-4 flex flex-col shadow-sm', veg ? 'bg-[var(--veg)] border-[var(--veg-border)]' : 'bg-[var(--nonveg)] border-[var(--nonveg-border)]')}>
      {editing ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1 text-sm border rounded bg-white" placeholder="Dish name" />
          <input value={acc} onChange={(e) => setAcc(e.target.value)} className="w-full px-2 py-1 text-sm border rounded bg-white" placeholder="Accompaniments, comma separated" />
          <div className="flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as MealType)} className="flex-1 px-2 py-1 text-xs border rounded bg-white">
              {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={diet} onChange={(e) => setDiet(e.target.value as DietType)} className="flex-1 px-2 py-1 text-xs border rounded bg-white">
              <option value="Veg">Veg</option>
              <option value="Non-Veg">Non-Veg</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"><Check className="w-3 h-3" /> Save</button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded"><X className="w-3 h-3" /> Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-800 leading-tight">{dish.name}</h3>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-blue-500 p-0.5"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => onRemove(dish.id)} className="text-slate-400 hover:text-red-500 p-0.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] font-medium uppercase tracking-wide">
            <span className="bg-white/70 text-slate-600 px-2 py-0.5 rounded-full">{dish.type}</span>
            <span className={cn('px-2 py-0.5 rounded-full', veg ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{dish.diet}</span>
          </div>
          {dish.accompaniments && (
            <div className="text-xs text-slate-600 mt-2 flex flex-wrap gap-1">
              <span className="text-slate-400">w/</span>
              {dish.accompaniments.split(',').map((a, i) => <span key={i} className="bg-white/60 px-1.5 rounded border border-white">{a.trim()}</span>)}
            </div>
          )}
          <div className="grid grid-cols-4 gap-1.5 mt-3 mb-1 text-center">
            {([['Kcal', dish.macros.calories], ['Pro', `${dish.macros.protein}g`], ['Carb', `${dish.macros.carbs}g`], ['Fat', `${dish.macros.fat}g`]] as const).map(([k, v]) => (
              <div key={k} className="bg-white/60 rounded-lg p-1.5">
                <div className="text-[10px] text-slate-500">{k}</div>
                <div className="font-semibold text-slate-700 text-sm">{v}</div>
              </div>
            ))}
          </div>
          {(dish.ingredients.length > 0 || dish.instructions.length > 0 || dish.sourceUrl) && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">View recipe</summary>
              <div className="mt-2 pt-2 border-t border-white/60 space-y-2">
                {dish.ingredients.length > 0 && (
                  <div>
                    <strong className="text-[10px] uppercase text-slate-500">Ingredients</strong>
                    <ul className="list-disc pl-4 text-xs text-slate-700">{dish.ingredients.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
                {dish.instructions.length > 0 && (
                  <div>
                    <strong className="text-[10px] uppercase text-slate-500">Steps</strong>
                    <ol className="list-decimal pl-4 text-xs text-slate-700">{dish.instructions.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  </div>
                )}
                {dish.sourceUrl && <a href={dish.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"><Link2 className="w-3 h-3" /> Source</a>}
              </div>
            </details>
          )}

          {/* Enrich (#1): healthy low-oil recipe details, or attach a video */}
          <div className="mt-3 pt-2 border-t border-white/60">
            <div className="flex flex-wrap gap-2">
              <button onClick={genHealthy} disabled={!!enrichBusy} className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
                {enrichBusy === 'recipe' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Leaf className="w-3 h-3" />}
                {dish.instructions.length ? 'Refresh healthy recipe' : 'Add healthy recipe'}
              </button>
              <button onClick={() => setShowVideo((v) => !v)} disabled={!!enrichBusy} className="flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50">
                <Youtube className="w-3.5 h-3.5" /> From video
              </button>
            </div>
            {showVideo && (
              <div className="mt-2 flex gap-1.5">
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube/Shorts link" className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded bg-white" />
                <button onClick={fetchVideo} disabled={!videoUrl.trim() || !!enrichBusy} className="px-2 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded disabled:opacity-50">
                  {enrichBusy === 'video' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Fetch'}
                </button>
              </div>
            )}
            {enrichErr && <p className="text-[10px] text-red-600 mt-1">{enrichErr}</p>}
          </div>
        </>
      )}
    </div>
  );
}

type AddDishFn = (d: Omit<Dish, 'id' | 'createdAt'>) => Dish;

function AddDishModal({ onClose, onAdd }: { onClose: () => void; onAdd: AddDishFn }) {
  const [mode, setMode] = useState<'link' | 'name'>('name');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [needsTranscript, setNeedsTranscript] = useState(false);
  const [name, setName] = useState('');
  const [diet, setDiet] = useState<DietType>('Veg');
  const [type, setType] = useState<MealType>('Lunch');
  const [accompaniments, setAccompaniments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'link') {
        if (!url.trim()) return;
        const r = await parseLink(url.trim(), transcript.trim() || undefined);
        onAdd({
          name: r.name, type: r.type, diet: r.diet, accompaniments: r.accompaniments || '',
          macros: r.macros, ingredients: r.ingredients || [], instructions: r.instructions || [], sourceUrl: r.sourceUrl,
        });
      } else {
        if (!name.trim()) return;
        const r = await generateDishByName({ name: name.trim(), diet, type, accompaniments: accompaniments.trim() });
        onAdd({
          name: r.name || name.trim(), type, diet,
          accompaniments: (accompaniments.trim() || r.accompaniments) ?? '',
          macros: r.macros, ingredients: r.ingredients || [], instructions: r.instructions || [], sourceUrl: r.sourceUrl,
        });
      }
      onClose();
    } catch (e) {
      const err = e as Error & { needsTranscript?: boolean };
      setNeedsTranscript(!!err.needsTranscript);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-slate-800">Add a dish</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1 mb-4">
          <button onClick={() => { setMode('name'); setError(''); }} className={cn('flex-1 py-1.5 text-sm font-medium rounded-md', mode === 'name' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500')}>
            From name
          </button>
          <button onClick={() => { setMode('link'); setError(''); }} className={cn('flex-1 py-1.5 text-sm font-medium rounded-md', mode === 'link' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500')}>
            From video
          </button>
        </div>

        {mode === 'link' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Paste a <strong>YouTube</strong> video or Shorts link — Gemini watches it and summarises the recipe (steps, ingredients, calories &amp; macros). Instagram isn’t fetchable by AI, so paste its caption below.</p>
            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/shorts/…" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
            </div>
            {(needsTranscript || /instagram/i.test(url)) && (
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste the Instagram caption / transcript here…" rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
            )}
            <p className="text-[11px] text-slate-400">Tip: public YouTube links work best. Private/age-restricted videos can’t be read.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Enter a dish name — Claude generates the steps, ingredients, macros and a source link.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lobia Masala" className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={diet} onChange={(e) => setDiet(e.target.value as DietType)} className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm">
                <option value="Veg">Veg</option><option value="Non-Veg">Non-Veg</option>
              </select>
              <select value={type} onChange={(e) => setType(e.target.value as MealType)} className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm">
                {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <input value={accompaniments} onChange={(e) => setAccompaniments(e.target.value)} placeholder="Accompaniments (e.g. Roti, Dal, Salad)" className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Working…' : mode === 'link' ? 'Extract' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
