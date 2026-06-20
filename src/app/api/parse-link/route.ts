import { NextRequest } from 'next/server';
import {
  geminiVideoJSON, claudeJSON, isYouTube, isInstagram, hasGemini, hasClaude, RECIPE_JSON_SPEC,
} from '@/lib/server-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Parse a recipe from a social video link.
 *  - YouTube / Shorts → Gemini ingests the URL directly (best path).
 *  - Instagram → no model can fetch IG; if a caption/transcript is supplied we
 *    let Claude structure it, otherwise we return a clear, actionable error.
 */
export async function POST(req: NextRequest) {
  let body: { url?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = (body.url ?? '').trim();
  const transcript = (body.transcript ?? '').trim();
  if (!url) return Response.json({ error: 'A video URL is required' }, { status: 400 });

  const prompt = `You are a nutrition + recipe extractor. Watch/read this cooking video and extract the recipe.
If a value is unknown, make a sensible estimate (especially macros per serving).
${RECIPE_JSON_SPEC}`;

  try {
    if (isYouTube(url) && hasGemini()) {
      const data = await geminiVideoJSON({ url, prompt });
      return Response.json({ ...(data as object), sourceUrl: url, provider: 'gemini' });
    }

    if (isInstagram(url) && !transcript) {
      return Response.json(
        {
          error:
            'Instagram Reels cannot be read directly by any AI. Paste the caption or transcript and I will structure it, or add the dish by name instead.',
          needsTranscript: true,
        },
        { status: 422 },
      );
    }

    // Fallback: structure whatever text we have (transcript or just the URL) with Claude.
    if (hasClaude()) {
      const data = await claudeJSON({
        system: 'You convert cooking content into a single structured recipe JSON. Output JSON only.',
        user: `${prompt}\n\nSource URL: ${url}\n${transcript ? `Transcript/caption:\n${transcript}` : 'No transcript available — infer the most likely recipe from the URL slug and your knowledge.'}`,
      });
      return Response.json({ ...(data as object), sourceUrl: url, provider: 'claude' });
    }

    return Response.json(
      { error: 'No AI provider configured. Set GEMINI_API_KEY (YouTube) or ANTHROPIC_API_KEY.' },
      { status: 503 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to parse the link';
    return Response.json({ error: msg }, { status: 500 });
  }
}
