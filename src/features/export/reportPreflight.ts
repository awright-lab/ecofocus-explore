import { planPptxLayers } from "./pptxLayerPlan";
import type { DashboardDraft } from "../../../shared/types/dashboard";
import { narrativeState } from "../narratives/narrativeEvidence";
import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import { assertExportResultsCurrent } from "./exportIntegrity";
import { inspectPageVisualSvg } from "./pageVisualExport";

export interface PreflightIssue { check: "Page boundary" | "Layout overlap" | "Analysis" | "Image" | "PDF layout" | "Narrative evidence" | "PowerPoint layers"; message: string; objectId?: string }
export function buildReportPreflight(dashboard: DashboardDraft) {
  return [...dashboard.pages].sort((a, b) => a.order - b.order).map(page => {
    const issues: PreflightIssue[] = [];
    for(const element of page.elements.filter(element=>!element.hidden)){
      const state=narrativeState(element,dashboard.pages);
      if(state&&!state.current)issues.push({check:"Narrative evidence",objectId:element.id,message:`${element.name}: ${state.reasons.join(" ")}`});
    }
    for (const object of [...page.elements, ...page.tiles].filter(object => !object.hidden)) {
      const { x, y, width, height } = object.layout ?? { x: NaN, y: NaN, width: NaN, height: NaN };
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        issues.push({ check: "Page boundary", objectId: object.id, message: `"${object.name}" has an invalid size or position.` });
      } else if (x < 0 || y < 0 || x + width > canvasWidth || y + height > canvasHeight) {
        issues.push({ check: "Page boundary", objectId: object.id, message: `"${object.name}" extends beyond the page and may be clipped.` });
      }
    }
    const visibleTiles = page.tiles.filter(tile => !tile.hidden);
    for (let first = 0; first < visibleTiles.length; first++) for (let second = first + 1; second < visibleTiles.length; second++) {
      const left = visibleTiles[first], right = visibleTiles[second], a = left.layout, b = right.layout;
      if (a && b && [a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height].every(Number.isFinite) &&
          a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) {
        issues.push({ check: "Layout overlap", objectId: left.id, message: `"${left.title || left.name}" and "${right.title || right.name}" overlap. Check their visibility and layer order in the preview.` });
      }
    }
    for (const tile of visibleTiles) {
      try { assertExportResultsCurrent([{ ...page, elements: [], tiles: [tile] }], dashboard.pages); }
      catch (error) { issues.push({ check: "Analysis", objectId: tile.id, message: error instanceof Error && !(error instanceof TypeError) ? error.message : `Refresh "${tile.title || tile.name}" to validate its analysis settings.` }); }
    }
    for (const element of page.elements.filter(element => !element.hidden && element.type === "image" && (typeof element.content !== "string" || !element.content.trim()))) {
      issues.push({ check: "Image", objectId: element.id, message: `"${element.name}" has no image content.` });
    }
    if (page.backgroundMode === "image" && (typeof page.backgroundImage !== "string" || !page.backgroundImage.trim())) issues.push({ check: "Image", message: "The page background image is missing." });
    const powerpoint = planPptxLayers(page);
    if (powerpoint.mode === "complete_visual") issues.push({check: "PowerPoint layers", objectId: powerpoint.objectId, message: powerpoint.reason});
    const visual=inspectPageVisualSvg(page),pdfSvg=visual.svg;
    for(const failure of visual.failures)issues.push({check:"PDF layout",objectId:failure.objectId,message:failure.objectName?`"${failure.objectName}": ${failure.message}`:failure.message});
    return { pageId: page.id, title: page.title, issues, pdfSvg };
  });
}
