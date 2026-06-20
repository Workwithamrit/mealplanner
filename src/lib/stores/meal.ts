import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { indexedDBStorage } from './storage';
import {
  type Dish, type DailyMenu, type MealType, type MealPlanDish, type DietType, type WeekDay,
  type Person, type MealStatus, type Macros,
  DAYS_OF_WEEK, DEFAULT_DAY_DIET, emptyMeals,
} from '@/types';

/**
 * Persistence keys live under the `ovo-` namespace in the shared kv_store so the
 * OvO Assistant can read SwYam's meal data later without any migration.
 */
const DISHES_KEY = 'ovo-meal-dishes';
const PLAN_KEY = 'ovo-meal-plan';
const PROFILE_KEY = 'ovo-meal-profile';
const ACTIVITY_KEY = 'ovo-meal-activity';

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

/** Append an activity entry attributed to the current user. */
export function logActivity(action: string, detail: string) {
  const user = useProfileStore.getState().currentUser;
  const entry: Activity = { id: uuid(), user, action, detail, at: new Date().toISOString() };
  useActivityStore.setState((s) => ({ entries: [entry, ...s.entries].slice(0, 300) }));
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
  return DAYS_OF_WEEK.map((day) => ({ day, diet: DEFAULT_DAY_DIET[day], meals: emptyMeals() }));
}

export function dishToPlanInstance(dish: Dish, day: WeekDay, meal: MealType): MealPlanDish {
  return {
    id: `${day}-${meal}-${uuid()}`,
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
  setDayMeals: (day: WeekDay, meals: DailyMenu['meals']) => void;
  addDishToMeal: (day: WeekDay, meal: MealType, dish: MealPlanDish) => void;
  removeDishFromMeal: (day: WeekDay, meal: MealType, instanceId: string) => void;
  toggleConsumed: (day: WeekDay, meal: MealType, instanceId: string) => void;
  setPortion: (day: WeekDay, meal: MealType, instanceId: string, portion: string) => void;
  setStatus: (day: WeekDay, meal: MealType, instanceId: string, status: MealStatus) => void;
  setReplacement: (day: WeekDay, meal: MealType, instanceId: string, name: string, macros: Macros) => void;
  resetWeek: () => void;
}

// Helper: immutably map one plan dish inside the nested menu structure.
function mapDish(
  menu: DailyMenu[], day: WeekDay, meal: MealType, id: string,
  fn: (d: MealPlanDish) => MealPlanDish,
): DailyMenu[] {
  return menu.map((d) =>
    d.day === day
      ? { ...d, meals: { ...d.meals, [meal]: d.meals[meal].map((x) => (x.id === id ? fn(x) : x)) } }
      : d,
  );
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      menu: skeletonWeek(),
      setMenu: (m) => set({ menu: m }),
      setDayDiet: (day, diet) => set((s) => ({
        menu: s.menu.map((d) => (d.day === day ? { ...d, diet } : d)),
      })),
      setDayMeals: (day, meals) => set((s) => ({
        menu: s.menu.map((d) => (d.day === day ? { ...d, meals } : d)),
      })),
      addDishToMeal: (day, meal, dish) => set((s) => ({
        menu: s.menu.map((d) =>
          d.day === day ? { ...d, meals: { ...d.meals, [meal]: [...d.meals[meal], dish] } } : d,
        ),
      })),
      removeDishFromMeal: (day, meal, instanceId) => set((s) => ({
        menu: s.menu.map((d) =>
          d.day === day
            ? { ...d, meals: { ...d.meals, [meal]: d.meals[meal].filter((x) => x.id !== instanceId) } }
            : d,
        ),
      })),
      toggleConsumed: (day, meal, instanceId) => set((s) => ({
        menu: mapDish(s.menu, day, meal, instanceId, (x) => ({ ...x, consumed: !x.consumed })),
      })),
      setPortion: (day, meal, instanceId, portion) => set((s) => ({
        menu: mapDish(s.menu, day, meal, instanceId, (x) => ({ ...x, portion })),
      })),
      setStatus: (day, meal, instanceId, status) => set((s) => ({
        menu: mapDish(s.menu, day, meal, instanceId, (x) => ({
          ...x, status,
          consumed: status !== 'skipped',
          ...(status !== 'replaced' ? { actualName: undefined, actualMacros: undefined } : {}),
        })),
      })),
      setReplacement: (day, meal, instanceId, name, macros) => set((s) => ({
        menu: mapDish(s.menu, day, meal, instanceId, (x) => ({
          ...x, status: 'replaced', consumed: true, actualName: name, actualMacros: macros,
        })),
      })),
      resetWeek: () => set({ menu: skeletonWeek() }),
    }),
    {
      name: PLAN_KEY,
      storage: indexedDBStorage,
      // Heal older/partial persisted shapes so the 7-day grid is always intact.
      merge: (persisted, current) => {
        const p = persisted as Partial<MenuState> | undefined;
        if (!p?.menu || !Array.isArray(p.menu) || p.menu.length !== 7) return current;
        return { ...current, ...p };
      },
    },
  ),
);
