import { validSourceCategoryKey } from "../../../shared/analytics/sourceCategoryIdentity";
import type { DashboardDraft, DashboardTile, ReportColorTheme, TileAppearance } from "../../../shared/types/dashboard";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
export function validReportColorTheme(value: unknown): value is ReportColorTheme {
  if (!value || typeof value !== "object") return false;
  const plan = value as ReportColorTheme;
  if (plan.version !== 1 || !Array.isArray(plan.palette) || !plan.palette.length || !plan.palette.every(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) || !Array.isArray(plan.slots)) return false;
  const keys = new Set<string>(), indices = new Set<number>();
  return plan.slots.every(slot => slot && typeof slot.key === "string" && typeof slot.label === "string" && Number.isSafeInteger(slot.index) && slot.index >= 0 && !keys.has(slot.key) && !indices.has(slot.index) && (keys.add(slot.key), indices.add(slot.index), true));
}
export function reportColorEligibility(tile: DashboardTile): string | null {
  if (resultIdentityIssue(tile.result)) return "Refresh this analysis: its recorded result IDs are ambiguous.";
  if (tile.result.metadataRefs.source?.kind === "imported") {
    const validKeys = (items: Array<{ sourceCategoryKey?: string }>) => {
      const keys = new Set<string>();
      return items.every(item => {
        if (!validSourceCategoryKey(item.sourceCategoryKey) || keys.has(item.sourceCategoryKey)) return false;
        keys.add(item.sourceCategoryKey); return true;
      });
    };
    if (!validKeys(tile.result.table) || !validKeys(tile.result.columns)) return "Refresh this imported analysis to record stable category codes before applying report colors.";
  }
  return null;
}
function identity(tile: DashboardTile, role: "rows" | "columns", id: string, sourceKey?: string): string {
  const result = tile.result, source = result.metadataRefs.source;
  const dataset = source?.kind === "imported" ? ["imported", source.datasetId] : source?.kind === "live" ? ["live", source.connectionId, source.objectPath] : ["seeded", result.query.dataset];
  const field = source?.kind === "imported" ? role === "rows" ? source.primaryFieldId : source.bannerFieldId ?? "all_respondents" : role === "rows" ? result.query.question : result.query.breakBy;
  return JSON.stringify([dataset, field, source?.kind === "imported" ? sourceKey : id]);
}
// Append assignments; never renumber or discard temporarily filtered categories.
// Scope codes to their recorded dataset/field, not display labels or tile IDs.
export function reconcileReportColors(draft: DashboardDraft): DashboardDraft {
  const theme = draft.reportColorTheme;
  if (!validReportColorTheme(theme)) return draft;
  const slots = theme.slots.map(slot => ({ ...slot })), byKey = new Map(slots.map(slot => [slot.key, slot.index]));
  let next = slots.reduce((max, slot) => Math.max(max, slot.index + 1), 0);
  const pages = draft.pages.map(page => ({ ...page, tiles: page.tiles.map(tile => {
    if (tile.appearance.reportColorsEnabled === false) return tile;
    if (reportColorEligibility(tile)) {
      // Never reuse bindings from another result when a cached/remote result
      // lacks stable source keys. Retain its chart palette until refreshed.
      if (!tile.appearance.reportColorSlots) return { ...tile, appearance: { ...tile.appearance, reportColorsEnabled: undefined } };
      return { ...tile, appearance: { ...tile.appearance, palette: [...tile.appearance.reportColorSlots.originalPalette], reportColorSlots: undefined, reportColorsEnabled: undefined } };
    }
    function bind(role: "rows" | "columns", entries: Array<{ id: string; label: string; sourceCategoryKey?: string }>): Record<string, number> {
      return Object.fromEntries(entries.map(entry => {
        const key = identity(tile, role, entry.id, entry.sourceCategoryKey);
        if (!byKey.has(key)) { byKey.set(key, next); slots.push({ key, label: entry.label, index: next++ }); }
        return [entry.id, byKey.get(key)!];
      }));
    }
    const previous = tile.appearance.reportColorSlots;
    const rows = bind("rows", tile.result.table.map(row => ({ id: row.optionId, label: row.label, sourceCategoryKey: row.sourceCategoryKey }))), columns = bind("columns", tile.result.columns);
    const styles = { ...previous?.styles };
    // Capture explicit edits against the result that owned their ID. A query
    // may regenerate raw IDs; the stored semantic slot owns the style thereafter.
    for (const [id, style] of Object.entries(tile.appearance.barStyles)) {
      for (const map of previous ? [previous.rows, previous.columns] : [rows, columns]) {
        if (Object.hasOwn(map, id)) styles[String(map[id])] = { ...style };
      }
    }
    // Keep editable raw IDs aligned with their current semantic owners too.
    // Otherwise a second reconciliation could recapture a stale raw override
    // against a different category that inherited its old frequency-based ID.
    const barStyles = { ...tile.appearance.barStyles };
    for (const map of previous ? [previous.rows, previous.columns, rows, columns] : [rows, columns]) {
      for (const id of Object.keys(map)) delete barStyles[id];
    }
    for (const map of [rows, columns]) for (const [id, slot] of Object.entries(map)) {
      if (styles[String(slot)]) barStyles[id] = { ...styles[String(slot)] };
    }
    const reportColorSlots = { rows, columns, styles, originalPalette: [...(previous?.originalPalette ?? tile.appearance.palette)] };
    return { ...tile, appearance: { ...tile.appearance, barStyles, reportColorsEnabled: true, reportColorSlots, palette: [...theme.palette] } };
  }) }));
  return { ...draft, reportColorTheme: { ...theme, slots }, pages };
}
export function applyReportColorTheme(draft: DashboardDraft, palette: string[]): DashboardDraft {
  const reportColorTheme: ReportColorTheme = { version: 1, palette: [...palette], slots: validReportColorTheme(draft.reportColorTheme) ? draft.reportColorTheme.slots : [] };
  if (!validReportColorTheme(reportColorTheme)) throw new Error("Choose a palette containing six-digit hex colors.");
  return reconcileReportColors({ ...draft, status: "draft", reportColorTheme, pages: draft.pages.map(page => ({ ...page, tiles: page.tiles.map(tile => ({ ...tile, appearance: { ...tile.appearance, reportColorsEnabled: true } })) })) });
}
export function paletteColor(appearance: TileAppearance, role: "rows" | "columns", id: string, fallbackIndex: number): string {
  const map = appearance.reportColorSlots?.[role];
  const index = appearance.reportColorsEnabled && map && Object.hasOwn(map, id) && Number.isSafeInteger(map[id]) && map[id] >= 0 ? map[id] : fallbackIndex;
  return appearance.palette[index % Math.max(1, appearance.palette.length)] ?? appearance.primaryColor;
}
export function chartColor(tile: DashboardTile, role: "rows" | "columns", id: string, index: number): string {
  const map = tile.appearance.reportColorSlots?.[role];
  const semantic = tile.appearance.reportColorsEnabled && map && Object.hasOwn(map,id) ? tile.appearance.reportColorSlots?.styles?.[String(map[id])] : undefined;
  const override = tile.appearance.reportColorsEnabled && map ? semantic?.color : Object.hasOwn(tile.appearance.barStyles, id) ? tile.appearance.barStyles[id]?.color : undefined;
  return override ?? (tile.appearance.barFillMode === "gradient" && !tile.appearance.reportColorsEnabled ? tile.appearance.primaryColor : paletteColor(tile.appearance, role, id, index));
}

export function removeReportColorTheme(draft: DashboardDraft): DashboardDraft {
  const { reportColorTheme: _theme, ...rest } = draft;
  return { ...rest, status: "draft", pages: draft.pages.map(page => ({ ...page, tiles: page.tiles.map(tile => {
    const { reportColorSlots, reportColorsEnabled: _enabled, ...appearance } = tile.appearance;
    const barStyles = { ...appearance.barStyles };
    if (tile.appearance.reportColorsEnabled && reportColorSlots) {
      for (const map of [reportColorSlots.rows,reportColorSlots.columns]) for (const [id,slot] of Object.entries(map)) {
        delete barStyles[id];
        const style = reportColorSlots.styles?.[String(slot)]; if (style) barStyles[id] = { ...style };
      }
    }
    return { ...tile, appearance: { ...appearance, barStyles, palette: tile.appearance.reportColorsEnabled && reportColorSlots ? [...reportColorSlots.originalPalette] : appearance.palette } };
  }) })) };
}
