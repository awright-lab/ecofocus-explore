import type { CanvasLayout, DashboardPage } from "../../../shared/types/dashboard";
import { canvasHeight, canvasWidth } from "./builderConstants";
import { nextZIndex } from "../document/documentModel";

export type AnalysisDestination = "current_page" | "new_page";
export function resolveAnalysisPage(pages: DashboardPage[], activeId: string, documentId: string, origins: ReadonlyMap<string, string>) {
  const visited = new Set<string>();
  let candidate: string | undefined = activeId;
  while (candidate && !visited.has(candidate)) {
    const existing = pages.find(page => page.id === candidate);
    if (existing) return existing;
    visited.add(candidate);
    candidate = origins.get(JSON.stringify([documentId, candidate]));
  }
  return pages[0];
}
const width = 760, height = 460, margin = 24;

// Default analytical placement leaves existing objects untouched. Explicit drag
// positions retain their separate composition behavior.
export function findAnalysisPlacement(page: DashboardPage, preferred = { x: 48, y: 72 }): CanvasLayout | null {
  const occupied = [...page.tiles, ...page.elements].map(item => item.layout).sort((a, b) => a.y - b.y);
  const inside = (x: number, y: number) => x >= margin && y >= margin && x + width <= canvasWidth - margin && y + height <= canvasHeight - margin;
  const overlaps = (x: number, y: number, box: CanvasLayout) => x < box.x + box.width + margin && x + width + margin > box.x && y < box.y + box.height + margin && y + height + margin > box.y;
  const layout = (x: number, y: number): CanvasLayout => ({ x, y, width, height, zIndex: nextZIndex(page) });
  if (inside(preferred.x, preferred.y) && !occupied.some(box => overlaps(preferred.x, preferred.y, box))) return layout(preferred.x, preferred.y);
  const candidates = new Set([margin, preferred.x, ...occupied.map(box => box.x + box.width + margin)]);
  for (const x of candidates) {
    if (!inside(x, margin)) continue;
    let y = margin;
    for (const box of occupied) if (overlaps(x, y, box)) y = Math.max(y, box.y + box.height + margin);
    if (inside(x, y)) return layout(x, y);
  }
  return null;
}
