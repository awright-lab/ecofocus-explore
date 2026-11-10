import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { normalizeObjectName } from "./objectName";
import "./object-name-field.css";

export function ObjectNameField({ label, name, onApply }: { label: "Layer name" | "Analysis name"; name: string; onApply: (name: string) => void }) {
  const id = useId(), wrapper = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(name), [compositionActive, setCompositionActive] = useState(false), [issue, setIssue] = useState<{ message: string; invalid: boolean } | null>(null);
  const currentDraft = useRef(name), baseline = useRef(name), editing = useRef(false), composing = useRef(false), pendingBlur = useRef(false);
  const pointerCancellation = useRef<{ restoreInput: boolean; blurred: boolean } | null>(null);
  const applyCurrent = useRef<() => void>(() => undefined);
  useLayoutEffect(() => { if (!editing.current) { baseline.current = name; currentDraft.current = name; setDraft(name); } }, [name]);
  useLayoutEffect(() => { applyCurrent.current = apply; });
  useEffect(() => {
    const isInside = (node: EventTarget | null, container: HTMLElement | null) => node instanceof Node && !!container?.contains(node);
    function outsideFocus(event: FocusEvent) {
      if (isInside(event.target, wrapper.current)) return;
      const gesture = pointerCancellation.current; pointerCancellation.current = null;
      if (gesture?.blurred) { if (composing.current) pendingBlur.current = true; else applyCurrent.current(); }
    }
    function outsidePress(event: Event) { if (!isInside(event.target, cancelButton.current)) abortGesture(false); }
    function outsideRelease(event: Event) { if (!isInside(event.target, cancelButton.current)) abortGesture(true); }
    function leaveWindow() { abortGesture(false); }
    document.addEventListener("focusin", outsideFocus, true);
    window.addEventListener("pointerdown", outsidePress, true); window.addEventListener("mousedown", outsidePress, true);
    window.addEventListener("pointerup", outsideRelease, true); window.addEventListener("mouseup", outsideRelease, true);
    window.addEventListener("blur", leaveWindow);
    return () => {
      pointerCancellation.current = null;
      document.removeEventListener("focusin", outsideFocus, true);
      window.removeEventListener("pointerdown", outsidePress, true); window.removeEventListener("mousedown", outsidePress, true);
      window.removeEventListener("pointerup", outsideRelease, true); window.removeEventListener("mouseup", outsideRelease, true);
      window.removeEventListener("blur", leaveWindow);
    };
  }, []);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (editing.current && currentDraft.current !== name) { event.preventDefault(); event.returnValue = ""; } }
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [name]);
  function reset() { editing.current = false; pendingBlur.current = false; pointerCancellation.current = null; baseline.current = name; currentDraft.current = name; setDraft(name); setIssue(null); }
  function change(value: string) { pointerCancellation.current = null; if (!editing.current) baseline.current = name; editing.current = true; currentDraft.current = value; setDraft(value); setIssue(null); }
  function apply() {
    if (!editing.current || composing.current) return;
    if (currentDraft.current === name) { reset(); return; }
    if (baseline.current !== name) { reset(); setIssue({ message: "This name changed while you were editing. Its current value was kept; enter your rename again.", invalid: false }); return; }
    let next: string;
    try { next = normalizeObjectName(currentDraft.current); }
    catch (error) { reset(); setIssue({ message: error instanceof Error ? error.message : "That name is unsupported. The current report name was kept.", invalid: true }); return; }
    reset();
    if (next === name) return;
    currentDraft.current = next; setDraft(next);
    try { onApply(next); }
    catch { currentDraft.current = name; setDraft(name); setIssue({ message: "The rename could not be confirmed. Check the current report name before trying again.", invalid: false }); }
  }
  function cancelOnPress(event: { button: number; isPrimary?: boolean; preventDefault: () => void }) {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (currentDraft.current === name && !composing.current) return;
    // Hold an ambiguous blur; only completed activation discards the draft.
    const previous = pointerCancellation.current;
    event.preventDefault(); pointerCancellation.current = { restoreInput: document.activeElement === input.current || !!previous?.restoreInput, blurred: previous?.blurred ?? false };
  }
  function abortGesture(restoreFocus: boolean) {
    const gesture = pointerCancellation.current; pointerCancellation.current = null;
    if (restoreFocus && gesture?.restoreInput && gesture.blurred && (!document.activeElement || document.activeElement === document.body) && input.current?.isConnected && !input.current.closest("[hidden], [inert], [aria-hidden='true']")) input.current.focus();
  }
  function cancel(owner: HTMLElement) {
    if (composing.current) return;
    const pointer = pointerCancellation.current; pointerCancellation.current = null;
    if (currentDraft.current === name && !pointer) return;
    const ownsFocus = document.activeElement === owner || !!pointer?.restoreInput && (!document.activeElement || document.activeElement === document.body);
    reset(); if (ownsFocus) input.current?.focus();
  }
  return <div className="object-name-field" ref={wrapper} data-canvas-keyboard-scope="controls" onKeyDownCapture={() => { pointerCancellation.current = null; }} onBlur={event => {
    if (event.relatedTarget instanceof Node && wrapper.current?.contains(event.relatedTarget)) return;
    const gesture = pointerCancellation.current;
    if (gesture && event.relatedTarget === null) {
      gesture.blurred = true;
      if (gesture.restoreInput && (!document.activeElement || document.activeElement === document.body) && input.current?.isConnected && !input.current.closest("[hidden], [inert], [aria-hidden='true']")) input.current.focus();
      return;
    }
    pointerCancellation.current = null;
    if (composing.current) { pendingBlur.current = true; return; }
    apply();
  }}>
    <label htmlFor={id}>{label}<input id={id} ref={input} type="text" value={draft} aria-describedby={`${id}-help${issue ? ` ${id}-issue` : ""}`} aria-invalid={issue?.invalid || undefined} onChange={event => change(event.target.value)}
      onCompositionStart={() => { composing.current = true; setCompositionActive(true); }} onCompositionEnd={event => { composing.current = false; setCompositionActive(false); change(event.currentTarget.value); if (pendingBlur.current && !wrapper.current?.contains(document.activeElement)) { pendingBlur.current = false; apply(); } }}
      onKeyDown={event => { if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return; if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); apply(); } if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); reset(); } }} /></label>
    <button ref={cancelButton} type="button" className="secondary" aria-disabled={draft === name || compositionActive} aria-label={`Cancel ${label.toLowerCase()} edit`} onPointerDown={cancelOnPress} onMouseDown={cancelOnPress} onPointerCancel={() => abortGesture(true)} onClick={event => cancel(event.currentTarget)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(event.currentTarget); } }}>Cancel name edit</button>
    <small id={`${id}-help`}>A single-line name, up to 200 characters, for report organization and search. {label === "Analysis name" ? "The separate title field and analysis data stay unchanged. An empty title may display this name. " : "The object's displayed content stays unchanged. "}Enter or leave these name controls to apply; Escape or Cancel keeps the current name. Undo reverses an applied rename.</small>
    {compositionActive && <small>Finish composing text before applying or canceling the name.</small>}
    {draft !== name && <small role="status">Name edit not applied yet. Press Enter or leave these controls to apply, or cancel the edit.</small>}
    {issue && <p id={`${id}-issue`} role="alert">{issue.message}</p>}
  </div>;
}
