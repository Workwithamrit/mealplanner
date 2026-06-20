import { format, parseISO, startOfWeek, addDays, isToday as _isToday, isTomorrow as _isTomorrow, isYesterday as _isYesterday } from 'date-fns';
import { DAYS_OF_WEEK, type WeekDay } from '@/types';

// Weeks run Sunday → Saturday (#3): a plan entered for Sat 20/6 belongs to the
// week that started the previous Sunday; the *next* week starts the day after.
export const toISO = (d: Date): string => format(d, 'yyyy-MM-dd');
export const todayISO = (): string => toISO(new Date());
export const tomorrowISO = (): string => toISO(addDays(new Date(), 1));

export function weekdayOf(iso: string): WeekDay {
  const dow = parseISO(iso).getDay(); // 0=Sun..6=Sat
  return DAYS_OF_WEEK[(dow + 6) % 7]; // DAYS_OF_WEEK is Monday-indexed
}

export function weekStartSunday(iso: string): string {
  return toISO(startOfWeek(parseISO(iso), { weekStartsOn: 0 }));
}

export function weekDatesFrom(weekStartIso: string): string[] {
  const start = parseISO(weekStartIso);
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)));
}

export function shiftWeek(weekStartIso: string, dir: -1 | 1): string {
  return toISO(addDays(parseISO(weekStartIso), dir * 7));
}

export function addDaysISO(iso: string, n: number): string {
  return toISO(addDays(parseISO(iso), n));
}

export function isTodayISO(iso: string): boolean { return _isToday(parseISO(iso)); }
export function isTomorrowISO(iso: string): boolean { return _isTomorrow(parseISO(iso)); }
export function isYesterdayISO(iso: string): boolean { return _isYesterday(parseISO(iso)); }

export function formatDayLabel(iso: string): string { return format(parseISO(iso), 'EEE d MMM'); }
export function formatDayShort(iso: string): string { return format(parseISO(iso), 'EEE'); }
export function formatDayNum(iso: string): string { return format(parseISO(iso), 'd MMM'); }

export function dayBadge(iso: string): 'Today' | 'Tomorrow' | 'Yesterday' | null {
  if (isTodayISO(iso)) return 'Today';
  if (isTomorrowISO(iso)) return 'Tomorrow';
  if (isYesterdayISO(iso)) return 'Yesterday';
  return null;
}
