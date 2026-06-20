import type { Dish, DietType, MealType, Macros } from '@/types';

/**
 * The canonical SwYam dish bank.
 *
 * Block A = Amrit's source table (Breakfast / Lunch / Lunch-2 sides / Dinner).
 * Block B = ~30 related dishes added to round out Early Morning, Snacks and
 *           extra Veg/Non-Veg options so "Regenerate" has range.
 *
 * Requirement #22: the weekly plan is built ONLY from these dishes.
 */

type Seed = [name: string, type: MealType, diet: DietType, accompaniments: string, macros: Macros];

const m = (calories: number, protein: number, carbs: number, fat: number): Macros => ({ calories, protein, carbs, fat });

const SEED: Seed[] = [
  // ─── Block A · BREAKFAST ───
  ['Idli', 'Breakfast', 'Veg', 'Sambar, Coconut Chutney', m(300, 10, 60, 2)],
  ['Poha', 'Breakfast', 'Veg', 'Sev, Lemon', m(350, 8, 65, 6)],
  ['Dosa', 'Breakfast', 'Veg', 'Sambar, Coconut Chutney', m(400, 12, 70, 8)],
  ['Masala Daliya', 'Breakfast', 'Veg', 'Curd', m(320, 14, 55, 4)],
  ['Moong Daal Chila', 'Breakfast', 'Veg', 'Green Chutney', m(280, 18, 35, 6)],
  ['Besan Chila', 'Breakfast', 'Veg', 'Tomato Sauce', m(300, 15, 40, 8)],
  ['Upma', 'Breakfast', 'Veg', 'Coconut Chutney', m(320, 8, 55, 7)],
  ['Chocolate Pancake', 'Breakfast', 'Veg', 'Maple Syrup, Banana', m(420, 10, 62, 14)],
  ['Chooda Chakta', 'Breakfast', 'Veg', 'Curd', m(300, 7, 55, 6)],
  ['French Toast', 'Breakfast', 'Veg', 'Honey', m(350, 10, 45, 12)],
  ['Poori Curry', 'Breakfast', 'Veg', 'Aloo Curry', m(450, 9, 60, 18)],
  ['Pancake', 'Breakfast', 'Non-Veg', 'Maple Syrup', m(450, 12, 60, 15)],
  ['Bread Omlette', 'Breakfast', 'Non-Veg', 'Ketchup', m(400, 20, 30, 22)],
  ['French Toast (Egg)', 'Breakfast', 'Non-Veg', 'Honey', m(380, 16, 40, 16)],

  // ─── Block A · LUNCH (mains) ───
  ['Paneer Butter Masala', 'Lunch', 'Veg', 'Roti, Rice', m(550, 18, 35, 38)],
  ['Dalma', 'Lunch', 'Veg', 'Rice', m(350, 16, 60, 5)],
  ['Palak Based Curry (Corn/Aloo)', 'Lunch', 'Veg', 'Roti', m(380, 10, 45, 18)],
  ['Parwal Curry', 'Lunch', 'Veg', 'Rice', m(250, 6, 30, 12)],
  ['Paneer Curry', 'Lunch', 'Veg', 'Roti, Rice', m(500, 20, 30, 32)],
  ['Mix Veg Curry', 'Lunch', 'Veg', 'Roti, Rice', m(250, 6, 45, 8)],
  ['Cabbage Curry', 'Lunch', 'Veg', 'Roti, Dal', m(200, 6, 25, 9)],
  ['Janhi Rai', 'Lunch', 'Veg', 'Rice', m(180, 5, 20, 8)],
  ['Chicken Curry', 'Lunch', 'Non-Veg', 'Rice', m(480, 45, 15, 25)],
  ['Palak Chicken', 'Lunch', 'Non-Veg', 'Roti', m(420, 48, 12, 20)],
  ['Fish Curry', 'Lunch', 'Non-Veg', 'Rice', m(400, 35, 15, 22)],
  ['Chicken Biryani', 'Lunch', 'Non-Veg', 'Raita, Salad', m(650, 42, 70, 20)],

  // ─── Block A · LUNCH-2 (veg sides) ───
  ['Bhindi Tamatar', 'Lunch', 'Veg', 'Roti, Dal', m(180, 4, 20, 10)],
  ['Bhindi Fry', 'Lunch', 'Veg', 'Roti, Dal', m(200, 4, 18, 12)],
  ['Brinjal Aloo Fry', 'Lunch', 'Veg', 'Roti, Dal', m(220, 4, 28, 11)],
  ['Brinjal Round Fry', 'Lunch', 'Veg', 'Roti, Dal', m(210, 4, 24, 12)],
  ['Parwal Fry', 'Lunch', 'Veg', 'Roti, Dal', m(190, 5, 20, 10)],
  ['Poi Leaf Fry', 'Lunch', 'Veg', 'Rice, Dal', m(150, 5, 14, 8)],
  ['Kundru Fry', 'Lunch', 'Veg', 'Roti, Dal', m(180, 4, 18, 10)],

  // ─── Block A · DINNER ───
  ['Dal Tadka', 'Dinner', 'Veg', 'Jeera Rice, Roti', m(300, 15, 45, 8)],
  ['Stuffed Parantha (Aloo/Gobi/Paneer)', 'Dinner', 'Veg', 'Curd, Pickle', m(400, 12, 55, 16)],
  ['Gobi Aloo', 'Dinner', 'Veg', 'Roti', m(250, 6, 35, 10)],
  ['Aloo Matar Curry', 'Dinner', 'Veg', 'Roti', m(280, 8, 40, 10)],
  ['Chole Curry', 'Dinner', 'Veg', 'Bhature, Rice', m(450, 18, 65, 14)],
  ['Gughuni', 'Dinner', 'Veg', 'Roti, Rice', m(320, 14, 48, 8)],
  ['Rajma', 'Dinner', 'Veg', 'Rice', m(420, 17, 65, 8)],
  ['Mix Daal Makhni', 'Dinner', 'Veg', 'Jeera Rice, Naan', m(450, 18, 50, 18)],
  ['Bhindi Fry (Dinner)', 'Dinner', 'Veg', 'Roti, Dal', m(200, 4, 18, 12)],
  ['Palak Paneer Rice', 'Dinner', 'Veg', 'Salad', m(480, 18, 55, 20)],
  ['Vegetable Kathi Roll', 'Dinner', 'Veg', 'Mint Chutney', m(380, 12, 50, 14)],
  ['Soya Biryani', 'Dinner', 'Veg', 'Raita', m(450, 22, 60, 14)],
  ['Daal Dhokli', 'Dinner', 'Veg', 'Curd', m(400, 16, 58, 12)],
  ['Millet Masala Khichdi', 'Dinner', 'Veg', 'Curd, Papad', m(300, 12, 55, 6)],
  ['Oats Pizza', 'Dinner', 'Veg', 'Salad', m(320, 14, 45, 12)],
  ['Chilli Soya', 'Dinner', 'Veg', 'Fried Rice', m(380, 24, 40, 14)],
  ['Falafel Roll with Hummus Dip', 'Dinner', 'Veg', 'Roti, Salad', m(400, 15, 50, 18)],
  ['Sev Bhaaji', 'Dinner', 'Veg', 'Roti', m(300, 8, 35, 14)],
  ['Aloo Bhuna', 'Dinner', 'Veg', 'Roti, Dal', m(260, 6, 38, 9)],
  ['Paneer Makhani', 'Dinner', 'Veg', 'Jeera Rice, Naan', m(480, 16, 32, 34)],
  ['Chicken Roll', 'Dinner', 'Non-Veg', 'Mint Chutney', m(450, 30, 40, 18)],
  ['Egg Curry', 'Dinner', 'Non-Veg', 'Roti, Rice', m(350, 20, 15, 22)],

  // ─── Block B · EARLY MORNING (default ritual) ───
  ['Soaked Almonds & Walnuts', 'Early Morning', 'Veg', '', m(150, 5, 4, 14)],
  ['Methi Seed Water', 'Early Morning', 'Veg', '', m(10, 0, 2, 0)],
  ['Soaked Chia/Sabja Water', 'Early Morning', 'Veg', 'Lemon', m(60, 2, 8, 3)],
  ['Warm Lemon Honey Water', 'Early Morning', 'Veg', '', m(20, 0, 5, 0)],

  // ─── Block B · SNACKS (kids / daytime) ───
  ['Roasted Makhana', 'Snack', 'Veg', '', m(120, 3, 20, 2)],
  ['Fruit & Nut Bowl', 'Snack', 'Veg', 'Chia Seeds', m(160, 4, 28, 5)],
  ['Sprout Chaat', 'Snack', 'Veg', 'Lemon, Onion', m(150, 8, 25, 1)],
  ['Banana Peanut Butter Toast', 'Snack', 'Veg', '', m(220, 7, 30, 9)],
  ['Vegetable Cutlet', 'Snack', 'Veg', 'Ketchup', m(200, 5, 28, 8)],
  ['Dhokla', 'Snack', 'Veg', 'Green Chutney', m(180, 8, 28, 4)],
  ['Cheese Corn Sandwich', 'Snack', 'Veg', '', m(260, 10, 32, 11)],
  ['Boiled Egg & Pepper', 'Snack', 'Non-Veg', '', m(140, 12, 1, 10)],

  // ─── Block B · extra BREAKFAST ───
  ['Ragi Dosa', 'Breakfast', 'Veg', 'Tomato Chutney', m(300, 10, 45, 5)],
  ['Aloo Paratha', 'Breakfast', 'Veg', 'Curd, Pickle', m(400, 8, 60, 12)],
  ['Oats Porridge', 'Breakfast', 'Veg', 'Fruits, Nuts', m(250, 9, 40, 5)],
  ['Egg Bhurji with Pav', 'Breakfast', 'Non-Veg', 'Onion Salad', m(420, 20, 45, 18)],

  // ─── Block B · extra LUNCH ───
  ['Rajma Chawal', 'Lunch', 'Veg', 'Onion Salad', m(450, 18, 70, 8)],
  ['Kadhi Pakora', 'Lunch', 'Veg', 'Jeera Rice', m(380, 12, 45, 16)],
  ['Matar Paneer', 'Lunch', 'Veg', 'Roti', m(400, 15, 30, 22)],
  ['Mutton Rogan Josh', 'Lunch', 'Non-Veg', 'Pulao', m(550, 35, 20, 35)],
  ['Prawn Curry', 'Lunch', 'Non-Veg', 'Rice', m(380, 28, 10, 22)],
  ['Egg Fried Rice', 'Lunch', 'Non-Veg', 'Chilli Sauce', m(450, 18, 60, 15)],

  // ─── Block B · extra DINNER ───
  ['Lauki Kofta', 'Dinner', 'Veg', 'Phulka', m(300, 8, 40, 12)],
  ['Lentil Soup', 'Dinner', 'Veg', 'Garlic Bread', m(250, 14, 35, 5)],
  ['Stuffed Bell Peppers', 'Dinner', 'Veg', 'Salad', m(280, 10, 30, 12)],
  ['Grilled Chicken Breast', 'Dinner', 'Non-Veg', 'Steamed Veggies', m(300, 45, 10, 8)],
  ['Fish Tikka', 'Dinner', 'Non-Veg', 'Green Salad', m(280, 35, 5, 10)],
  ['Mutton Keema Pav', 'Dinner', 'Non-Veg', 'Onion Salad', m(480, 30, 40, 22)],
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const SEED_DISHES: Dish[] = SEED.map(([name, type, diet, accompaniments, macros]) => ({
  id: `seed-${slug(name)}`,
  name,
  types: [type],
  diet,
  accompaniments,
  macros,
  ingredients: [],
  instructions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}));
