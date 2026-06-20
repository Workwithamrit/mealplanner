import { NextRequest } from 'next/server';
import { claudeJSON, hasClaude, RECIPE_JSON_SPEC } from '@/lib/server-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Generate a full recipe (steps, ingredients, macros, source) from a dish name.
 * Claude is the reasoner here.
 */
export async function POST(req: NextRequest) {
  let body: { name?: string; diet?: string; type?: string; accompaniments?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (!name) return Response.json({ error: 'A dish name is required' }, { status: 400 });
  if (!hasClaude()) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured on the server.' }, { status: 503 });
  }

  const hints = [
    body.type ? `Intended meal: ${body.type}.` : '',
    body.diet ? `Dietary preference: ${body.diet} (the recipe MUST match this).` : '',
    body.accompaniments ? `Preferred accompaniments: ${body.accompaniments}.` : '',
  ].filter(Boolean).join(' ');

  try {
    const data = await claudeJSON({
      system: 'You are an Indian-home-cooking nutritionist. Output a single recipe as JSON only.',
      user: `Create a realistic recipe for "${name}". ${hints}\nUse typical Indian home-kitchen ingredients and portions. ${RECIPE_JSON_SPEC}`,
    });
    return Response.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to generate the dish';
    return Response.json({ error: msg }, { status: 500 });
  }
}
