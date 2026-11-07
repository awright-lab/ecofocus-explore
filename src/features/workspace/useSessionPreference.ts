import { useEffect, useState } from "react";

export function useSessionPreference<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try { const stored = window.sessionStorage.getItem(`ecofocus.${key}`); return stored && allowed.includes(stored as T) ? stored as T : fallback; }
    catch { return fallback; }
  });
  useEffect(() => { try { window.sessionStorage.setItem(`ecofocus.${key}`, value); } catch { /* Preferences never block work. */ } }, [key, value]);
  return [value, setValue] as const;
}
