import { useCallback, useRef, useState, type SetStateAction } from "react";

export type DocumentCommandCommit<T> = (update: SetStateAction<T>, onChanged?: (previous: T, next: T) => void) => boolean;

// Document commands run once at command time. React receives a concrete value,
// so replaying a render never replays ID creation, history or save side effects.
// Every document replacement, including navigation, uses this same commit path.
export function useDocumentCommandState<T extends { id: string }>(initial: T | (() => T), onReplaced?: () => void): readonly [T, DocumentCommandCommit<T>, () => number, () => number] {
  const [value, renderValue] = useState(initial);
  const latest = useRef(value);
  const replacementCallback = useRef(onReplaced);
  replacementCallback.current = onReplaced;
  const replacementVersion = useRef(0);
  const editVersion = useRef(0);
  const getEditVersion = useCallback(() => editVersion.current, []);
  const getReplacementVersion = useCallback(() => replacementVersion.current, []);
  const commit = useCallback<DocumentCommandCommit<T>>((update, onChanged) => {
    const previous = latest.current;
    const next = typeof update === "function" ? (update as (value: T) => T)(previous) : update;
    if (Object.is(previous,next)) return false;
    editVersion.current += 1;
    // Concrete replacements include navigation, snapshots and Undo/Redo.
    // Ordinary functional edits can continue while an analysis is pending.
    const replacing = typeof update !== "function" || previous.id !== next.id;
    if (replacing) replacementVersion.current += 1;
    latest.current = next;
    renderValue(() => next);
    // Invalidation must happen even if A -> B -> A ends at the rendered value
    // and React skips the effect that would otherwise clear a running query.
    if (replacing) replacementCallback.current?.();
    onChanged?.(previous,next);
    return true;
  }, []);
  return [value,commit,getReplacementVersion,getEditVersion] as const;
}
