import { useCallback, useLayoutEffect, useRef } from "react";

// Explicit close controls remain connected when their panel becomes hidden.
// Preserve the original control's ownership; never override a later blur/focus.
export function useClosingPanelFocus() {
  const pending = useRef<{ control: HTMLElement; target: HTMLElement } | null>(null);
  const capture = useCallback((control: HTMLElement, target: HTMLElement | null) => {
    pending.current = document.activeElement === control && !control.closest("[hidden], [inert]") && target ? { control, target } : null;
  }, []);
  const forget = useCallback((control: EventTarget | null) => {
    if (pending.current?.control === control) pending.current = null;
  }, []);
  useLayoutEffect(() => {
    const request = pending.current; pending.current = null;
    if (!request || document.activeElement !== request.control || !request.control.closest("[hidden]") ||
        !request.target.isConnected || request.target.closest("[hidden], [inert]") || request.target.matches(":disabled")) return;
    request.target.focus();
  });
  return { capture, forget };
}
