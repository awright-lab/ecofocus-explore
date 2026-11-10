import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";

export const reportObjectSearchLimits = { matches: 20, textCharacters: 2 * 1024 * 1024, queryCharacters: 200 } as const;
export type ReportObjectMatch = ({ kind: "tile"; page: DashboardPage; object: DashboardTile; excerpt: string } | { kind: "element"; page: DashboardPage; object: DashboardCanvasElement; excerpt: string }) & { identity?: { pageId: string; objectId: string } };
export interface ReportObjectSearch { pages: DashboardPage[]; matches: ReportObjectMatch[]; total: number; textIncluded: boolean; issue: string }
export function reportObjectMatchKey(match: ReportObjectMatch) { return JSON.stringify([match.identity?.pageId ?? match.page.id, match.kind, match.identity?.objectId ?? match.object.id]); }
const text = (value: unknown) => typeof value === "string" ? value : "";
function analysisNames(tile: DashboardTile) {
  const source = tile.result?.metadataRefs?.source;
  return [tile.title, tile.name, tile.source?.label, ...(source?.kind === "imported" ? [source.datasetLabel, source.primaryFieldLabel, source.bannerFieldLabel, source.measureFieldLabel] : [])].map(text).join(" ");
}
/** Read-only report navigation: never visits respondent rows, result cells or image payloads. */
export interface ReportObjectFilters {
  pageId?: string;
  type?: "tile" | "chart" | "table" | "text" | "image" | "shape";
  visibility?: "hidden" | "visible";
  locking?: "locked" | "unlocked";
}
export interface ReportObjectWindow { offset?: number; limit?: number; browse?: boolean; filters?: ReportObjectFilters; identity?: string }
export function searchReportObjects(pages: DashboardPage[], query: string, options: ReportObjectWindow = {}): ReportObjectSearch {
  const trimmed = query.trim(), normalized = trimmed.toLowerCase();
  if (!normalized && !options.browse) return { pages, matches: [], total: 0, textIncluded: true, issue: "" };
  if (trimmed.length > reportObjectSearchLimits.queryCharacters) return { pages, matches: [], total: 0, textIncluded: false, issue: "Use 200 characters or fewer to search this report." };
  let characters = 0, textIncluded = true;
  outer: for (const page of pages) for (const element of page.elements) if (element.type === "text") {
    characters += text(element.content).length;
    if (characters > reportObjectSearchLimits.textCharacters) { textIncluded = false; break outer; }
  }
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? reportObjectSearchLimits.matches)));
  const filters = options.filters ?? {};
  const visible: DashboardPage[] = [], matches: ReportObjectMatch[] = []; let total = 0;
  for (const page of pages) {
    let pageMatches = `${text(page.title)} ${page.order}`.toLowerCase().includes(normalized);
    const objects: ReportObjectMatch[] = [
      ...page.tiles.map(object => ({ kind: "tile" as const, page, object, excerpt: "" })),
      ...page.elements.map(object => ({ kind: "element" as const, page, object, excerpt: "" }))
    ];
    objects.sort((a, b) => (a.object.layout?.zIndex ?? 0) - (b.object.layout?.zIndex ?? 0));
    for (const entry of objects) {
      if (options.identity && reportObjectMatchKey(entry) !== options.identity) continue;
      if (filters.pageId && page.id !== filters.pageId) continue;
      const type = entry.kind === "tile" ? "tile" : entry.object.type === "rectangle" || entry.object.type === "circle" ? "shape" : entry.object.type;
      if (filters.type && type !== filters.type && !(entry.kind === "tile" && (filters.type === "table" ? entry.object.visualization === "table" : filters.type === "chart" && entry.object.visualization !== "table"))) continue;
      if (filters.visibility && Boolean(entry.object.hidden) !== (filters.visibility === "hidden")) continue;
      if (filters.locking && Boolean(entry.object.locked) !== (filters.locking === "locked")) continue;
      const names = entry.kind === "tile" ? analysisNames(entry.object) : text(entry.object.name);
      const content = textIncluded && entry.kind === "element" && entry.object.type === "text" ? text(entry.object.content) : "";
      const foldedContent = content.toLowerCase(), position = foldedContent.indexOf(normalized);
      if (!names.toLowerCase().includes(normalized) && position < 0) continue;
      pageMatches = true; total++;
      if (total > offset && matches.length < limit) {
        if (normalized && position >= 0 && foldedContent.length === content.length) { let start = Math.max(0, position - 35), end = Math.min(content.length, position + normalized.length + 60); if (start > 0 && /[\uDC00-\uDFFF]/u.test(content[start])) start--; if (end < content.length && /[\uD800-\uDBFF]/u.test(content[end - 1])) end++; entry.excerpt = `${start ? "…" : ""}${content.slice(start, end).replace(/\s+/gu, " ").trim()}${end < content.length ? "…" : ""}`; }
        if (options.browse && !entry.excerpt && content) {
          let end = Math.min(content.length, 140);
          if (end < content.length && /[\uD800-\uDBFF]/u.test(content[end - 1])) end++;
          entry.excerpt = `${content.slice(0, end).replace(/\s+/gu, " ").trim()}${end < content.length ? "…" : ""}`;
        }
        entry.identity = { pageId: page.id, objectId: entry.object.id };
        matches.push(entry);
      }
    }
    if (pageMatches) visible.push(page);
  }
  return { pages: visible, matches, total, textIncluded, issue: textIncluded ? "" : "Names-only results: the written text is too large to search at once. Names were searched completely; written text was not searched." };
}

/** Recheck an activated match against current report data; IDs are scoped to their page. */
export function resolveReportObjectMatch(pages: DashboardPage[], query: string, match: ReportObjectMatch, options: ReportObjectWindow = {}): ReportObjectMatch | null {
  const pageId = match.identity?.pageId ?? match.page.id, objectId = match.identity?.objectId ?? match.object.id;
  const page = pages.filter(item => item.id === pageId); if (page.length !== 1) return null;
  const objects = match.kind === "tile" ? page[0].tiles : page[0].elements;
  if (objects.filter(item => item.id === objectId).length !== 1) return null;
  return searchReportObjects(pages, query, { ...options, offset: 0, limit: 1, identity: reportObjectMatchKey(match) }).matches[0] ?? null;
}
