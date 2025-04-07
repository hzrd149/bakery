export function arrayFallback<T>(arr: T[] | undefined, fallback: T[]): T[] {
  if (arr === undefined || arr.length === 0) return fallback;
  else return arr;
}
