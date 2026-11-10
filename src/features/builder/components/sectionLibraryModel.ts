import { compositionBlockCategoryLabel } from "./compositionBlockModel";
import type { DashboardPage, SavedCompositionBlock } from "../../../../shared/types/dashboard";

export const sectionLibraryLimits = { pageSize: 12, previewObjects: 80, query: 200 } as const;
export type SectionSource = "curated" | "saved";
export interface SectionEntry { source: SectionSource; id: string; block: SavedCompositionBlock }
export interface SectionCriteria { query: string; source: "all" | SectionSource; category: string }
export const sectionKey = (entry: Pick<SectionEntry, "source" | "id">) => JSON.stringify([entry.source, entry.id]);
export function searchSections(curated: SavedCompositionBlock[], saved: SavedCompositionBlock[], criteria: SectionCriteria, requestedPage = 0) {
  const query = criteria.query.trim().toLowerCase();
  const entries: SectionEntry[] = [];
  if (criteria.query.trim().length > sectionLibraryLimits.query) return { entries, total: 0, page: 0, issue: "Use 200 characters or fewer." };
  let total = 0;
  // Only library metadata is searched. No item content, images, query definitions or result cells.
  const visit = (source: SectionSource, blocks: SavedCompositionBlock[], collect: boolean, page: number) => {
    for (const block of blocks) {
      if (criteria.source !== "all" && criteria.source !== source || criteria.category && block.category !== criteria.category) continue;
      if (query && ![block.label, block.description, compositionBlockCategoryLabel(block.category)].some(value => value.toLowerCase().includes(query))) continue;
      if (collect && total >= page * sectionLibraryLimits.pageSize && entries.length < sectionLibraryLimits.pageSize) entries.push({ source, id: block.id, block });
      total++;
    }
  };
  visit("curated", curated, false, 0); visit("saved", saved, false, 0);
  const page = Math.min(Math.max(0, Math.floor(requestedPage)), Math.max(0, Math.ceil(total / sectionLibraryLimits.pageSize) - 1));
  total = 0; visit("curated", curated, true, page); visit("saved", saved, true, page);
  return { entries, total, page, issue: "" };
}
export function sectionGeometry(block: SavedCompositionBlock) {
  const counts = { analyses: 0, text: 0, shapes: 0, images: 0, hidden: 0, locked: 0 };
  const issues: string[] = [], partial: string[] = [];
  let minX = 0, minY = 0, maxX = block.summary.width, maxY = block.summary.height;
  if (![maxX, maxY].every(value => Number.isFinite(value) && value >= 0)) issues.push("Stored dimensions are invalid.");
  const ids = new Set<string>();
  for (const item of block.items) {
    const object = item.kind === "tile" ? item.tile : item.element, layout = item.relativeLayout;
    if (!object || !layout) { issues.push("Stored objects or relative geometry are missing."); continue; }
    const key = JSON.stringify([item.kind, object.id]);
    if (ids.has(key)) issues.push("Object identities are ambiguous."); ids.add(key);
    if (![layout.x, layout.y, layout.width, layout.height, layout.zIndex].every(Number.isFinite) || layout.width <= 0 || layout.height <= 0) issues.push("Relative geometry is invalid.");
    minX = Math.min(minX, layout.x); minY = Math.min(minY, layout.y); maxX = Math.max(maxX, layout.x + layout.width); maxY = Math.max(maxY, layout.y + layout.height);
    if (object.hidden) counts.hidden++; if (object.locked) counts.locked++;
    if (item.kind === "tile") counts.analyses++;
    else if (item.element.type === "text") counts.text++;
    else if (item.element.type === "image") { counts.images++; if (item.element.content && !/^data:image\/(png|jpeg|gif|webp|svg\+xml)(;|,)/i.test(item.element.content)) partial.push("External or unsupported images are not loaded in previews."); }
    else if (item.element.type === "circle" || item.element.type === "rectangle") { counts.shapes++; if (item.element.type === "circle" && layout.width !== layout.height) issues.push("Non-square ellipses cannot be previewed faithfully."); }
    else issues.push("An object type is unsupported.");
  }
  if (block.items.length > sectionLibraryLimits.previewObjects) issues.push(`Visual preview supports at most ${sectionLibraryLimits.previewObjects} objects per section.`);
  if (block.summary.objectCount !== block.items.length || block.summary.tileCount !== counts.analyses || block.summary.elementCount !== block.items.length - counts.analyses) issues.push("Stored object counts do not match the section. Resave the block.");
  if (Math.max(maxX - minX, maxY - minY) > 100000) issues.push("The stored footprint is too large to preview safely.");
  return { counts, viewport: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }, issue: [...new Set(issues)].join(" "), partial: [...new Set(partial)].join(" ") };
}
/** Matches the canvas's stable z-order: elements precede analyses at equal z positions. */
export function orderedSectionItems(block: SavedCompositionBlock) {
  return block.items.map((item, index) => ({ item, index })).sort((a, b) => a.item.relativeLayout.zIndex - b.item.relativeLayout.zIndex || (a.item.kind === b.item.kind ? a.index - b.index : a.item.kind === "element" ? -1 : 1)).map(entry => entry.item);
}
export interface SectionReceipt { source: SectionSource; id: string; signature: string; snapshot: SavedCompositionBlock; destination: DashboardPage; destinationId: string; destinationSignature: string }
export function inspectSection(entry: SectionEntry, destination: DashboardPage): SectionReceipt {
  const signature = JSON.stringify(entry.block);
  return { source: entry.source, id: entry.id, signature, snapshot: structuredClone(entry.block), destination, destinationId: destination.id, destinationSignature: JSON.stringify(destination) };
}
export function resolveSection(receipt: SectionReceipt, curated: SavedCompositionBlock[], saved: SavedCompositionBlock[]) {
  const candidates = (receipt.source === "curated" ? curated : saved).filter(block => block.id === receipt.id);
  if (candidates.length !== 1) return { block: null, issue: "This section was deleted or its identity is ambiguous. Return to the gallery and choose again." };
  if (JSON.stringify(candidates[0]) !== receipt.signature) return { block: null, issue: "This section changed after inspection. Return to the gallery and review it again." };
  return { block: candidates[0], issue: "" };
}
export function currentSectionDestination(receipt: SectionReceipt, pages: DashboardPage[], active: DashboardPage) {
  return active === receipt.destination && active.id === receipt.destinationId && pages.filter(page => page.id === receipt.destinationId).length === 1 && pages.includes(active) && JSON.stringify(active) === receipt.destinationSignature;
}
export function resolveSectionInsertion(receipt: SectionReceipt, curated: SavedCompositionBlock[], saved: SavedCompositionBlock[], pages: DashboardPage[], active: DashboardPage) {
  const resolved = resolveSection(receipt, curated, saved);
  if (!resolved.block) return resolved;
  if (!currentSectionDestination(receipt, pages, active)) return { block: null, issue: "The destination changed or is ambiguous. Return to the gallery and review the section for the current page." };
  const geometry = sectionGeometry(resolved.block);
  if (geometry.issue || !resolved.block.items.length) return { block: null, issue: geometry.issue || "This section is empty; there is nothing to insert." };
  // Normalize the insertion copy only. Existing callbacks assign sequential z positions in item order.
  return { block: { ...resolved.block, items: orderedSectionItems(resolved.block) }, issue: "" };
}
