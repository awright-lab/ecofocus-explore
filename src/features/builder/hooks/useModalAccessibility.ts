import { useEffect, useRef, type RefObject } from "react";

export function useModalAccessibility(ref: RefObject<HTMLElement | null>, onClose: () => void, shouldRestoreFocus?: () => boolean) {
  const onCloseRef = useRef(onClose);
  const shouldRestoreFocusRef = useRef(shouldRestoreFocus);
  useEffect(() => { onCloseRef.current = onClose; shouldRestoreFocusRef.current = shouldRestoreFocus; }, [onClose, shouldRestoreFocus]);
  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const siblings: Array<{ element: HTMLElement; inert: boolean }> = [];
    let current: HTMLElement | null = modal;
    while (current && current.parentElement) {
      for (const sibling of Array.from(current.parentElement.children)) {
        if (sibling !== current && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (current.parentElement === document.body) break;
      current = current.parentElement;
    }
    document.body.style.overflow = "hidden";
    modal.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(modal!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]'))
        .filter((node) => {
          if (node.closest('[hidden], [inert]')) return false;
          for (let parent: HTMLElement | null = node; parent && parent !== modal; parent = parent.parentElement) {
            const style = window.getComputedStyle(parent);
            if (style.display === "none" || style.visibility === "hidden") return false;
            if (parent instanceof HTMLDetailsElement && !parent.open &&
                !parent.querySelector(":scope > summary")?.contains(node)) return false;
          }
          return true;
        }).sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); modal!.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal!.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = overflow;
      if (previous?.isConnected && shouldRestoreFocusRef.current?.() !== false) previous.focus();
    };
  }, [ref]);
}
