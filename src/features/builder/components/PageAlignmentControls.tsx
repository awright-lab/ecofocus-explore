import { useId, useState } from "react";
import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { canvasHeight, canvasWidth, chartFrameMinimum } from "../builderConstants";
import { pageAlignment, pageAlignmentActions, type PageAlignment } from "./pageAlignment";
import "./page-alignment-controls.css";

export function PageAlignmentControls({ layout, locked, staged, itemKind = "chart", onApply }: {
  layout: CanvasLayout; locked: boolean; staged: boolean; itemKind?: "chart" | "element"; onApply: (change: Partial<CanvasLayout>) => void;
}) {
  const helpId = useId(), [issue, setIssue] = useState("");
  const proposals = new Map<PageAlignment, Partial<CanvasLayout> | null>();
  let unsupported = "";
  try { for (const action of pageAlignmentActions) proposals.set(action.id, pageAlignment(layout, action.id, canvasWidth, canvasHeight, itemKind === "chart" ? chartFrameMinimum : { width: 0, height: 0 })); }
  catch (error) { unsupported = error instanceof Error ? error.message : "This box cannot be aligned safely. Position was kept."; }
  const blocked = locked || staged || !!unsupported;
  function apply(direction: PageAlignment) {
    const change = proposals.get(direction);
    if (blocked || !change) return;
    setIssue("");
    try { onApply(change); }
    catch { setIssue("Alignment could not be confirmed. Check the current position before trying again."); }
  }
  return <details className="page-alignment" data-canvas-keyboard-scope="controls">
    <summary onClick={event => {
      // An explicit collapse must not leave a descendant button focused but hidden.
      // Outside focus or a deliberate blur is not permission to move focus here.
      const owner = document.activeElement;
      if (owner !== event.currentTarget && event.currentTarget.parentElement?.contains(owner)) event.currentTarget.focus();
    }}>Align box to page</summary>
    <p id={helpId}>Position one selected box against the {canvasWidth} x {canvasHeight} page without dragging. Size, content and layer order stay unchanged. Each action can be undone. This aligns the box, not its text or visible marks.</p>
    {(["horizontal", "vertical"] as const).map(axis => <div key={axis} role="group" aria-label={`${axis === "horizontal" ? "Horizontal" : "Vertical"} page alignment`}>
      {pageAlignmentActions.filter(action => action.axis === axis).map(action => {
        const next = proposals.get(action.id), disabled = blocked || !next;
        return <button key={action.id} type="button" aria-label={action.label} aria-describedby={helpId} aria-disabled={disabled}
          title={blocked ? undefined : next ? `Proposed ${Object.hasOwn(next, "x") ? `X ${next.x}` : `Y ${next.y}`}` : "Already aligned"}
          onPointerDown={event => { if (disabled) event.preventDefault(); }} onMouseDown={event => { if (disabled) event.preventDefault(); }} onClick={() => apply(action.id)}>{action.text}</button>;
      })}
    </div>)}
    <p role="status">{locked ? "Unlock this item before aligning its box." : staged ? "Finish or cancel the numeric edit before aligning. The unfinished entry is kept." : unsupported || `Current position: X ${layout.x}, Y ${layout.y}.`}</p>
    {!unsupported && (layout.width > canvasWidth || layout.height > canvasHeight) && <p>The box is larger than the page. Center or far-edge alignment can leave part outside the page. Use Fit box within page when you need containment.</p>}
    {issue && <p role="alert">{issue}</p>}
  </details>;
}
