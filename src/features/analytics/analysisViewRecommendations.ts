import type { AnalyticsQueryResponse, ChartType } from "../../../shared/types/analytics";
import { analyticalCell } from "../../../shared/analytics/resultCells";

export interface AnalysisViewRecommendation {
  chartType: ChartType;
  label: string;
  rationale: string;
}

/** Advice about the actual calculated matrix, not an inferred trend or a finding. */
export function analysisViewRecommendations(result: AnalyticsQueryResponse | null): AnalysisViewRecommendation[] {
  if (!result || !result.table.length || !result.columns.length) return [];
  const rows = result.table.length, groups = result.columns.length;
  const rowIds = result.table.map(row => row.optionId), columnIds = result.columns.map(column => column.id);
  if (new Set(rowIds).size !== rows || new Set(columnIds).size !== groups ||
    result.table.some(row => result.columns.some(column => analyticalCell(result, row, column.id).status !== "available"))) {
    return [{ chartType: "table", label: "Review the table", rationale: "Some cells are unavailable or ambiguous. Inspect values and sample bases before choosing a chart." }];
  }
  const table: AnalysisViewRecommendation = { chartType: "table", label: "Inspect exact values", rationale: `A table keeps all ${rows} answer${rows === 1 ? "" : "s"} and ${groups} group${groups === 1 ? "" : "s"} available with their recorded sample bases.` };
  if (rows > 12 || groups > 6) return [{ ...table, rationale: `This result has ${rows} answers and ${groups} groups. Start with a table to avoid crowding; choose a smaller, explicit comparison before charting.` }];
  if (groups > 1) return [{ chartType: "grouped_bar", label: "Compare groups side by side", rationale: `Grouped bars compare the same ${result.metric.label.toLowerCase()} across ${groups} groups for each answer. Equal placement does not imply a time sequence or statistical significance.` }, table];
  const longLabels = result.table.some(row => row.label.length > 24);
  const horizontal = longLabels || rows > 5;
  return [{ chartType: horizontal ? "horizontal_bar" : "vertical_bar", label: horizontal ? "Make answer labels readable" : "Compare answer values", rationale: `${horizontal ? longLabels ? "Long answer labels are easier to read beside horizontal bars." : `${rows} answers are easier to scan in horizontal bars.` : `${rows} answer${rows === 1 ? "" : "s"} fit a compact column comparison.`} Bars compare ${result.metric.label.toLowerCase()} from a common zero baseline; they do not assert a trend or significance.` }, table];
}
