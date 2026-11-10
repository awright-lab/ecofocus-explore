import { useId, useState } from "react";
import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { canvasHeight, canvasWidth, chartFrameMinimum } from "../builderConstants";
import { fitLayoutBox } from "./layoutFit";
import "./layout-fit-controls.css";

export function LayoutFitControls({ layout, locked, staged, itemKind = "chart", onApply }: { layout: CanvasLayout; locked: boolean; staged: boolean; itemKind?: "chart" | "element"; onApply: (change: Partial<CanvasLayout>) => void }) {
  const helpId = useId(), [issue, setIssue] = useState("");
  let next: Partial<CanvasLayout> | null = null, unsupported = "";
  try { next = fitLayoutBox(layout, canvasWidth, canvasHeight, itemKind === "element" ? { width: 0, height: 0 } : chartFrameMinimum); }
  catch (error) { unsupported = error instanceof Error ? error.message : "The geometry is unsupported. The box was kept."; }
  const blocked = locked || staged || !!unsupported || !next;
  function apply() {
    if (blocked || !next) return;
    setIssue("");
    try { onApply(next); }
    catch { setIssue("Fit could not be confirmed. Check the current box before trying again."); }
  }
  return <section className="layout-fit" aria-label="Fit selected box within page" aria-describedby={helpId}>
    <h3>Keep the box on the page</h3>
    <p id={helpId}>Bring the selected box inside the {canvasWidth} × {canvasHeight} page. Oversized boxes shrink proportionally; smaller boxes keep their size. Text, fonts and chart contents are unchanged and may still clip. Review the result before exporting. Undo restores the previous box.</p>
    {itemKind === "chart" && <p>Chart boxes must remain at least {chartFrameMinimum.width} × {chartFrameMinimum.height}. Extreme aspect ratios may require a manual size change.</p>}
    <p role="status">{locked ? "Unlock this item before fitting its box." : staged ? "Finish or cancel the numeric edit before fitting the box." : unsupported || (!next ? "The box is already inside the page. No change needed." : `Proposed box: X ${next.x}, Y ${next.y}; width ${next.width}, height ${next.height}.`)}</p>
    <button type="button" aria-disabled={blocked} aria-describedby={helpId} onPointerDown={event => { if (blocked) event.preventDefault(); }} onMouseDown={event => { if (blocked) event.preventDefault(); }} onClick={apply}>Fit box within page</button>
    {issue && <p role="alert">{issue}</p>}
  </section>;
}
