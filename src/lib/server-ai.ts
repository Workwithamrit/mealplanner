import 'server-only';

/**
 * Server-only AI helpers. Keys never reach the client.
 *
 *  - Claude (ANTHROPIC_API_KEY) is the reasoning brain: dish generation and
 *    structuring extracted text into recipe + macros.
 *  - Gemini (GEMINI_API_KEY) is used ONLY for ingesting a YouTube/Shorts URL,
 *    which it can natively "watch". No model can fetch Instagram directly.
 */

const CLAUDE_MODEL = 'claude-sonnet-4-6';

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export function extractJSON<T = unknown>(text: string): T {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1)) as T;
    throw new Error('Model did not return valid JSON');
  }
}

export function hasClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function hasGemini(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function isYouTube(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export function isInstagram(url: string): boolean {
  return /instagram\.com/i.test(url);
}

/** Ask Claude for a JSON answer. Returns parsed object of type T. */
export async function claudeJSON<T = unknown>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 1500,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  return extractJSON<T>(text);
}

/**
 * Hand a public YouTube/Shorts URL to Gemini, which processes the video
 * directly, and ask for a structured recipe JSON.
 */
export async function geminiVideoJSON<T = unknown>(opts: {
  url: string;
  prompt: string;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { fileUri: opts.url } },
              { text: opts.prompt },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return extractJSON<T>(text);
}

// Shared instruction so every recipe comes back in the same shape.
export const RECIPE_JSON_SPEC = `Return STRICT JSON with this exact shape and nothing else:
{
  "name": string,                       // dish name
  "type": "Early Morning"|"Breakfast"|"Lunch"|"Snack"|"Dinner",
  "diet": "Veg"|"Non-Veg",
  "accompaniments": string,             // comma-separated, e.g. "Roti, Dal, Curd, Salad"
  "macros": { "calories": number, "protein": number, "carbs": number, "fat": number }, // per serving, grams
  "ingredients": string[],              // with rough quantities
  "instructions": string[],             // step by step
  "sourceUrl": string                   // a real reference recipe URL, or ""
}`;
