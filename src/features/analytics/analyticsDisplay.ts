import { defaultDataset } from "../builder/builderConstants";
import type { AnalyticsQueryResponse, ChartType, QuestionId } from "../../../shared/types/analytics";

export function getQuestionLabel(questionId: QuestionId) {
  return defaultDataset.questions.find((question) => question.id === questionId)?.shortLabel ?? questionId;
}

export function getChartTypeLabel(chartType: ChartType) {
  return defaultDataset.chartTypes.find((item) => item.id === chartType)?.label ?? chartType;
}

export function getCompatibleChartTypes(result: AnalyticsQueryResponse) {
  const isSingleSeries = result.columns.length === 1;
  const chartTypes: ChartType[] = isSingleSeries
    ? ["table", "vertical_bar", "horizontal_bar", "donut"]
    : ["table", "grouped_bar", "stacked_bar", "line_chart"];
  return chartTypes.filter((chartType) => defaultDataset.chartTypes.some((item) => item.id === chartType));
}

export function defaultVisualizationForQuestion(questionMetadata: typeof defaultDataset.questions[number]) {
  return questionMetadata.allowedChartTypes.includes("table")
    ? "table"
    : questionMetadata.allowedChartTypes.find((item) => item !== "table") ?? "table";
}
