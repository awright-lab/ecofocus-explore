import type { DashboardPage } from "../../../shared/types/dashboard";
import { canReconstructElementInPptx } from "./pptxEditableReconstruction";
import { canReconstructTileAsNativePptxChart } from "./pptxNativeCharts";
import { planPptxLayers, pptxLayerLimits } from "./pptxLayerPlan";

export type PptxObjectMode = "Editable object" | "Editable chart body" | "Slide image";
export interface PptxObjectReview { id: string; name: string; mode: PptxObjectMode }
export type PptxEditabilityReview = { available: false } | {
  available: true; mode: "hybrid" | "complete_visual"; reason?: string;
  editableObjects: number; editableCharts: number; imageObjects: number;
  objects: PptxObjectReview[]; detailsOmitted: boolean;
};

/** Same layer policy and eligibility predicates as buildPptxBlob. No rendering or download. */
export function reviewPptxEditability(page: DashboardPage): PptxEditabilityReview {
  try {
    const plan = planPptxLayers(page);
    const elements = page.elements.filter(e => !e.hidden), tiles = page.tiles.filter(t => !t.hidden);
    if (page.elements.length + page.tiles.length > pptxLayerLimits.objects) {
      return { available: true, mode: "complete_visual", reason: plan.mode === "complete_visual" ? plan.reason : undefined,
        editableObjects: 0, editableCharts: 0, imageObjects: elements.length + tiles.length, objects: [], detailsOmitted: true };
    }
    const objects: PptxObjectReview[] = [
      ...elements.map(e => ({ id: e.id, name: e.name || e.type, mode: plan.mode === "hybrid" && canReconstructElementInPptx(e) ? "Editable object" as const : "Slide image" as const })),
      ...tiles.map(t => ({ id: t.id, name: t.title || t.name, mode: plan.mode === "hybrid" && canReconstructTileAsNativePptxChart(t) ? "Editable chart body" as const : "Slide image" as const }))
    ];
    return { available: true, mode: plan.mode, reason: plan.mode === "complete_visual" ? plan.reason : undefined,
      editableObjects: objects.filter(o => o.mode === "Editable object").length,
      editableCharts: objects.filter(o => o.mode === "Editable chart body").length,
      imageObjects: objects.filter(o => o.mode === "Slide image").length, objects, detailsOmitted: false };
  } catch { return { available: false }; }
}
