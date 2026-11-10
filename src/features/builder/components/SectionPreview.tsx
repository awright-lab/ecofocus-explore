import { Component, type ReactNode } from "react";
import type { DashboardPage, SavedCompositionBlock } from "../../../../shared/types/dashboard";
import { DocumentPreview } from "../../document/DocumentPreview";
import { sectionGeometry } from "./sectionLibraryModel";

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <span>Stored content could not be previewed safely. No result was generated.</span> : this.props.children; }
}
/** A render-only adapter. No insertion, ID generation, time updates, provider calls or source mutation. */
export function sectionPreviewPage(block: SavedCompositionBlock): DashboardPage {
  const page: DashboardPage = { id: block.id, title: block.label, order: 1, showCanvasGrid: false, snapToGrid: false, gridSize: 40, background: "transparent", backgroundMode: "solid", backgroundPattern: "none", backgroundImage: "", backgroundImageFit: "contain", gradientFrom: "", gradientTo: "", gradientType: "linear", gradientAngle: 0, gradientStops: [], tiles: [], elements: [] };
  for (const item of block.items) {
    if (item.kind === "tile") page.tiles.push({ ...item.tile, layout: { ...item.relativeLayout } });
    else {
      const omittedImage = item.element.type === "image" && !/^data:image\/(png|jpeg|gif|webp|svg\+xml)(;|,)/i.test(item.element.content);
      page.elements.push({ ...item.element, layout: { ...item.relativeLayout }, ...(omittedImage ? { type: "text" as const, content: "Stored image · preview unavailable", style: { ...item.element.style, fill: "#e8ede8", textColor: "#526a5c", fontSize: 18, padding: 12 } } : {}) });
    }
  }
  return page;
}
export function SectionPreview({ block }: { block: SavedCompositionBlock }) {
  const geometry = sectionGeometry(block);
  return <div className="section-visual" data-section-preview>
    {geometry.issue ? <span className="section-preview-message">Preview unsupported: {geometry.issue}</span> : !block.items.length ? <span className="section-preview-message">Empty section · no stored objects</span> : <PreviewBoundary key={`${block.id}:${block.updatedAt ?? block.createdAt}`}><DocumentPreview page={sectionPreviewPage(block)} viewport={geometry.viewport}/></PreviewBoundary>}
  </div>;
}
