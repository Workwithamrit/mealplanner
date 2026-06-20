// ─── SwYam Meal Planner — domain types ───

export type DietType = 'Veg' | 'Non-Veg';

// Meal slots across the day. "Early Morning" carries the default soaked-seed
// water + soaked nuts ritual; "Snack" is the kids' daytime slot.
export type MealType = 'Early Morning' | 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';

export const MEAL_TYPES: MealType[] = ['Early Morning', 'Breakfast', 'Lunch', 'Snack', 'Dinner'];

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;
export type WeekDay = (typeof DAYS_OF_WEEK)[number];

// Default per-day diet: Veg Mon/Tue/Thu/Fri, Non-Veg Wed/Sat/Sun.
export const DEFAULT_DAY_DIET: Record<WeekDay, DietType> = {
  Monday: 'Veg',
  Tuesday: 'Veg',
  Wednesday: 'Non-Veg',
  Thursday: 'Veg',
  Friday: 'Veg',
  Saturday: 'Non-Veg',
  Sunday: 'Non-Veg',
};

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Dish {
  id: string;
  name: string;
  type: MealType;
  diet: DietType;
  accompaniments: string; // comma-separated, e.g. "Roti, Dal, Curd, Salad"
  macros: Macros;
  ingredients: string[];
  instructions: string[];
  sourceUrl?: string;
  createdAt: string;
}

// ─── People & app users (#8, #9, #10) ───
export const ADULTS = ['Amrit', 'Swati'] as const;
export const KIDS = ['Akshit', 'Agastya'] as const;
export const PEOPLE = [...ADULTS, ...KIDS] as const;
export type Person = (typeof PEOPLE)[number];

// Both adults operate the app; Swati is the primary user.
export const APP_USERS: Person[] = ['Swati', 'Amrit'];

/**
 * Who a given meal is planned for. Adults always; kids join Dinner on weekdays
 * and all three main meals at the weekend (#10). Portions are then adjusted by
 * the user.
 */
export function peopleForMeal(day: WeekDay, meal: MealType): Person[] {
  const weekend = day === 'Saturday' || day === 'Sunday';
  const kidMeals: MealType[] = weekend ? ['Breakfast', 'Lunch', 'Dinner'] : ['Dinner'];
  return kidMeals.includes(meal) ? [...PEOPLE] : [...ADULTS];
}

export const PORTION_SUGGESTIONS = [
  '1 bowl', '½ bowl', '1 cup', '1 plate', '1 glass',
  '2 Roti', '3 Roti', '5 Chapati', '1 katori', '2 pieces',
];

// How the planned dish actually played out (#6). Undefined = assume eaten as
// planned (no input needed).
export type MealStatus = 'planned' | 'skipped' | 'replaced';

// A dish instance placed into the weekly plan (decoupled from the bank so a
// plan entry survives edits/deletes of the bank dish).
export interface MealPlanDish {
  id: string;       // unique instance id
  dishId?: string;  // reference back to the bank, when it came from there
  name: string;
  diet: DietType;
  accompaniments: string;
  macros: Macros;        // proposed / planned nutrition
  portion?: string;      // e.g. "1 bowl", "5 Chapati" (#5)
  consumed: boolean;     // legacy quick "had it" flag
  status?: MealStatus;   // #6
  actualName?: string;   // when replaced, what was eaten instead
  actualMacros?: Macros; // actual nutrition when replaced
}

/** Nutrition that actually counts for a planned dish (#7). */
export function actualMacros(d: MealPlanDish): Macros {
  if (d.status === 'skipped') return ZERO_MACROS;
  if (d.status === 'replaced' && d.actualMacros) return d.actualMacros;
  return d.macros; // default: assumed eaten as planned
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, b) => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export type DayMeals = Record<MealType, MealPlanDish[]>;

export interface DailyMenu {
  day: WeekDay;
  diet: DietType; // the day's Veg/Non-Veg setting
  meals: DayMeals;
}

export function emptyMeals(): DayMeals {
  return {
    'Early Morning': [],
    Breakfast: [],
    Lunch: [],
    Snack: [],
    Dinner: [],
  };
}

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
