import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { buildHeatmapModel } from "./heatmapModel";

export const dotPlotLimits = { rows: 30, columns: 6, cells: 180 } as const;
export const dotPlotExplanation = "Dots show recorded values on one shared scale. Marker shapes distinguish series; missing values have no dot. No confidence intervals, significance or trends are implied.";
export const pairedDotPlotExplanation = "Paired dots compare two recorded groups on one shared scale. Circles and outlined squares identify the groups, including equal values. A connector joins available values within the same answer; it does not imply time, change, significance or causation. Missing values have no dot; connectors require two available values. No confidence intervals are shown.";
export type DotPlotModel = { status: "unavailable"; reason: string } | {
  status: "ready"; minimum: number; maximum: number;
  cells: Array<Array<{ value: number | null; base: number | null; fraction: number | null }>>;
};

export function buildDotPlotModel(result: AnalyticsQueryResponse): DotPlotModel {
  if (!Array.isArray(result?.table) || !Array.isArray(result?.columns)) return { status: "unavailable", reason: "Recorded dot-plot cells are missing. Refresh the analysis." };
  if (result.table.length > dotPlotLimits.rows || result.columns.length > dotPlotLimits.columns)
    return { status: "unavailable", reason: "Dot plots support up to 30 rows and six columns. Use the complete table or filter the analysis; no cells have been removed." };
  // Reuse the established read-only metric, identity, value and base validation.
  // Its colors are not used; dot positions retain the original numeric values.
  const grid = buildHeatmapModel(result);
  if (grid.status === "unavailable") return grid;
  const minimum = grid.minimum, maximum = grid.maximum === minimum ? minimum + 1 : grid.maximum;
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum)) || 1;
  const span = maximum / scale - minimum / scale;
  if (!Number.isFinite(span) || span <= 0) return { status: "unavailable", reason: "This numeric range cannot be drawn safely. Rescale the source or use the complete table." };
  return { status: "ready", minimum, maximum, cells: grid.cells.map(row => row.map(cell => ({
    value: cell.value, base: cell.base,
    fraction: cell.value === null ? null : (cell.value / scale - minimum / scale) / span
  }))) };
}

export const smallMultiplesExplanation = "Each panel shows one recorded group on the same scale. All answer rows are repeated in every panel; missing values have no marker. Panels do not imply time, significance or confidence intervals.";
export const slopePlotExplanation = "Lines connect two recorded group values for each answer on one shared scale. They do not establish time order, paired respondents, change, significance or causation. Missing values have no marker and are not connected. Coincident endpoints may overlap; use complete values to distinguish them. No confidence intervals are shown.";
