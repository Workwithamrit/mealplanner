# SwYam Meal Planner

A standalone web app for planning balanced Veg / Non-Veg weeks — built to share
**the same database as OvO** so the OvO Assistant can read your meal data later.

- **Stack:** Next.js 16 (App Router) · React 19 · Zustand · Tailwind v4 — mirrors OvO.
- **Shared DB:** persists every store to the shared Supabase `kv_store` table under
  the `ovo-meal-*` keys (`ovo-meal-dishes`, `ovo-meal-plan`), via the same hybrid
  IndexedDB-cache + cloud-sync layer OvO uses (`src/lib/stores/storage.ts`). Runs
  fully on local IndexedDB until the Supabase env keys are set.
- **AI:** Claude generates recipes from a name and structures extracted text;
  Gemini ingests YouTube/Shorts links directly. Instagram needs the caption pasted.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the keys (see below)
npm run dev                  # http://localhost:3000
```

### Connecting to OvO's shared database
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be the **same
values OvO uses**. They're marked *Sensitive* on OvO's Vercel project, so they
can't be exported with `vercel env pull` — copy them from the Supabase dashboard
(Project Settings → API) or paste them manually. Set the same pair on SwYam's own
Vercel project for production.

No schema changes are needed — the `kv_store` table already exists in the OvO
Supabase project.

## Features
Weekly planner (7 days × Early Morning / Breakfast / Lunch / Snack / Dinner),
per-day Veg/Non-Veg with single-day regenerate, color-coded dishes
(green = Veg, red = Non-Veg), consumed checkboxes, multi-dish meals, open-text
add (auto-creates a bank entry), Dish Bank with link/name import + Veg/Meal
filters + recommendations, Meal-Prep schedule (batter soak→grind→ferment, bean
soaking, marination), and an Ingredients & timing list.
