export function arrayFallback<T>(arr: T[], fallback: T[]): T[] {
  if (arr.length === 0) return fallback;
  else return arr;
}
