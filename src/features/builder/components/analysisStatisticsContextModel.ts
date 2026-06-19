import type { DashboardTile } from "../../../../shared/types/dashboard";

export interface AnalysisStatisticsContextView {
  status: "placeholder" | "none";
  label: string;
  confidenceLabel: string;
  significanceLabel: string;
  message: string;
  helper: string;
  chips: string[];
}

function confidenceLevelLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function significanceMethodLabel(method: DashboardTile["result"]["statistics"]["significanceMethod"]) {
  if (method === "mock_placeholder") return "Placeholder annotations";
  return "No significance testing";
}

export function buildAnalysisStatisticsContext(tile: DashboardTile): AnalysisStatisticsContextView {
  const queryConfidence = tile.query.confidenceLevel ?? 0.95;
  const resultConfidence = tile.result.statistics?.confidenceLevel ?? tile.result.query.confidenceLevel ?? queryConfidence;
  const significanceMethod = tile.result.statistics?.significanceMethod ?? "none";
  const annotationCount = tile.result.annotations.length;
  const confidenceLabel = confidenceLevelLabel(resultConfidence);
  const queryConfidenceLabel = confidenceLevelLabel(queryConfidence);
  const significanceLabel = significanceMethodLabel(significanceMethod);
  const confidenceChip =
    resultConfidence === queryConfidence
      ? `Query: ${queryConfidenceLabel}`
      : `Result: ${confidenceLabel}`;

  if (significanceMethod === "mock_placeholder") {
    return {
      status: "placeholder",
      label: "Statistical confidence scaffold",
      confidenceLabel,
      significanceLabel,
      message: `${annotationCount} placeholder significance ${annotationCount === 1 ? "marker" : "markers"} at ${confidenceLabel}.`,
      helper: "Markers are mock placeholders for report rendering and review. They are not a real significance test yet.",
      chips: [confidenceChip, significanceLabel, `${annotationCount} markers`, "Advisory only"]
    };
  }

  return {
    status: "none",
    label: "Statistical confidence scaffold",
    confidenceLabel,
    significanceLabel,
    message: `This analysis is configured for ${confidenceLabel}, but no significance method is active.`,
    helper: "Confidence context is shown for transparency. Statistical testing is not implemented for this result yet.",
    chips: [confidenceChip, significanceLabel, "No markers", "Advisory only"]
  };
}
