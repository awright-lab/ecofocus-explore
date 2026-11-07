import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { analyticalBase, analyticalCell } from "../../../shared/analytics/resultCells";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";

export const heatmapLimits = { rows: 100, columns: 50, cells: 5000 } as const;
export type HeatmapModel = { status: "unavailable"; reason: string } | {
  status: "ready"; minimum: number; maximum: number;
  cells: Array<Array<{ value: number | null; base: number | null; fill: string; ink: string }>>;
};
export const heatmapScaleExplanation = "One shared scale for all cells: white at zero, blue for positive values, orange for negative values. Unavailable cells are gray and labeled; color does not indicate significance.";

export function heatmapMetricIssue(result: AnalyticsQueryResponse): string | null {
  const metric = result.metric;
  const expected = metric && ["column_percent", "percent_selected"].includes(metric.id) ? "percent"
    : metric && ["count", "average", "sum"].includes(metric.id) ? "number" : null;
  return expected && metric.valueFormat === expected ? null : "The recorded metric and value format are incompatible. Refresh the result before coloring or exporting it.";
}

function colors(fraction: number): { fill: string; ink: string } {
  const target = fraction < 0 ? [194, 65, 12] : [29, 78, 216], neutral = [248, 250, 252];
  const rgb = neutral.map((channel, index) => Math.round(channel + (target[index] - channel) * Math.min(1, Math.abs(fraction))));
  const linear = rgb.map(channel => channel / 255 <= .04045 ? channel / 255 / 12.92 : ((channel / 255 + .055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  return { fill: `#${rgb.map(channel => channel.toString(16).padStart(2, "0")).join("")}`, ink: luminance > .179 ? "#000000" : "#ffffff" };
}

// Read-only rendering model. No normalization within columns, recalculation of
// observations, inference, or mutation of recorded results.
export function buildHeatmapModel(result: AnalyticsQueryResponse): HeatmapModel {
  const metricIssue = heatmapMetricIssue(result); if (metricIssue) return { status: "unavailable", reason: metricIssue };
  if (!Array.isArray(result.table) || !Array.isArray(result.columns)) return { status: "unavailable", reason: "Recorded heatmap cells are missing. Refresh the result." };
  if (!result.table.length || !result.columns.length) return { status: "unavailable", reason: "No recorded cells are available for a heatmap." };
  if (result.table.length > heatmapLimits.rows || result.columns.length > heatmapLimits.columns || result.table.length * result.columns.length > heatmapLimits.cells)
    return { status: "unavailable", reason: "Heatmaps support up to 100 rows and 50 columns. Use the complete table or filter the analysis; no cells have been removed." };
  const issue = resultIdentityIssue(result);
  if (issue) return { status: "unavailable", reason: issue };
  const cells: Array<Array<{ value: number | null; base: number | null }>> = [];
  let minimum = 0, maximum = 0;
  for (let r = 0; r < result.table.length; r++) {
    if (!Object.hasOwn(result.table, r)) return { status: "unavailable", reason: "Recorded heatmap rows must be complete. Refresh the result." };
    const row = result.table[r];
    if (typeof row.label !== "string") return { status: "unavailable", reason: "Recorded row labels are invalid. Refresh the result." };
    const group = [];
    for (let c = 0; c < result.columns.length; c++) {
      if (!Object.hasOwn(result.columns, c)) return { status: "unavailable", reason: "Recorded heatmap columns must be complete. Refresh the result." };
      const column = result.columns[c];
      if (typeof column.label !== "string") return { status: "unavailable", reason: "Recorded column labels are invalid. Refresh the result." };
      const cell = analyticalCell(result, row, column.id), sample = analyticalBase(result, row, column.id);
      if (cell.status === "invalid" || cell.status === "rerun_required") return { status: "unavailable", reason: "Some recorded cells are invalid or require refresh. Use the complete table to inspect them before drawing a heatmap." };
      const value = cell.value;
      if (value !== null && ((result.metric.valueFormat === "percent" && (value < 0 || value > 100)) || (result.metric.id === "count" && value < 0)))
        return { status: "unavailable", reason: "Recorded percentages or counts are outside their valid range. Refresh the result; no colors were assigned." };
      if (value !== null) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
      group.push({ value, base: sample });
    }
    cells.push(group);
  }
  if (result.metric.valueFormat === "percent") { minimum = 0; maximum = 100; }
  else if (minimum < 0 && maximum > 0) { const magnitude = Math.max(-minimum, maximum); minimum = -magnitude; maximum = magnitude; }
  const magnitude = Math.max(-minimum, maximum) || 1;
  return { status: "ready", minimum, maximum, cells: cells.map(row => row.map(cell => ({ ...cell,
    ...(cell.value === null ? { fill: "#e2e8f0", ink: "#334155" } : colors(cell.value / magnitude))
  }))) };
}
