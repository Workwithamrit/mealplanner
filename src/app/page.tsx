'use client';

import { useState } from 'react';
import { CalendarDays, BookOpen, Clock, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import WeeklyMenu from '@/components/WeeklyMenu';
import DishBank from '@/components/DishBank';
import MealPrep from '@/components/MealPrep';
import Ingredients from '@/components/Ingredients';

type Tab = 'menu' | 'bank' | 'prep' | 'ingredients';

const TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'menu', label: 'Weekly Menu', icon: CalendarDays },
  { id: 'bank', label: 'Dish Bank', icon: BookOpen },
  { id: 'prep', label: 'Meal Prep', icon: Clock },
  { id: 'ingredients', label: 'Ingredients', icon: ShoppingCart },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('menu');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-slate-800 leading-none">
                SwYam<span className="text-emerald-600"> Meal Planner</span>
              </h1>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">Balanced weeks · synced with OvO</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-1 sm:gap-3 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 pb-3 pt-1 px-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'menu' && <WeeklyMenu />}
        {tab === 'bank' && <DishBank />}
        {tab === 'prep' && <MealPrep />}
        {tab === 'ingredients' && <Ingredients />}
      </main>
    </div>
  );
}
