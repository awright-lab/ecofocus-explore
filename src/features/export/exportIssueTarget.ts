import type { DashboardDraft } from "../../../shared/types/dashboard";

export interface ExportIssueTarget { reportId: string; pageId: string; objectId?: string }
export function resolveExportIssueTarget(dashboard: DashboardDraft, target: ExportIssueTarget) {
  if (target.reportId !== dashboard.id) return null;
  const pages = dashboard.pages.filter(page => page.id === target.pageId);
  if (pages.length !== 1) return null;
  const page = pages[0];
  if (target.objectId === undefined) return { pageId: page.id, kind: "page" as const };
  const tiles = page.tiles.filter(tile => tile.id === target.objectId);
  const elements = page.elements.filter(element => element.id === target.objectId);
  if (tiles.length + elements.length !== 1) return null;
  const object = tiles[0] ?? elements[0];
  if (object.hidden) return null;
  return { pageId: page.id, objectId: object.id, kind: tiles.length ? "tile" as const : "element" as const };
}
