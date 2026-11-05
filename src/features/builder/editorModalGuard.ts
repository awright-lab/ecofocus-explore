// Native dialog inertness does not stop keyboard events reaching window listeners.
// Non-modal popovers with a dialog role also own keys while their controls focus.
export function editorModalOwnsKeyboard(event: KeyboardEvent) {
  const target = event.target;
  return Boolean((target instanceof Element && target.closest('dialog[open], [role="dialog"]')) ||
    document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'));
}
