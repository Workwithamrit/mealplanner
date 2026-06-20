import { NextRequest } from 'next/server';
import { claudeJSON, hasClaude } from '@/lib/server-ai';
import type { Dish, DietType } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * AI "smart-fill" for a single day. Claude picks dishes ONLY from the supplied
 * bank (requirement #22), honouring the day's Veg/Non-Veg setting and the
 * batter-clubbing / early-morning rituals. The deterministic local generator
 * in meal-logic.ts is the default; this route is the optional smarter pass.
 */
export async function POST(req: NextRequest) {
  let body: { day?: string; diet?: DietType; bank?: Dish[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { day, diet, bank } = body;
  if (!day || !diet || !Array.isArray(bank)) {
    return Response.json({ error: 'day, diet and bank are required' }, { status: 400 });
  }
  if (!hasClaude()) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured on the server.' }, { status: 503 });
  }

  const slim = bank.map((d) => ({ name: d.name, type: d.type, diet: d.diet, accompaniments: d.accompaniments }));

  try {
    const data = await claudeJSON({
      system: 'You are a balanced-nutrition meal planner. Output JSON only. Never invent dishes outside the provided bank.',
      user: `Plan all meals for ${day}. The day is a ${diet} day.

Rules:
1. Choose dish NAMES ONLY from this bank (exact names): ${JSON.stringify(slim)}
2. On a Veg day every dish must be Veg. On a Non-Veg day, include at least one Non-Veg main (lunch or dinner); other dishes may be Veg.
3. Early Morning = the soaked nuts + seed/methi water items from the bank.
4. Lunch should have a main plus a vegetable side (2 dishes). Snack is one light item for kids.
5. Balance protein/carbs/fat across the day.

Return STRICT JSON:
{
  "Early Morning": [{ "name": string, "accompaniments": string }],
  "Breakfast": [{ "name": string, "accompaniments": string }],
  "Lunch": [{ "name": string, "accompaniments": string }],
  "Snack": [{ "name": string, "accompaniments": string }],
  "Dinner": [{ "name": string, "accompaniments": string }]
}`,
    });
    return Response.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to recommend a plan';
    return Response.json({ error: msg }, { status: 500 });
  }
}
