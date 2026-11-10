import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";

export const reportObjectSearchLimits = { matches: 20, textCharacters: 2 * 1024 * 1024, queryCharacters: 200 } as const;
export type ReportObjectMatch = { kind: "tile"; page: DashboardPage; object: DashboardTile; excerpt: string } | { kind: "element"; page: DashboardPage; object: DashboardCanvasElement; excerpt: string };
export interface ReportObjectSearch { pages: DashboardPage[]; matches: ReportObjectMatch[]; total: number; textIncluded: boolean; issue: string }
export function reportObjectMatchKey(match: ReportObjectMatch) { return JSON.stringify([match.page.id, match.kind, match.object.id]); }
const text = (value: unknown) => typeof value === "string" ? value : "";
function analysisNames(tile: DashboardTile) {
  const source = tile.result?.metadataRefs?.source;
  return [tile.title, tile.name, tile.source?.label, ...(source?.kind === "imported" ? [source.datasetLabel, source.primaryFieldLabel, source.bannerFieldLabel, source.measureFieldLabel] : [])].map(text).join(" ");
}
/** Read-only report navigation: never visits respondent rows, result cells or image payloads. */
export function searchReportObjects(pages: DashboardPage[], query: string): ReportObjectSearch {
  const trimmed = query.trim(), normalized = trimmed.toLowerCase();
  if (!normalized) return { pages, matches: [], total: 0, textIncluded: true, issue: "" };
  if (trimmed.length > reportObjectSearchLimits.queryCharacters) return { pages, matches: [], total: 0, textIncluded: false, issue: "Use 200 characters or fewer to search this report." };
  let characters = 0, textIncluded = true;
  outer: for (const page of pages) for (const element of page.elements) if (element.type === "text") {
    characters += text(element.content).length;
    if (characters > reportObjectSearchLimits.textCharacters) { textIncluded = false; break outer; }
  }
  const visible: DashboardPage[] = [], matches: ReportObjectMatch[] = []; let total = 0;
  for (const page of pages) {
    let pageMatches = `${text(page.title)} ${page.order}`.toLowerCase().includes(normalized);
    const objects: ReportObjectMatch[] = [
      ...page.tiles.map(object => ({ kind: "tile" as const, page, object, excerpt: "" })),
      ...page.elements.map(object => ({ kind: "element" as const, page, object, excerpt: "" }))
    ];
    objects.sort((a, b) => (a.object.layout?.zIndex ?? 0) - (b.object.layout?.zIndex ?? 0));
    for (const entry of objects) {
      const names = entry.kind === "tile" ? analysisNames(entry.object) : text(entry.object.name);
      const content = textIncluded && entry.kind === "element" && entry.object.type === "text" ? text(entry.object.content) : "";
      const foldedContent = content.toLowerCase(), position = foldedContent.indexOf(normalized);
      if (!names.toLowerCase().includes(normalized) && position < 0) continue;
      pageMatches = true; total++;
      if (matches.length < reportObjectSearchLimits.matches) {
        if (position >= 0 && foldedContent.length === content.length) { let start = Math.max(0, position - 35), end = Math.min(content.length, position + normalized.length + 60); if (start > 0 && /[\uDC00-\uDFFF]/u.test(content[start])) start--; if (end < content.length && /[\uD800-\uDBFF]/u.test(content[end - 1])) end++; entry.excerpt = `${start ? "…" : ""}${content.slice(start, end).replace(/\s+/gu, " ").trim()}${end < content.length ? "…" : ""}`; }
        matches.push(entry);
      }
    }
    if (pageMatches) visible.push(page);
  }
  return { pages: visible, matches, total, textIncluded, issue: textIncluded ? "" : "Names-only results: the written text is too large to search at once. Names were searched completely; written text was not searched." };
}

/** Recheck an activated match against current report data; IDs are scoped to their page. */
export function resolveReportObjectMatch(pages: DashboardPage[], query: string, match: ReportObjectMatch): ReportObjectMatch | null {
  const page = pages.filter(item => item.id === match.page.id); if (page.length !== 1) return null;
  const objects = match.kind === "tile" ? page[0].tiles : page[0].elements;
  if (objects.filter(item => item.id === match.object.id).length !== 1) return null;
  return searchReportObjects(pages, query).matches.find(item => reportObjectMatchKey(item) === reportObjectMatchKey(match)) ?? null;
}
