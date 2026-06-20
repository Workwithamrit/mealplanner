import {
  type Dish, type DailyMenu, type DayMeals, type DietType, type MealType, type WeekDay,
  DAYS_OF_WEEK, emptyMeals,
} from '@/types';
import { dishToPlanInstance } from './stores/meal';

// ─── helpers ───
const rand = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];

function pool(dishes: Dish[], type: MealType, diet?: DietType): Dish[] {
  return dishes.filter((d) => d.type === type && (!diet || d.diet === diet));
}

/** Dishes whose name implies a fermented batter shared across multiple mornings. */
export function isBatterDish(name: string): boolean {
  return /\b(idli|dosa|uttapam|appam)\b/i.test(name);
}

/**
 * Build a full balanced week from the bank ONLY (requirement #22), respecting
 * each day's Veg/Non-Veg setting. Dosa/Idli batter is clubbed across up to 3
 * consecutive breakfasts (#14). Early Morning always carries the soaked
 * nuts + seed-water ritual (#16); Snacks slot is filled for the kids (#15).
 */
export function generateWeek(menu: DailyMenu[], dishes: Dish[]): DailyMenu[] {
  const usedMains = new Set<string>();
  let batterDish: Dish | undefined;
  let batterRunsLeft = 0;

  return menu.map((day) => {
    const meals = generateDay(day.day, day.diet, dishes, usedMains, () => {
      // breakfast picker with batter clubbing
      if (batterRunsLeft > 0 && batterDish) {
        batterRunsLeft -= 1;
        return batterDish;
      }
      const bfast = pickFresh(pool(dishes, 'Breakfast', day.diet === 'Veg' ? 'Veg' : undefined), usedMains)
        ?? rand(pool(dishes, 'Breakfast', 'Veg'));
      if (bfast && isBatterDish(bfast.name)) {
        batterDish = bfast;
        batterRunsLeft = 2; // this morning + next two = 3 total
      } else {
        batterDish = undefined;
        batterRunsLeft = 0;
      }
      return bfast;
    });
    return { ...day, meals };
  });
}

/** Regenerate a single day from the bank (used by the per-day diet popup, #21). */
export function generateOneDay(day: WeekDay, diet: DietType, dishes: Dish[]): DayMeals {
  const used = new Set<string>();
  return generateDay(day, diet, dishes, used, () => {
    const bf = pickFresh(pool(dishes, 'Breakfast', diet === 'Veg' ? 'Veg' : undefined), used)
      ?? rand(pool(dishes, 'Breakfast', 'Veg'));
    return bf;
  });
}

function pickFresh(candidates: Dish[], used: Set<string>): Dish | undefined {
  const fresh = candidates.filter((d) => !used.has(d.id));
  const chosen = rand(fresh.length ? fresh : candidates);
  if (chosen) used.add(chosen.id);
  return chosen;
}

function generateDay(
  day: WeekDay,
  diet: DietType,
  dishes: Dish[],
  usedMains: Set<string>,
  pickBreakfast: () => Dish | undefined,
): DayMeals {
  const meals = emptyMeals();
  const add = (meal: MealType, dish?: Dish) => {
    if (dish) meals[meal].push(dishToPlanInstance(dish, day, meal));
  };

  // Early Morning — default ritual: soaked nuts + a seed/methi water.
  const nuts = dishes.find((d) => /almond|walnut/i.test(d.name) && d.type === 'Early Morning');
  const water = rand(pool(dishes, 'Early Morning').filter((d) => !/almond|walnut/i.test(d.name)));
  add('Early Morning', nuts);
  add('Early Morning', water);

  // Breakfast (batter-clubbed via the injected picker).
  add('Breakfast', pickBreakfast());

  // Lunch — a main + a veg side (multiple dishes per meal, #18).
  if (diet === 'Non-Veg') {
    add('Lunch', pickFresh(pool(dishes, 'Lunch', 'Non-Veg'), usedMains));
  } else {
    add('Lunch', pickFresh(pool(dishes, 'Lunch', 'Veg'), usedMains));
  }
  const side = pickFresh(
    pool(dishes, 'Lunch', 'Veg').filter((d) => /fry|bhindi|brinjal|parwal|kundru|poi|cabbage/i.test(d.name)),
    usedMains,
  );
  add('Lunch', side);

  // Snack — kids' daytime slot.
  add('Snack', pickFresh(pool(dishes, 'Snack', 'Veg'), usedMains));

  // Dinner — one main; on a Non-Veg day keep dinner veg if lunch was non-veg.
  add('Dinner', pickFresh(pool(dishes, 'Dinner', 'Veg'), usedMains));

  return meals;
}

// ─── Prep schedule (#13, #14, #16) ───
export interface PrepTask {
  day: WeekDay;
  timing: string;
  task: string;
}

const prevDay = (day: WeekDay): WeekDay => {
  const i = DAYS_OF_WEEK.indexOf(day);
  return DAYS_OF_WEEK[(i + 6) % 7];
};

export function buildPrepTasks(menu: DailyMenu[]): Record<WeekDay, PrepTask[]> {
  const out = Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, [] as PrepTask[]])) as Record<WeekDay, PrepTask[]>;
  const push = (t: PrepTask) => {
    if (!out[t.day].some((x) => x.task === t.task)) out[t.day].push(t);
  };

  // Batter clubbing: find consecutive runs of the same batter breakfast and
  // schedule a single soak→grind→ferment timeline before the run starts.
  const batterByDay = menu.map((d) => {
    const bf = d.meals.Breakfast.find((x) => isBatterDish(x.name));
    return bf?.name ?? null;
  });
  for (let i = 0; i < menu.length; i++) {
    const name = batterByDay[i];
    if (!name) continue;
    if (i > 0 && batterByDay[i - 1] === name) continue; // mid-run, already scheduled
    const start = prevDay(menu[i].day);
    push({ day: start, timing: 'Previous morning', task: `Soak lentils + rice for ${name} batter` });
    push({ day: start, timing: 'Previous night', task: `Grind ${name} batter and set to ferment overnight` });
  }

  menu.forEach((day) => {
    Object.entries(day.meals).forEach(([meal, list]) => {
      list.forEach((dish) => {
        const n = dish.name.toLowerCase();
        if (/\b(rajma|chole|chola|chana|kabuli|gughuni|makhni|makhani)\b/.test(n)) {
          push({ day: prevDay(day.day), timing: 'Night before', task: `Soak beans/legumes overnight for ${dish.name} (${meal})` });
        }
        if (/\b(fish|prawn|chicken|mutton|tikka|keema)\b/.test(n)) {
          push({ day: day.day, timing: '6–8 hrs before', task: `Marinate ${dish.name} ahead of ${meal}` });
        }
        if (/\bpaneer\b/.test(n)) {
          push({ day: day.day, timing: 'Morning of', task: `Set out / make fresh paneer for ${dish.name}` });
        }
      });
    });
    // Early-morning soak ritual prepared the night before (#16).
    if (day.meals['Early Morning'].length) {
      push({ day: prevDay(day.day), timing: 'Night before', task: 'Soak almonds, walnuts and methi/seed water for the morning' });
    }
  });

  return out;
}

// ─── Ingredient procurement plan (#13) ───
export interface IngredientLine {
  item: string;
  forDish: string;
  meal: MealType;
  availableBy: string;
}

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

export function buildIngredientPlan(menu: DailyMenu[]): Record<WeekDay, IngredientLine[]> {
  const out = Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, [] as IngredientLine[]])) as Record<WeekDay, IngredientLine[]>;
  menu.forEach((day) => {
    Object.entries(day.meals).forEach(([meal, list]) => {
      list.forEach((dish) => {
        PROCURE.forEach(({ re, item, by }) => {
          if (re.test(dish.name) && !out[day.day].some((l) => l.item === item)) {
            out[day.day].push({ item, forDish: dish.name, meal: meal as MealType, availableBy: by });
          }
        });
      });
    });
  });
  return out;
}

// ─── Dish-bank-driven recommendations (#8) ───
export interface Recommendation {
  meal: MealType;
  diet: DietType;
  name: string;
  accompaniments: string;
  reason: string;
}

/**
 * Suggest dishes (with accompaniments) the user could add to the bank but
 * hasn't yet — a small curated set per meal/diet. Accepting one adds it to the
 * bank. Only suggests names not already present.
 */
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
  return SUGGESTIONS.filter((s) => !have.has(s.name.toLowerCase())).map((s) => ({
    ...s,
    reason: `Adds variety to your ${s.diet} ${s.meal} rotation`,
  }));
}
