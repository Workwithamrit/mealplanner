import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { indexedDBStorage } from './storage';
import {
  type Dish, type DailyMenu, type MealType, type MealPlanDish, type DietType, type WeekDay,
  type Person, type MealStatus, type Macros, type MealSlot, type DayMeals,
  DAYS_OF_WEEK, DEFAULT_DAY_DIET, DEFAULT_SLOTS, DEFAULT_PORTION_OPTIONS, defaultPeopleForCategory,
} from '@/types';

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

/** Headcount for a slot on a given day, honouring config overrides (#10). */
export function peopleForSlot(slotId: string, day: WeekDay): Person[] {
  const weekend = day === 'Saturday' || day === 'Sunday';
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

// ─── Weekly Plan Store ───
function skeletonWeek(): DailyMenu[] {
  const slots = useConfigStore.getState().slots;
  return DAYS_OF_WEEK.map((day) => ({
    day, diet: DEFAULT_DAY_DIET[day],
    meals: Object.fromEntries(slots.map((s) => [s.id, [] as MealPlanDish[]])),
  }));
}

export function dishToPlanInstance(dish: Dish, day: WeekDay, slotId: string): MealPlanDish {
  return {
    id: `${day}-${slotId}-${uuid()}`,
    dishId: dish.id,
    name: dish.name,
    diet: dish.diet,
    accompaniments: dish.accompaniments,
    macros: dish.macros,
    consumed: false,
  };
}

interface MenuState {
  menu: DailyMenu[];
  setMenu: (m: DailyMenu[]) => void;
  setDayDiet: (day: WeekDay, diet: DietType) => void;
  setDayMeals: (day: WeekDay, meals: DayMeals) => void;
  addDishToMeal: (day: WeekDay, slotId: string, dish: MealPlanDish) => void;
  removeDishFromMeal: (day: WeekDay, slotId: string, instanceId: string) => void;
  toggleConsumed: (day: WeekDay, slotId: string, instanceId: string) => void;
  setPortion: (day: WeekDay, slotId: string, instanceId: string, portion: string) => void;
  setStatus: (day: WeekDay, slotId: string, instanceId: string, status: MealStatus) => void;
  setReplacement: (day: WeekDay, slotId: string, instanceId: string, name: string, macros: Macros) => void;
  setExternal: (day: WeekDay, slotId: string, instanceId: string, kind: 'ordered' | 'outside', name: string, macros?: Macros) => void;
  syncSlots: () => void;
  resetWeek: () => void;
}

function mapDish(
  menu: DailyMenu[], day: WeekDay, slotId: string, id: string,
  fn: (d: MealPlanDish) => MealPlanDish,
): DailyMenu[] {
  return menu.map((d) =>
    d.day === day
      ? { ...d, meals: { ...d.meals, [slotId]: (d.meals[slotId] ?? []).map((x) => (x.id === id ? fn(x) : x)) } }
      : d,
  );
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      menu: skeletonWeek(),
      setMenu: (m) => set({ menu: m }),
      setDayDiet: (day, diet) => set((s) => ({ menu: s.menu.map((d) => (d.day === day ? { ...d, diet } : d)) })),
      setDayMeals: (day, meals) => set((s) => ({ menu: s.menu.map((d) => (d.day === day ? { ...d, meals } : d)) })),
      addDishToMeal: (day, slotId, dish) => set((s) => ({
        menu: s.menu.map((d) => (d.day === day ? { ...d, meals: { ...d.meals, [slotId]: [...(d.meals[slotId] ?? []), dish] } } : d)),
      })),
      removeDishFromMeal: (day, slotId, instanceId) => set((s) => ({
        menu: s.menu.map((d) => (d.day === day ? { ...d, meals: { ...d.meals, [slotId]: (d.meals[slotId] ?? []).filter((x) => x.id !== instanceId) } } : d)),
      })),
      toggleConsumed: (day, slotId, instanceId) => set((s) => ({
        menu: mapDish(s.menu, day, slotId, instanceId, (x) => ({ ...x, consumed: !x.consumed })),
      })),
      setPortion: (day, slotId, instanceId, portion) => set((s) => ({
        menu: mapDish(s.menu, day, slotId, instanceId, (x) => ({ ...x, portion })),
      })),
      setStatus: (day, slotId, instanceId, status) => set((s) => ({
        menu: mapDish(s.menu, day, slotId, instanceId, (x) => ({
          ...x, status, consumed: status !== 'skipped',
          ...(status === 'planned' || status === 'skipped' ? { actualName: undefined, actualMacros: undefined } : {}),
        })),
      })),
      setReplacement: (day, slotId, instanceId, name, macros) => set((s) => ({
        menu: mapDish(s.menu, day, slotId, instanceId, (x) => ({ ...x, status: 'replaced', consumed: true, actualName: name, actualMacros: macros })),
      })),
      setExternal: (day, slotId, instanceId, kind, name, macros) => set((s) => ({
        menu: mapDish(s.menu, day, slotId, instanceId, (x) => ({ ...x, status: kind, consumed: true, actualName: name, actualMacros: macros })),
      })),
      // Reconcile every day's meal map with the current config slots.
      syncSlots: () => set((s) => {
        const ids = useConfigStore.getState().slots.map((sl) => sl.id);
        return {
          menu: s.menu.map((d) => {
            const meals: DayMeals = {};
            for (const id of ids) meals[id] = d.meals[id] ?? [];
            return { ...d, meals };
          }),
        };
      }),
      resetWeek: () => set({ menu: skeletonWeek() }),
    }),
    {
      name: PLAN_KEY,
      storage: indexedDBStorage,
      merge: (persisted, current) => {
        const p = persisted as Partial<MenuState> | undefined;
        if (!p?.menu || !Array.isArray(p.menu) || p.menu.length !== 7) return current;
        return { ...current, ...p };
      },
    },
  ),
);
