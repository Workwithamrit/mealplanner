// ─── SwYam Meal Planner — domain types ───

export type DietType = 'Veg' | 'Non-Veg';

// The five semantic categories a DISH can belong to. These drive the generator
// rules and the Dish Bank filter. Planner *rows* are configurable slots (below)
// that each map to one of these categories.
export type MealType = 'Early Morning' | 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
export const MEAL_TYPES: MealType[] = ['Early Morning', 'Breakfast', 'Lunch', 'Snack', 'Dinner'];

// ─── Configurable meal slots (#2 — fully custom meals) ───
export interface MealSlot {
  id: string;        // stable key used in the weekly menu's `meals` map
  label: string;     // shown in the UI (user-editable)
  category: MealType; // which dish pool + generator rule this slot uses
}

export const DEFAULT_SLOTS: MealSlot[] = [
  { id: 'early-morning', label: 'Early Morning', category: 'Early Morning' },
  { id: 'breakfast', label: 'Breakfast', category: 'Breakfast' },
  { id: 'lunch', label: 'Lunch', category: 'Lunch' },
  { id: 'snack', label: 'Snack', category: 'Snack' },
  { id: 'dinner', label: 'Dinner', category: 'Dinner' },
];

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;
export type WeekDay = (typeof DAYS_OF_WEEK)[number];

export const DEFAULT_DAY_DIET: Record<WeekDay, DietType> = {
  Monday: 'Veg', Tuesday: 'Veg', Wednesday: 'Non-Veg', Thursday: 'Veg', Friday: 'Veg', Saturday: 'Non-Veg', Sunday: 'Non-Veg',
};

// ─── People & app users (#8, #9, #10) ───
export const ADULTS = ['Amrit', 'Swati'] as const;
export const KIDS = ['Akshit', 'Agastya'] as const;
export const PEOPLE = [...ADULTS, ...KIDS] as const;
export type Person = (typeof PEOPLE)[number];
export const APP_USERS: Person[] = ['Swati', 'Amrit']; // Swati primary

/** Default headcount for a category: kids join Dinner on weekdays, all three main meals at weekends (#10). */
export function defaultPeopleForCategory(cat: MealType, weekend: boolean): Person[] {
  const kidMeals: MealType[] = weekend ? ['Breakfast', 'Lunch', 'Dinner'] : ['Dinner'];
  return kidMeals.includes(cat) ? [...PEOPLE] : [...ADULTS];
}

export const DEFAULT_PORTION_OPTIONS = [
  '1 bowl', '½ bowl', '1 cup', '1 plate', '1 glass',
  '2 Roti', '3 Roti', '5 Chapati', '1 katori', '2 pieces',
];

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export interface Dish {
  id: string;
  name: string;
  type: MealType;
  diet: DietType;
  accompaniments: string;
  macros: Macros;
  ingredients: string[];
  instructions: string[];
  sourceUrl?: string;
  createdAt: string;
  /** Dessert is a tag, not an exclusive category — combinable with any meal slot (#5). */
  isDessert?: boolean;
}

// How the planned dish actually played out (#6, #3). Undefined = assume eaten
// as planned (no input needed).
export type MealStatus = 'planned' | 'skipped' | 'replaced' | 'ordered' | 'outside';

export interface MealPlanDish {
  id: string;
  dishId?: string;
  name: string;
  diet: DietType;
  accompaniments: string;
  macros: Macros;        // proposed / planned nutrition
  portion?: string;      // e.g. "1 bowl", "5 Chapati" (#5)
  consumed: boolean;
  status?: MealStatus;
  actualName?: string;   // what was actually eaten (replacement / ordered / outside)
  actualMacros?: Macros; // actual nutrition, when known
  isDessert?: boolean;   // copied from the source Dish at insertion time (#5)
}

/** Nutrition that actually counts for a planned dish (#7). */
export function actualMacros(d: MealPlanDish): Macros {
  if (d.status === 'skipped') return ZERO_MACROS;
  if (d.status === 'replaced' || d.status === 'ordered' || d.status === 'outside') {
    return d.actualMacros ?? ZERO_MACROS; // unknown ordered/outside macros count as 0
  }
  return d.macros; // default: assumed eaten as planned
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, b) => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Weekly menu — `meals` is keyed by slot id so meal rows are fully configurable.
export type DayMeals = Record<string, MealPlanDish[]>;

// A day is addressed by its real calendar date (#3 — "yyyy-MM-dd"), not a
// generic weekday label, so today/tomorrow can be read and edited directly
// (e.g. from the OvO Today tile) and a plan made for any date sticks to it.
export interface DailyMenu {
  date: string; // ISO yyyy-MM-dd
  diet: DietType;
  meals: DayMeals;
}

export function emptyMeals(slots: MealSlot[]): DayMeals {
  return Object.fromEntries(slots.map((s) => [s.id, [] as MealPlanDish[]]));
}
