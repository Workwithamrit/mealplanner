'use client';

import { useState } from 'react';
import { CalendarDays, BookOpen, Clock, ShoppingCart, UtensilsCrossed, BarChart3, UserCircle2, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/lib/stores/meal';
import { APP_USERS, type Person } from '@/types';
import WeeklyMenu from '@/components/WeeklyMenu';
import DishBank from '@/components/DishBank';
import MealPrep from '@/components/MealPrep';
import Ingredients from '@/components/Ingredients';
import Tracker from '@/components/Tracker';
import Settings from '@/components/Settings';

type Tab = 'menu' | 'bank' | 'prep' | 'ingredients' | 'tracker' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'menu', label: 'Weekly Menu', icon: CalendarDays },
  { id: 'bank', label: 'Dish Bank', icon: BookOpen },
  { id: 'tracker', label: 'Tracker', icon: BarChart3 },
  { id: 'prep', label: 'Meal Prep', icon: Clock },
  { id: 'ingredients', label: 'Ingredients', icon: ShoppingCart },
  { id: 'settings', label: 'Configurator', icon: SlidersHorizontal },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('menu');
  const { currentUser, setCurrentUser } = useProfileStore();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold tracking-tight text-slate-800 leading-none truncate">
                SwYam<span className="text-emerald-600"> Meal Planner</span>
              </h1>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">Planning for Amrit, Swati, Akshit &amp; Agastya</p>
            </div>
          </div>

          {/* Who is using the app (#9) */}
          <label className="flex items-center gap-1.5 text-sm flex-shrink-0">
            <UserCircle2 className="w-4 h-4 text-slate-400" />
            <select
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value as Person)}
              className="font-medium text-slate-700 border border-slate-200 rounded-lg pl-2 pr-1 py-1 bg-white"
              title="Signed-in user — changes are logged to this person"
            >
              {APP_USERS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
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
                tab === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'menu' && <WeeklyMenu />}
        {tab === 'bank' && <DishBank />}
        {tab === 'tracker' && <Tracker />}
        {tab === 'prep' && <MealPrep />}
        {tab === 'ingredients' && <Ingredients />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
