import { useId, useRef, useState } from "react";
import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { layoutMove, layoutMoveDistances, type LayoutMoveDirection } from "./layoutNudge";
import "./layout-nudge-controls.css";

export function LayoutNudgeControls({ layout, locked, staged, onApply }: { layout: CanvasLayout; locked: boolean; staged: boolean; onApply: (change: Partial<CanvasLayout>) => void }) {
  const helpId = useId(), [distance, setDistance] = useState<number>(1), selectedDistance = useRef(1), [issue, setIssue] = useState("");
  const blocked = locked || staged;
  function move(direction: LayoutMoveDirection) {
    if (blocked) return;
    let change: Partial<CanvasLayout>;
    try { change = layoutMove(layout, direction, selectedDistance.current); }
    catch (error) { setIssue(error instanceof Error ? error.message : "The requested geometry is unsupported. Position was kept."); return; }
    setIssue("");
    try { onApply(change); }
    catch { setIssue("Move could not be confirmed. Check the current position before trying again."); }
  }
  return <section className="layout-nudge" aria-label="Move selected item" aria-describedby={helpId}>
    <h3>Move selected item</h3>
    <label>Move distance (page units)<select value={distance} aria-describedby={helpId} aria-disabled={locked} onChange={event => { if (locked) return; const next = Number(event.target.value); if (!layoutMoveDistances.some(value => value === next)) return; selectedDistance.current = next; setDistance(next); setIssue(""); }}>{layoutMoveDistances.map(value => <option key={value} value={value}>{value} {value === 1 ? "unit" : "units"}</option>)}</select></label>
    <div className="layout-nudge__buttons" role="group" aria-label="Move direction">{(["up", "left", "right", "down"] as const).map(direction => <button key={direction} type="button" aria-describedby={helpId} aria-disabled={blocked} aria-label={`Move selected item ${direction} by ${distance} page ${distance === 1 ? "unit" : "units"}`} onPointerDown={event => { if (blocked) event.preventDefault(); }} onMouseDown={event => { if (blocked) event.preventDefault(); }} onClick={() => move(direction)}>Move {direction}</button>)}</div>
    <p id={helpId}>{locked ? "Unlock this item before moving it." : staged ? "Finish the numeric edit with Enter or cancel it with Escape before moving. Clicking a move button keeps the unfinished entry intact." : "Move without dragging or calculating a new coordinate. Distances use page units, independent of zoom and grid snapping. Each move can be undone. Negative positions are allowed, so an item can move beyond the page."}</p>
    <p role="status">Current position: X {layout.x}, Y {layout.y}.</p>
    {issue && <p role="alert">{issue}</p>}
  </section>;
}
