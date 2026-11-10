import type { DashboardPage } from "../../../shared/types/dashboard";
import { analysisVisualLayout } from "./analysisVisualExport";
import { canReconstructElementInPptx } from "./pptxEditableReconstruction";
import { canReconstructTileAsNativePptxChart } from "./pptxNativeCharts";

export const pptxLayerLimits = { objects: 500, overlapChecks: 100_000 } as const;
export type PptxLayerPlan = { mode: "hybrid" } | { mode: "complete_visual"; reason: string; objectId?: string; coveredObjectId?: string };
type Rect = { x: number; y: number; width: number; height: number };
const valid=(r:Rect)=>[r.x,r.y,r.width,r.height,r.x+r.width,r.y+r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

/** Preserve the complete-page renderer's order when hybrid layers would reverse it. */
export function planPptxLayers(page: DashboardPage): PptxLayerPlan {
  if(page.elements.length+page.tiles.length>pptxLayerLimits.objects)return{mode:'complete_visual',reason:'The page exceeds the bounded hybrid-layer inspection. A complete slide image preserves its rendered order; its objects remain editable in the builder.'};
  try{
    // Same stable element-then-tile order and z-index sort as buildPageVisualSvg.
    const objects=[
      ...page.elements.filter(e=>!e.hidden).map(e=>({id:e.id,label:e.name||e.type,rect:e.layout,z:e.layout.zIndex,kind:canReconstructElementInPptx(e)?'editable':'visual',overlay:e.layout})),
      ...page.tiles.filter(t=>!t.hidden).map(t=>{const native=canReconstructTileAsNativePptxChart(t);return{id:t.id,label:t.title||t.name,rect:t.layout,z:t.layout.zIndex,kind:native?'native':'visual',overlay:native?analysisVisualLayout(t).area:t.layout};})
    ].sort((a,b)=>a.z-b.z);
    if(objects.some(o=>!Number.isFinite(o.z)||!valid(o.rect)||!valid(o.overlay)))return{mode:'complete_visual',reason:'The page has geometry whose hybrid order cannot be verified. A complete slide image uses the existing full-page render; export still validates that render.'};
    let checked=0;
    for(let i=0;i<objects.length;i++){
      const lower=objects[i];if(lower.kind==='visual')continue;
      for(let j=i+1;j<objects.length;j++){
        const upper=objects[j];
        // All editable objects are emitted after native charts and the image,
        // in their own source order. Two editable objects retain that order.
        if(upper.kind==='editable')continue;
        if(++checked>pptxLayerLimits.overlapChecks)return{mode:'complete_visual',reason:'The hybrid-overlap check reached its bounded limit. A complete slide image preserves the full rendered composition.'};
        // Native chart bodies are overlays, but their titles/context remain in
        // the image. A lower native body can cover a higher tile's context.
        if(overlaps(lower.overlay,upper.rect))return{mode:'complete_visual',objectId:lower.id,coveredObjectId:upper.id,reason:`"${lower.label}" belongs behind "${upper.label}", but editable PowerPoint layers would place it above that content. The slide uses one complete image to preserve the rendered order. Edit its objects in the builder; this slide will not contain native editable objects.`};
      }
    }
    return{mode:'hybrid'};
  }catch{return{mode:'complete_visual',reason:'Hybrid object ordering could not be checked. A complete slide image keeps the full-page renderer; invalid analytical content still blocks export.'};}
}
