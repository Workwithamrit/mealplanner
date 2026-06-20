import {
  type Dish, type DailyMenu, type DayMeals, type MealPlanDish, type DietType, type MealType, type Person, type Macros,
  actualMacros, sumMacros, ZERO_MACROS,
} from '@/types';
import { dishToPlanInstance, useConfigStore, peopleForSlot } from './stores/meal';
import { addDaysISO } from './date';

// ─── helpers ───
const rand = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];
const pool = (dishes: Dish[], cat: MealType, diet?: DietType): Dish[] =>
  dishes.filter((d) => d.types.includes(cat) && (!diet || d.diet === diet));
const SIDE_RE = /fry|bhindi|brinjal|parwal|kundru|poi|cabbage/i;

export function isBatterDish(name: string): boolean {
  return /\b(idli|dosa|uttapam|appam)\b/i.test(name);
}

interface BatterState { dish?: Dish; left: number }

function pickFresh(candidates: Dish[], used: Set<string>): Dish | undefined {
  const fresh = candidates.filter((d) => !used.has(d.id));
  const chosen = rand(fresh.length ? fresh : candidates);
  if (chosen) used.add(chosen.id);
  return chosen;
}

/** Fill one slot according to its category's rule. Returns the dish instances. */
function fillSlot(
  category: MealType, diet: DietType, dishes: Dish[], used: Set<string>,
  date: string, slotId: string, batter: BatterState,
): MealPlanDish[] {
  const out: MealPlanDish[] = [];
  const inst = (d?: Dish) => { if (d) out.push(dishToPlanInstance(d, date, slotId)); };

  switch (category) {
    case 'Early Morning': {
      const nuts = dishes.find((d) => /almond|walnut/i.test(d.name) && d.types.includes('Early Morning'));
      const water = rand(pool(dishes, 'Early Morning').filter((d) => !/almond|walnut/i.test(d.name)));
      inst(nuts); inst(water);
      break;
    }
    case 'Breakfast': {
      let bf: Dish | undefined;
      if (batter.left > 0 && batter.dish) { batter.left -= 1; bf = batter.dish; }
      else {
        bf = pickFresh(pool(dishes, 'Breakfast', diet === 'Veg' ? 'Veg' : undefined), used) ?? rand(pool(dishes, 'Breakfast', 'Veg'));
        if (bf && isBatterDish(bf.name)) { batter.dish = bf; batter.left = 2; } // this + next two = 3
        else { batter.dish = undefined; batter.left = 0; }
      }
      inst(bf);
      break;
    }
    case 'Lunch': {
      inst(diet === 'Non-Veg' ? pickFresh(pool(dishes, 'Lunch', 'Non-Veg'), used) : pickFresh(pool(dishes, 'Lunch', 'Veg'), used));
      inst(pickFresh(pool(dishes, 'Lunch', 'Veg').filter((d) => SIDE_RE.test(d.name)), used));
      break;
    }
    case 'Snack':
      inst(pickFresh(pool(dishes, 'Snack', 'Veg'), used));
      break;
    case 'Dinner':
      inst(pickFresh(pool(dishes, 'Dinner', 'Veg'), used));
      break;
  }
  return out;
}

/** Build a full balanced run of days from the bank ONLY (#22), over the configured slots. */
export function generateWeek(menu: DailyMenu[], dishes: Dish[]): DailyMenu[] {
  const slots = useConfigStore.getState().slots;
  const used = new Set<string>();
  const batter: BatterState = { left: 0 };
  return menu.map((day) => {
    const meals: DayMeals = {};
    for (const slot of slots) meals[slot.id] = fillSlot(slot.category, day.diet, dishes, used, day.date, slot.id, batter);
    return { ...day, meals };
  });
}

/** Regenerate a single day from the bank (used by the per-day diet popup, #21). */
export function generateOneDay(date: string, diet: DietType, dishes: Dish[]): DayMeals {
  const slots = useConfigStore.getState().slots;
  const used = new Set<string>();
  const batter: BatterState = { left: 0 };
  const meals: DayMeals = {};
  for (const slot of slots) meals[slot.id] = fillSlot(slot.category, diet, dishes, used, date, slot.id, batter);
  return meals;
}

// ─── Prep schedule (#13, #14, #16) ───
export interface PrepTask { date: string; timing: string; task: string }

function slotMaps() {
  const slots = useConfigStore.getState().slots;
  const label = new Map(slots.map((s) => [s.id, s.label]));
  const category = new Map(slots.map((s) => [s.id, s.category]));
  return { label, category };
}

export function buildPrepTasks(menu: DailyMenu[]): Record<string, PrepTask[]> {
  const { label, category } = slotMaps();
  const out: Record<string, PrepTask[]> = {};
  for (const d of menu) out[d.date] = [];
  const push = (t: PrepTask) => {
    if (!out[t.date]) out[t.date] = [];
    if (!out[t.date].some((x) => x.task === t.task)) out[t.date].push(t);
  };

  // Batter clubbing: schedule one soak→grind→ferment timeline at the start of a run.
  const breakfastSlot = useConfigStore.getState().slots.find((s) => s.category === 'Breakfast');
  if (breakfastSlot) {
    const batterByDay = menu.map((d) => (d.meals[breakfastSlot.id] ?? []).find((x) => isBatterDish(x.name))?.name ?? null);
    for (let i = 0; i < menu.length; i++) {
      const name = batterByDay[i];
      if (!name || (i > 0 && batterByDay[i - 1] === name)) continue;
      const start = addDaysISO(menu[i].date, -1);
      push({ date: start, timing: 'Previous morning', task: `Soak lentils + rice for ${name} batter` });
      push({ date: start, timing: 'Previous night', task: `Grind ${name} batter and set to ferment overnight` });
    }
  }

  menu.forEach((day) => {
    Object.entries(day.meals).forEach(([slotId, list]) => {
      const meal = label.get(slotId) ?? slotId;
      list.forEach((dish) => {
        const n = dish.name.toLowerCase();
        if (/\b(rajma|chole|chola|chana|kabuli|gughuni|makhni|makhani)\b/.test(n))
          push({ date: addDaysISO(day.date, -1), timing: 'Night before', task: `Soak beans/legumes overnight for ${dish.name} (${meal})` });
        if (/\b(fish|prawn|chicken|mutton|tikka|keema)\b/.test(n))
          push({ date: day.date, timing: '6–8 hrs before', task: `Marinate ${dish.name} ahead of ${meal}` });
        if (/\bpaneer\b/.test(n))
          push({ date: day.date, timing: 'Morning of', task: `Set out / make fresh paneer for ${dish.name}` });
      });
      // Early-morning soak ritual, prepared the night before (#16).
      if (category.get(slotId) === 'Early Morning' && list.length)
        push({ date: addDaysISO(day.date, -1), timing: 'Night before', task: 'Soak almonds, walnuts and methi/seed water for the morning' });
    });
  });

  return out;
}

// ─── Ingredient procurement plan (#13) ───
export interface IngredientLine { item: string; forDish: string; meal: string; availableBy: string }

const PROCURE: { re: RegExp; item: string; by: string }[] = [
  { re: /\bfish\b/i, item: 'Fresh fish', by: 'Buy fresh, 6–8 hrs before the meal' },
  { re: /\bprawn\b/i, item: 'Prawns', by: 'Buy fresh, 6–8 hrs before the meal' },
  { re: /\bchicken\b/i, item: 'Chicken', by: 'Thaw/buy 6–8 hrs before the meal' },
  { re: /\bmutton|keema\b/i, item: 'Mutton', by: 'Thaw/buy the night before' },
  { re: /\begg\b/i, item: 'Eggs', by: 'Keep stocked' },
  { re: /\brajma\b/i, item: 'Rajma (kidney beans)', by: 'Soak overnight, ~10–12 hrs before' },
  { re: /\bchole|chola|chana|kabuli\b/i, item: 'Chole (chickpeas)', by: 'Soak overnight, ~10–12 hrs before' },
  { re: /\bgughuni\b/i, item: 'White peas', by: 'Soak overnight, ~10–12 hrs before' },
  { re: /\b(idli|dosa|uttapam)\b/i, item: 'Idli/Dosa batter', by: 'Soak prev. morning, grind at night, ferment overnight' },
  { re: /\bpaneer\b/i, item: 'Paneer', by: 'Fresh on the day' },
  { re: /\bsoya\b/i, item: 'Soya chunks', by: 'Keep stocked' },
];

export function buildIngredientPlan(menu: DailyMenu[]): Record<string, IngredientLine[]> {
  const { label } = slotMaps();
  const out: Record<string, IngredientLine[]> = {};
  for (const d of menu) out[d.date] = [];
  menu.forEach((day) => {
    Object.entries(day.meals).forEach(([slotId, list]) => {
      const meal = label.get(slotId) ?? slotId;
      list.forEach((dish) => {
        PROCURE.forEach(({ re, item, by }) => {
          if (re.test(dish.name) && !out[day.date].some((l) => l.item === item))
            out[day.date].push({ item, forDish: dish.name, meal, availableBy: by });
        });
      });
    });
  });
  return out;
}

// ─── Dish-bank-driven recommendations (#8) ───
export interface Recommendation { meal: MealType; diet: DietType; name: string; accompaniments: string; reason: string }

const SUGGESTIONS: Omit<Recommendation, 'reason'>[] = [
  { meal: 'Breakfast', diet: 'Veg', name: 'Vegetable Vermicelli Upma', accompaniments: 'Coconut Chutney' },
  { meal: 'Breakfast', diet: 'Veg', name: 'Sprouted Moong Dosa', accompaniments: 'Tomato Chutney' },
  { meal: 'Breakfast', diet: 'Non-Veg', name: 'Masala Egg Wrap', accompaniments: 'Mint Chutney' },
  { meal: 'Lunch', diet: 'Veg', name: 'Lobia Masala', accompaniments: 'Rice, Salad' },
  { meal: 'Lunch', diet: 'Veg', name: 'Drumstick Sambar', accompaniments: 'Rice' },
  { meal: 'Lunch', diet: 'Non-Veg', name: 'Andhra Chicken Fry', accompaniments: 'Rice, Rasam' },
  { meal: 'Snack', diet: 'Veg', name: 'Beetroot Cutlet', accompaniments: 'Green Chutney' },
  { meal: 'Snack', diet: 'Veg', name: 'Masala Corn Cup', accompaniments: 'Lemon' },
  { meal: 'Dinner', diet: 'Veg', name: 'Veg Handi', accompaniments: 'Jeera Rice, Roti' },
  { meal: 'Dinner', diet: 'Veg', name: 'Methi Malai Mutter', accompaniments: 'Naan' },
  { meal: 'Dinner', diet: 'Non-Veg', name: 'Chicken Stew with Appam', accompaniments: 'Appam' },
  { meal: 'Early Morning', diet: 'Veg', name: 'Soaked Fenugreek & Jeera Water', accompaniments: '' },
];

export function buildRecommendations(dishes: Dish[]): Recommendation[] {
  const have = new Set(dishes.map((d) => d.name.toLowerCase()));
  return SUGGESTIONS.filter((s) => !have.has(s.name.toLowerCase())).map((s) => ({ ...s, reason: `Adds variety to your ${s.diet} ${s.meal} rotation` }));
}

/** Calories/protein/carbs/fat credited to each person for a day, based on who's in each slot (#1, #8). */
export function dayPersonMacros(day: DailyMenu): Partial<Record<Person, Macros>> {
  const totals: Partial<Record<Person, Macros>> = {};
  for (const [slotId, list] of Object.entries(day.meals)) {
    if (list.length === 0) continue;
    const people = peopleForSlot(slotId, day.date);
    const slotTotal = sumMacros(list.map(actualMacros));
    for (const person of people) totals[person] = sumMacros([totals[person] ?? ZERO_MACROS, slotTotal]);
  }
  return totals;
}
