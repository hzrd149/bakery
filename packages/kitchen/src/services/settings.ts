import { BehaviorSubject } from "rxjs";

// Helper to persist settings to localStorage
function persist<T>(key: string, subject: BehaviorSubject<T>) {
  // Load initial value if exists
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      subject.next(JSON.parse(stored));
    } catch (e) {
      console.warn(`Failed to load setting: ${key}`, e);
    }
  }

  // Subscribe to changes and persist
  subject.subscribe((value) => {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
}

type Theme = "light" | "dark" | "system";

// Create behavior subjects for settings
export const theme = new BehaviorSubject<Theme>("system");
export const bakeryUrl = new BehaviorSubject<string | null>(null);

// Initialize persistence
persist("theme", theme);
persist("bakeryUrl", bakeryUrl);
