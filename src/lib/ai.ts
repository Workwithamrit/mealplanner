import type { Dish, DietType, MealType } from '@/types';

export interface ParsedRecipe {
  name: string;
  type: MealType;
  diet: DietType;
  accompaniments: string;
  macros: { calories: number; protein: number; carbs: number; fat: number };
  ingredients: string[];
  instructions: string[];
  sourceUrl?: string;
  provider?: string;
}

interface ApiError {
  error: string;
  needsTranscript?: boolean;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: 'Bad response' }));
  if (!res.ok) {
    const err = data as ApiError;
    const e = new Error(err.error || 'Request failed') as Error & { needsTranscript?: boolean };
    e.needsTranscript = err.needsTranscript;
    throw e;
  }
  return data as T;
}

export const parseLink = (url: string, transcript?: string) =>
  postJSON<ParsedRecipe>('/api/parse-link', { url, transcript });

export const generateDishByName = (input: {
  name: string;
  diet: DietType;
  type: MealType;
  accompaniments?: string;
}) => postJSON<ParsedRecipe>('/api/generate-dish', input);

export type DaySmartFill = Record<MealType, { name: string; accompaniments: string }[]>;

export const smartFillDay = (day: string, diet: DietType, bank: Dish[]) =>
  postJSON<DaySmartFill>('/api/recommend', { day, diet, bank });
