import { useCallback, useLayoutEffect, useRef } from "react";

// Capture ownership before a transient control leaves the DOM. Restore only
// after removal, when focus has not deliberately moved elsewhere.
export function useRemovedControlFocus() {
  const target = useRef<HTMLElement | null>(null);
  const control = useRef<HTMLElement | null>(null);
  const displaced = useRef<HTMLElement | null>(null);
  const targetRef = useCallback((node: HTMLElement | null) => { target.current = node; }, []);
  const controlRef = useCallback((node: HTMLElement | null) => {
    if (!node && control.current === document.activeElement) displaced.current = control.current;
    control.current = node;
  }, []);
  useLayoutEffect(() => {
    const previous = displaced.current;
    displaced.current = null;
    if (!previous || previous.isConnected || document.activeElement && document.activeElement !== document.body) return;
    if (target.current?.isConnected) target.current.focus();
  });
  return { targetRef, controlRef };
}
