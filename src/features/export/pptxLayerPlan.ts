import type { DashboardPage, DashboardCanvasElement, DashboardTile } from "../../../shared/types/dashboard";
import { analysisVisualLayout } from "./analysisVisualExport";
import { canReconstructElementInPptx } from "./pptxEditableReconstruction";
import { canReconstructTileAsNativePptxChart } from "./pptxNativeCharts";

export const pptxLayerLimits = { objects: 500, rasterLayers: 64 } as const;
export type PptxLayer =
  | { kind: "background" }
  | { kind: "element"; element: DashboardCanvasElement; editable: boolean }
  | { kind: "tile"; tile: DashboardTile; native: boolean };
export type PptxLayerPlan = { mode: "hybrid"; layers: PptxLayer[] } | { mode: "complete_visual"; reason: string; objectId?: string; coveredObjectId?: string };
type Rect = { x: number; y: number; width: number; height: number };
const valid=(r:Rect)=>[r.x,r.y,r.width,r.height,r.x+r.width,r.y+r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
const fallback=(reason:string):PptxLayerPlan=>({mode:'complete_visual',reason:`${reason} The slide uses one complete image to preserve its rendered composition; it will not contain native editable objects.`});

/** Same stable elements-before-tiles tie order as the full-page SVG renderer.
 * A tile's context and chart body stay adjacent, below the next authored object.
 * References are read-only; the exporter snapshots its inputs before awaiting. */
export function planPptxLayers(page: DashboardPage): PptxLayerPlan {
  if(page.elements.length+page.tiles.length>pptxLayerLimits.objects)return fallback('The page exceeds the bounded layer inspection.');
  try{
    const objects=[
      ...page.elements.filter(e=>!e.hidden).map(element=>({z:element.layout.zIndex,layer:{kind:'element',element,editable:canReconstructElementInPptx(element)} as PptxLayer,rect:element.layout})),
      ...page.tiles.filter(t=>!t.hidden).map(tile=>({z:tile.layout.zIndex,layer:{kind:'tile',tile,native:canReconstructTileAsNativePptxChart(tile)} as PptxLayer,rect:tile.layout}))
    ].sort((a,b)=>a.z-b.z);
    if(new Set(objects.map(o=>o.layer.kind==='element'?o.layer.element.id:o.layer.kind==='tile'?o.layer.tile.id:'')).size!==objects.length)return fallback('Visible objects have ambiguous identities.');
    if(objects.some(o=>!Number.isFinite(o.z)||!valid(o.rect)||(o.layer.kind==='tile'&&o.layer.native&&!valid(analysisVisualLayout(o.layer.tile).area))))return fallback('The page has geometry whose layered order cannot be verified.');
    const layers:PptxLayer[]=[{kind:'background'},...objects.map(o=>o.layer)];
    if(layers.filter(layer=>layer.kind!=='element'||!layer.editable).length>pptxLayerLimits.rasterLayers)return fallback('The page exceeds the bounded transparent raster-layer budget.');
    return{mode:'hybrid',layers};
  }catch{return fallback('Layer eligibility could not be checked; invalid analytical content still blocks export.');}
}
