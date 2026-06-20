export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const isVegName = (name: string): boolean =>
  !/\b(chicken|mutton|fish|prawn|egg|meat|keema|beef|pork)\b/i.test(name);
