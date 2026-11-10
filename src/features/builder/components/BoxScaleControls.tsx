import { useId, useRef, useState } from "react";
import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { canvasHeight, canvasWidth, chartFrameMinimum } from "../builderConstants";
import { boxScalePercentages, proportionalBoxSize } from "./boxScale";

type Props = { layout: CanvasLayout; locked: boolean; staged: boolean; itemKind?: "chart" | "element"; onApply: (change: Partial<CanvasLayout>) => void };
export function BoxScaleControls({ layout, locked, staged, itemKind = "chart", onApply }: Props) {
  const helpId = useId(), [choice, setChoice] = useState({ percentage: 100, width: layout.width, height: layout.height }), currentChoice = useRef(choice);
  const [issue, setIssue] = useState("");
  const stale = choice.percentage !== 100 && (choice.width !== layout.width || choice.height !== layout.height);
  let proposal: Pick<CanvasLayout, "width" | "height"> | null = null, unsupported = "";
  try { proposal = proportionalBoxSize(layout, choice.percentage, itemKind === "chart" ? chartFrameMinimum : { width: 0, height: 0 }); }
  catch (error) { unsupported = error instanceof Error ? error.message : "This box cannot be resized safely."; }
  const blocked = locked || staged || stale || !!unsupported || !proposal;
  function reset() { const next = { percentage: 100, width: layout.width, height: layout.height }; currentChoice.current = next; setChoice(next); setIssue(""); }
  function apply() {
    if (locked || staged) return;
    const selected = currentChoice.current;
    if (selected.percentage !== 100 && (selected.width !== layout.width || selected.height !== layout.height)) { setIssue("The box size changed after the percentage was chosen. Reset the choice or choose a percentage again for the current box."); return; }
    let next: Pick<CanvasLayout, "width" | "height"> | null;
    try { next = proportionalBoxSize(layout, selected.percentage, itemKind === "chart" ? chartFrameMinimum : { width: 0, height: 0 }); }
    catch (error) { setIssue(error instanceof Error ? error.message : "The box was kept."); return; }
    if (!next) return;
    try { onApply(next); reset(); }
    catch { setIssue("Resize could not be confirmed. Check the current size before trying again."); }
  }
  const outside = proposal && (layout.x < 0 || layout.y < 0 || layout.x + proposal.width > canvasWidth || layout.y + proposal.height > canvasHeight);
  return <details data-canvas-keyboard-scope="controls" className="box-scale-controls">
    <summary onClick={event => { if (document.activeElement !== event.currentTarget && event.currentTarget.parentElement?.contains(document.activeElement)) event.currentTarget.focus(); }}>Resize box proportionally</summary>
    <p id={helpId}>Multiply the current width and height by the same percentage in one undoable action. The top-left position, content, fonts and chart styling stay unchanged. This resizes the box, not its contents; text and marks may clip. The choice is temporary and applies only when you select Apply proportional box size.</p>
    <label>Box-size percentage<select value={choice.percentage} aria-disabled={locked || staged} aria-describedby={helpId} onPointerDown={event => { if (locked || staged) event.preventDefault(); }} onMouseDown={event => { if (locked || staged) event.preventDefault(); }} onChange={event => { if (locked || staged) return; const percentage = Number(event.target.value); if (!boxScalePercentages.some(value => value === percentage)) return; const next = { percentage, width: layout.width, height: layout.height }; currentChoice.current = next; setChoice(next); setIssue(""); }}>{boxScalePercentages.map(value => <option key={value} value={value}>{value}% of current size</option>)}</select></label>
    <p role="status">{locked ? "Unlock this item before resizing." : staged ? "Finish or cancel the numeric edit before proportional resizing. Its unfinished entry is kept." : stale ? "The box size changed after this choice. Reset or choose a percentage again; the current size is kept." : unsupported || (proposal ? `Proposed size: width ${proposal.width}, height ${proposal.height}.` : "100% keeps the current size. No change needed.")}</p>
    {outside && <p>The proposed box extends beyond the page. Its position will not move; review the result or use Fit box within page afterward.</p>}
    <button type="button" aria-disabled={blocked} aria-describedby={helpId} onPointerDown={event => { if (blocked) event.preventDefault(); }} onMouseDown={event => { if (blocked) event.preventDefault(); }} onClick={apply}>Apply proportional box size</button>
    <button type="button" aria-disabled={locked || staged} onPointerDown={event => { if (locked || staged) event.preventDefault(); }} onMouseDown={event => { if (locked || staged) event.preventDefault(); }} onClick={() => { if (!locked && !staged) reset(); }}>Reset box-size choice</button>
    {issue && <p role="alert">{issue}</p>}
  </details>;
}
