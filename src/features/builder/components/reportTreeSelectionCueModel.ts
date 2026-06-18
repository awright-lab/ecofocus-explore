import type { DashboardCanvasElement, DashboardTile } from "../../../../shared/types/dashboard";
import type { ReportTreeSelectionCue } from "../builderTypes";

export interface ReportTreeSelectionCueView {
  label: string;
  message: string;
  helper: string;
}

export function buildReportTreeSelectionCueView(
  cue: ReportTreeSelectionCue,
  selectedObject: DashboardTile | DashboardCanvasElement,
  objectKind: "tile" | "element",
  now = Date.now()
): ReportTreeSelectionCueView | null {
  if (!cue || cue.objectId !== selectedObject.id || cue.objectKind !== objectKind) return null;
  if (now - cue.createdAt > 60_000) return null;

  return {
    label: "Selected from report tree",
    message: `${cue.objectLabel} was opened from ${cue.pageTitle}.`,
    helper: `${cue.objectType} context from the expanded page row. Continue editing from this inspector or the canvas.`
  };
}
