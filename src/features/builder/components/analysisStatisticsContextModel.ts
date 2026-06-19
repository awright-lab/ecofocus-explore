import type { ConfidenceLevel } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export const supportedConfidenceLevels: ConfidenceLevel[] = [0.9, 0.95, 0.99];

export interface AnalysisStatisticsContextView {
  status: "placeholder" | "none";
  label: string;
  currentConfidenceLabel: string;
  resultConfidenceLabel: string;
  confidenceChangedSinceRefresh: boolean;
  significanceLabel: string;
  message: string;
  helper: string;
  chips: string[];
}

export function confidenceLevelLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function significanceMethodLabel(method: DashboardTile["result"]["statistics"]["significanceMethod"]) {
  if (method === "mock_placeholder") return "Placeholder annotations";
  return "No significance testing";
}

export function buildAnalysisStatisticsContext(tile: DashboardTile): AnalysisStatisticsContextView {
  const queryConfidence = tile.query.confidenceLevel ?? 0.95;
  const resultConfidence = tile.result.statistics?.confidenceLevel ?? tile.result.query.confidenceLevel ?? queryConfidence;
  const confidenceChangedSinceRefresh = resultConfidence !== queryConfidence;
  const significanceMethod = tile.result.statistics?.significanceMethod ?? "none";
  const annotationCount = tile.result.annotations.length;
  const currentConfidenceLabel = confidenceLevelLabel(queryConfidence);
  const resultConfidenceLabel = confidenceLevelLabel(resultConfidence);
  const queryConfidenceLabel = confidenceLevelLabel(queryConfidence);
  const significanceLabel = significanceMethodLabel(significanceMethod);
  const confidenceChips = confidenceChangedSinceRefresh
    ? [`Current query: ${queryConfidenceLabel}`, `Result: ${resultConfidenceLabel}`, "Refresh needed"]
    : [`Current query: ${queryConfidenceLabel}`];

  if (significanceMethod === "mock_placeholder") {
    return {
      status: "placeholder",
      label: "Statistical confidence scaffold",
      currentConfidenceLabel,
      resultConfidenceLabel,
      confidenceChangedSinceRefresh,
      significanceLabel,
      message: confidenceChangedSinceRefresh
        ? `Current query is set to ${currentConfidenceLabel}; the displayed result still reflects ${resultConfidenceLabel} until refresh.`
        : `${annotationCount} placeholder significance ${annotationCount === 1 ? "marker" : "markers"} at ${currentConfidenceLabel}.`,
      helper: "Markers are mock placeholders for report rendering and review. They are not a real significance test yet.",
      chips: [...confidenceChips, significanceLabel, `${annotationCount} markers`, "Advisory only"]
    };
  }

  return {
    status: "none",
    label: "Statistical confidence scaffold",
    currentConfidenceLabel,
    resultConfidenceLabel,
    confidenceChangedSinceRefresh,
    significanceLabel,
    message: confidenceChangedSinceRefresh
      ? `Current query is set to ${currentConfidenceLabel}; the displayed result still reflects ${resultConfidenceLabel} until refresh.`
      : `This analysis is configured for ${currentConfidenceLabel}, but no significance method is active.`,
    helper: "Confidence context is shown for transparency. Statistical testing is not implemented for this result yet.",
    chips: [...confidenceChips, significanceLabel, "No markers", "Advisory only"]
  };
}
