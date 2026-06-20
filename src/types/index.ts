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

// A dish instance placed into the weekly plan (decoupled from the bank so a
// plan entry survives edits/deletes of the bank dish).
export interface MealPlanDish {
  id: string;       // unique instance id
  dishId?: string;  // reference back to the bank, when it came from there
  name: string;
  diet: DietType;
  accompaniments: string;
  macros: Macros;
  consumed: boolean;
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
