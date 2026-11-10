import type { DashboardPage } from "../../../shared/types/dashboard";
import { planPptxLayers, pptxLayerLimits } from "./pptxLayerPlan";

export type PptxObjectMode = "Editable object" | "Editable chart body" | "Slide image" | "Image layer";
export interface PptxObjectReview { id: string; name: string; mode: PptxObjectMode }
export type PptxEditabilityReview = { available: false } | {
  available: true; mode: "hybrid" | "complete_visual"; reason?: string;
  editableObjects: number; editableCharts: number; imageObjects: number; rasterLayers: number;
  objects: PptxObjectReview[]; detailsOmitted: boolean;
};

/** Same layer policy and eligibility predicates as buildPptxBlob. No rendering or download. */
export function reviewPptxEditability(page: DashboardPage): PptxEditabilityReview {
  try {
    const plan = planPptxLayers(page);
    const elements = page.elements.filter(e => !e.hidden), tiles = page.tiles.filter(t => !t.hidden);
    if (page.elements.length + page.tiles.length > pptxLayerLimits.objects) {
      return { available: true, mode: "complete_visual", reason: plan.mode === "complete_visual" ? plan.reason : undefined,
        editableObjects: 0, editableCharts: 0, imageObjects: elements.length + tiles.length, rasterLayers: 1, objects: [], detailsOmitted: true };
    }
    const objects: PptxObjectReview[] = plan.mode === "hybrid" ? plan.layers.flatMap((layer):PptxObjectReview[] => {
      if (layer.kind === "background") return [];
      if (layer.kind === "element") return [{ id: layer.element.id, name: layer.element.name || layer.element.type, mode: layer.editable ? "Editable object" : "Image layer" }];
      return [{ id: layer.tile.id, name: layer.tile.title || layer.tile.name, mode: layer.native ? "Editable chart body" : "Image layer" }];
    }) : [
      ...elements.map(e => ({ id: e.id, name: e.name || e.type, mode: "Slide image" as const })),
      ...tiles.map(t => ({ id: t.id, name: t.title || t.name, mode: "Slide image" as const }))
    ];
    return { available: true, mode: plan.mode, reason: plan.mode === "complete_visual" ? plan.reason : undefined,
      editableObjects: objects.filter(o => o.mode === "Editable object").length,
      editableCharts: objects.filter(o => o.mode === "Editable chart body").length,
      imageObjects: objects.filter(o => o.mode === "Slide image" || o.mode === "Image layer").length, rasterLayers: plan.mode === "complete_visual" ? 1 : plan.layers.filter(layer => layer.kind !== "element" || !layer.editable).length, objects, detailsOmitted: false };
  } catch { return { available: false }; }
}
