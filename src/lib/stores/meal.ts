import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { indexedDBStorage } from './storage';
import {
  type Dish, type DailyMenu, type MealType, type MealPlanDish, type DietType, type WeekDay,
  type Person, type MealStatus, type Macros, type MealSlot, type DayMeals,
  DEFAULT_DAY_DIET, DEFAULT_SLOTS, DEFAULT_PORTION_OPTIONS, defaultPeopleForCategory, emptyMeals,
} from '@/types';
import { weekdayOf, weekStartSunday, weekDatesFrom, todayISO } from '@/lib/date';

/**
 * Persistence keys live under the `ovo-` namespace in the shared kv_store so the
 * OvO Assistant can read SwYam's meal data later without any migration.
 */
const DISHES_KEY = 'ovo-meal-dishes';
const PLAN_KEY = 'ovo-meal-plan';
const PROFILE_KEY = 'ovo-meal-profile';
const ACTIVITY_KEY = 'ovo-meal-activity';
const CONFIG_KEY = 'ovo-meal-config';

// ─── Profile Store — who is operating the app (#9) ───
interface ProfileState {
  currentUser: Person;
  setCurrentUser: (u: Person) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      currentUser: 'Swati', // wife is the primary user
      setCurrentUser: (currentUser) => set({ currentUser }),
    }),
    { name: PROFILE_KEY, storage: indexedDBStorage },
  ),
);

// ─── Activity Log Store — attributes every change to a user (#9) ───
export interface Activity {
  id: string;
  user: Person;
  action: string;
  detail: string;
  at: string;
}

interface ActivityState {
  entries: Activity[];
  clear: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({ entries: [] as Activity[], clear: () => set({ entries: [] }) }),
    { name: ACTIVITY_KEY, storage: indexedDBStorage },
  ),
);

export function logActivity(action: string, detail: string) {
  const user = useProfileStore.getState().currentUser;
  const entry: Activity = { id: uuid(), user, action, detail, at: new Date().toISOString() };
  useActivityStore.setState((s) => ({ entries: [entry, ...s.entries].slice(0, 300) }));
}

// ─── Configurator Store (#2) — meal slots, people per slot, portion options ───
type SlotPeople = Record<string, { weekday: Person[]; weekend: Person[] }>;

function defaultPeopleBySlot(slots: MealSlot[]): SlotPeople {
  return Object.fromEntries(slots.map((s) => [s.id, {
    weekday: defaultPeopleForCategory(s.category, false),
    weekend: defaultPeopleForCategory(s.category, true),
  }]));
}

interface ConfigState {
  slots: MealSlot[];
  portionOptions: string[];
  peopleBySlot: SlotPeople;
  addSlot: (label: string, category: MealType) => string;
  removeSlot: (id: string) => void;
  renameSlot: (id: string, label: string) => void;
  setSlotCategory: (id: string, category: MealType) => void;
  moveSlot: (id: string, dir: -1 | 1) => void;
  setPortionOptions: (opts: string[]) => void;
  setSlotPeople: (id: string, scope: 'weekday' | 'weekend', people: Person[]) => void;
  resetConfig: () => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      slots: DEFAULT_SLOTS,
      portionOptions: DEFAULT_PORTION_OPTIONS,
      peopleBySlot: defaultPeopleBySlot(DEFAULT_SLOTS),
      addSlot: (label, category) => {
        const id = `slot-${uuid().slice(0, 8)}`;
        set((s) => ({
          slots: [...s.slots, { id, label, category }],
          peopleBySlot: { ...s.peopleBySlot, [id]: { weekday: defaultPeopleForCategory(category, false), weekend: defaultPeopleForCategory(category, true) } },
        }));
        useMenuStore.getState().syncSlots();
        return id;
      },
      removeSlot: (id) => {
        set((s) => {
          const peopleBySlot = { ...s.peopleBySlot }; delete peopleBySlot[id];
          return { slots: s.slots.filter((x) => x.id !== id), peopleBySlot };
        });
        useMenuStore.getState().syncSlots();
      },
      renameSlot: (id, label) => set((s) => ({ slots: s.slots.map((x) => (x.id === id ? { ...x, label } : x)) })),
      setSlotCategory: (id, category) => set((s) => ({ slots: s.slots.map((x) => (x.id === id ? { ...x, category } : x)) })),
      moveSlot: (id, dir) => set((s) => {
        const i = s.slots.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.slots.length) return s;
        const slots = [...s.slots];
        [slots[i], slots[j]] = [slots[j], slots[i]];
        return { slots };
      }),
      setPortionOptions: (opts) => set({ portionOptions: opts }),
      setSlotPeople: (id, scope, people) => set((s) => ({
        peopleBySlot: { ...s.peopleBySlot, [id]: { ...(s.peopleBySlot[id] ?? { weekday: [], weekend: [] }), [scope]: people } },
      })),
      resetConfig: () => { set({ slots: DEFAULT_SLOTS, portionOptions: DEFAULT_PORTION_OPTIONS, peopleBySlot: defaultPeopleBySlot(DEFAULT_SLOTS) }); useMenuStore.getState().syncSlots(); },
    }),
    { name: CONFIG_KEY, storage: indexedDBStorage },
  ),
);

/** Headcount for a slot on a given calendar date, honouring config overrides (#10). */
export function peopleForSlot(slotId: string, date: string): Person[] {
  const weekend = weekdayOf(date) === 'Saturday' || weekdayOf(date) === 'Sunday';
  const cfg = useConfigStore.getState();
  const entry = cfg.peopleBySlot[slotId];
  if (entry) return weekend ? entry.weekend : entry.weekday;
  const slot = cfg.slots.find((s) => s.id === slotId);
  return defaultPeopleForCategory(slot?.category ?? 'Lunch', weekend);
}

// ─── Dish Bank Store ───
interface DishState {
  dishes: Dish[];
  addDish: (d: Omit<Dish, 'id' | 'createdAt'>) => Dish;
  updateDish: (id: string, updates: Partial<Dish>) => void;
  removeDish: (id: string) => void;
  seed: (dishes: Dish[]) => void;
  resetTo: (dishes: Dish[]) => void;
}

export const useDishStore = create<DishState>()(
  persist(
    (set, get) => ({
      dishes: [],
      addDish: (d) => {
        const dish: Dish = { ...d, id: uuid(), createdAt: new Date().toISOString() };
        set((s) => ({ dishes: [...s.dishes, dish] }));
        return dish;
      },
      updateDish: (id, updates) => set((s) => ({
        dishes: s.dishes.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      })),
      removeDish: (id) => set((s) => ({ dishes: s.dishes.filter((d) => d.id !== id) })),
      seed: (dishes) => { if (get().dishes.length === 0) set({ dishes }); },
      resetTo: (dishes) => set({ dishes }),
    }),
    { name: DISHES_KEY, storage: indexedDBStorage },
  ),
);

// ─── Weekly Plan Store — keyed by real calendar date (#3) ───
function skeletonDay(date: string): DailyMenu {
  const slots = useConfigStore.getState().slots;
  return { date, diet: DEFAULT_DAY_DIET[weekdayOf(date)], meals: emptyMeals(slots) };
}

/** Pure read helper — never mutates the store; callers persist only on edit. */
export function dayOrSkeleton(byDate: Record<string, DailyMenu>, date: string): DailyMenu {
  return byDate[date] ?? skeletonDay(date);
}

export function dishToPlanInstance(dish: Dish, date: string, slotId: string): MealPlanDish {
  return {
    id: `${date}-${slotId}-${uuid()}`,
    dishId: dish.id,
    name: dish.name,
    diet: dish.diet,
    accompaniments: dish.accompaniments,
    macros: dish.macros,
    consumed: false,
    isDessert: dish.isDessert,
  };
}

interface MenuState {
  byDate: Record<string, DailyMenu>;
  weekStart: string; // ISO Sunday of the week currently being viewed
  setWeekStart: (iso: string) => void;
  ensureDates: (dates: string[]) => void;
  setMenuForDates: (entries: DailyMenu[]) => void;
  setDayDiet: (date: string, diet: DietType) => void;
  setDayMeals: (date: string, meals: DayMeals) => void;
  addDishToMeal: (date: string, slotId: string, dish: MealPlanDish) => void;
  /** Add the same dish to several slots on the same day in one action (#4). */
  addDishToMeals: (date: string, slotIds: string[], dish: Dish) => void;
  removeDishFromMeal: (date: string, slotId: string, instanceId: string) => void;
  toggleConsumed: (date: string, slotId: string, instanceId: string) => void;
  setPortion: (date: string, slotId: string, instanceId: string, portion: string) => void;
  setStatus: (date: string, slotId: string, instanceId: string, status: MealStatus) => void;
  setReplacement: (date: string, slotId: string, instanceId: string, name: string, macros: Macros) => void;
  setExternal: (date: string, slotId: string, instanceId: string, kind: 'ordered' | 'outside', name: string, macros?: Macros) => void;
  syncSlots: () => void;
  resetWeek: (weekStartIso: string) => void;
}

function mapDish(
  byDate: Record<string, DailyMenu>, date: string, slotId: string, id: string,
  fn: (d: MealPlanDish) => MealPlanDish,
): Record<string, DailyMenu> {
  const day = dayOrSkeleton(byDate, date);
  const meals: DayMeals = { ...day.meals, [slotId]: (day.meals[slotId] ?? []).map((x) => (x.id === id ? fn(x) : x)) };
  return { ...byDate, [date]: { ...day, meals } };
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      byDate: {},
      weekStart: weekStartSunday(todayISO()),
      setWeekStart: (iso) => set({ weekStart: iso }),
      ensureDates: (dates) => set((s) => {
        const byDate = { ...s.byDate };
        let changed = false;
        for (const d of dates) if (!byDate[d]) { byDate[d] = skeletonDay(d); changed = true; }
        return changed ? { byDate } : s;
      }),
      setMenuForDates: (entries) => set((s) => {
        const byDate = { ...s.byDate };
        for (const e of entries) byDate[e.date] = e;
        return { byDate };
      }),
      setDayDiet: (date, diet) => set((s) => ({ byDate: { ...s.byDate, [date]: { ...dayOrSkeleton(s.byDate, date), diet } } })),
      setDayMeals: (date, meals) => set((s) => ({ byDate: { ...s.byDate, [date]: { ...dayOrSkeleton(s.byDate, date), meals } } })),
      addDishToMeal: (date, slotId, dish) => set((s) => {
        const day = dayOrSkeleton(s.byDate, date);
        const meals: DayMeals = { ...day.meals, [slotId]: [...(day.meals[slotId] ?? []), dish] };
        return { byDate: { ...s.byDate, [date]: { ...day, meals } } };
      }),
      addDishToMeals: (date, slotIds, dish) => set((s) => {
        const day = dayOrSkeleton(s.byDate, date);
        const meals: DayMeals = { ...day.meals };
        for (const slotId of slotIds) meals[slotId] = [...(meals[slotId] ?? []), dishToPlanInstance(dish, date, slotId)];
        return { byDate: { ...s.byDate, [date]: { ...day, meals } } };
      }),
      removeDishFromMeal: (date, slotId, instanceId) => set((s) => {
        const day = dayOrSkeleton(s.byDate, date);
        const meals: DayMeals = { ...day.meals, [slotId]: (day.meals[slotId] ?? []).filter((x) => x.id !== instanceId) };
        return { byDate: { ...s.byDate, [date]: { ...day, meals } } };
      }),
      toggleConsumed: (date, slotId, instanceId) => set((s) => ({
        byDate: mapDish(s.byDate, date, slotId, instanceId, (x) => ({ ...x, consumed: !x.consumed })),
      })),
      setPortion: (date, slotId, instanceId, portion) => set((s) => ({
        byDate: mapDish(s.byDate, date, slotId, instanceId, (x) => ({ ...x, portion })),
      })),
      setStatus: (date, slotId, instanceId, status) => set((s) => ({
        byDate: mapDish(s.byDate, date, slotId, instanceId, (x) => ({
          ...x, status, consumed: status !== 'skipped',
          ...(status === 'planned' || status === 'skipped' ? { actualName: undefined, actualMacros: undefined } : {}),
        })),
      })),
      setReplacement: (date, slotId, instanceId, name, macros) => set((s) => ({
        byDate: mapDish(s.byDate, date, slotId, instanceId, (x) => ({ ...x, status: 'replaced', consumed: true, actualName: name, actualMacros: macros })),
      })),
      setExternal: (date, slotId, instanceId, kind, name, macros) => set((s) => ({
        byDate: mapDish(s.byDate, date, slotId, instanceId, (x) => ({ ...x, status: kind, consumed: true, actualName: name, actualMacros: macros })),
      })),
      // Reconcile every persisted day's meal map with the current config slots.
      syncSlots: () => set((s) => {
        const ids = useConfigStore.getState().slots.map((sl) => sl.id);
        const byDate = Object.fromEntries(Object.entries(s.byDate).map(([date, day]) => {
          const meals: DayMeals = {};
          for (const id of ids) meals[id] = day.meals[id] ?? [];
          return [date, { ...day, meals }];
        }));
        return { byDate };
      }),
      resetWeek: (weekStartIso) => set((s) => {
        const byDate = { ...s.byDate };
        for (const d of weekDatesFrom(weekStartIso)) delete byDate[d];
        return { byDate };
      }),
    }),
    {
      name: PLAN_KEY,
      storage: indexedDBStorage,
      // Heals partial/legacy persisted shapes, including the pre-#3 weekday-array format.
      merge: (persisted, current) => {
        const p = persisted as { byDate?: Record<string, DailyMenu>; weekStart?: string; menu?: { day: WeekDay; diet: DietType; meals: DayMeals }[] } | undefined;
        if (p?.byDate && typeof p.byDate === 'object') {
          return { ...current, ...p, byDate: p.byDate, weekStart: p.weekStart || current.weekStart };
        }
        if (Array.isArray(p?.menu) && p.menu.length > 0 && p.menu[0]?.day) {
          // Legacy weekday-keyed array → pin onto the current real Sun–Sat week.
          const weekStart = weekStartSunday(todayISO());
          const dates = weekDatesFrom(weekStart);
          const byDate: Record<string, DailyMenu> = {};
          p.menu!.forEach((old, i) => {
            const date = dates.find((d) => weekdayOf(d) === old.day) ?? dates[i % 7];
            byDate[date] = { date, diet: old.diet, meals: old.meals };
          });
          return { ...current, byDate, weekStart };
        }
        return current;
      },
    },
  ),
);
