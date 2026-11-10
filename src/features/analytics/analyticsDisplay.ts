import { getQuestionMetadata } from "../../../shared/metadata/ecofocus2025";
import { hasValidRecordedCalculations } from "../../../shared/analytics/recordedCalculation";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import { buildDotPlotModel } from "./dotPlotModel";
import { buildHeatmapModel } from "./heatmapModel";
import { defaultDataset } from "../builder/builderConstants";
import type { AnalyticsQueryResponse, ChartType, QuestionId } from "../../../shared/types/analytics";

export function getQuestionLabel(questionId: QuestionId) {
  return defaultDataset.questions.find((question) => question.id === questionId)?.shortLabel ?? questionId;
}

export function getChartTypeLabel(chartType: ChartType) {
  return defaultDataset.chartTypes.find((item) => item.id === chartType)?.label ?? chartType;
}

export function supportsDonutResult(result: AnalyticsQueryResponse) {
  if (result.columns.length !== 1 || !hasValidRecordedCalculations(result)) return false;
  const exclusive = result.query.sourceIdentity?.kind === "imported" ||
    getQuestionMetadata(result.query.dataset, result.query.question)?.type === "single_select";
  if (!exclusive || (result.metric.valueFormat === "number" && result.metric.id !== "count")) return false;
  const cells = result.table.map(row => analyticalCell(result,row,result.columns[0].id));
  if (cells.some(cell => cell.status !== "available")) return false;
  const values = cells.map(cell => cell.value as number);
  if (!values.every(value => Number.isFinite(value) && value >= 0)) return false;
  const total = values.reduce((sum, value) => sum + value, 0);
  // Imported percentages may already be rounded to one decimal place. Permit
  // only their maximum aggregate rounding error, not an incomplete partition.
  return result.metric.valueFormat === "percent" ? Math.abs(total - 100) <= (result.calculationInputs?.percentageValueMode ? Math.max(1e-12, 100 * Number.EPSILON * (values.length + 1)) : 0.05 * values.length + 1e-8) : total > 0;
}

export function getCompatibleChartTypes(result: AnalyticsQueryResponse) {
  const isSingleSeries = result.columns.length === 1;
  const chartTypes: ChartType[] = isSingleSeries
    ? ["table", "vertical_bar", "horizontal_bar", "donut"]
    : ["table", "grouped_bar", "stacked_bar", "line_chart"];
  if (buildHeatmapModel(result).status === "ready") chartTypes.push("heatmap");
  if (buildDotPlotModel(result).status === "ready") chartTypes.push("dot_plot");
  return chartTypes.filter((chartType) =>
    defaultDataset.chartTypes.some((item) => item.id === chartType) &&
    (chartType !== "donut" || supportsDonutResult(result)),
  );
}

export function defaultVisualizationForQuestion(questionMetadata: typeof defaultDataset.questions[number]) {
  return questionMetadata.allowedChartTypes.includes("table")
    ? "table"
    : questionMetadata.allowedChartTypes.find((item) => item !== "table") ?? "table";
}
