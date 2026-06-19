import type { ConfidenceLevel } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export const supportedConfidenceLevels: ConfidenceLevel[] = [0.9, 0.95, 0.99];

export interface AnalysisStatisticsContextView {
  status: "placeholder" | "none";
  label: string;
  currentConfidenceLabel: string;
  resultConfidenceLabel: string;
  confidenceChangedSinceRefresh: boolean;
  refreshCue: AnalysisConfidenceRefreshCueView | null;
  eligibility: AnalysisSignificanceEligibilityView;
  significanceLabel: string;
  message: string;
  helper: string;
  chips: string[];
}

export interface AnalysisConfidenceRefreshCueView {
  label: string;
  message: string;
  helper: string;
}

export interface AnalysisSignificanceEligibilityView {
  status: "candidate" | "limited" | "notEligible";
  label: string;
  message: string;
  helper: string;
  comparisonBasisLabel: string;
  chips: string[];
  limitations: string[];
}

export function confidenceLevelLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function significanceMethodLabel(method: DashboardTile["result"]["statistics"]["significanceMethod"]) {
  if (method === "mock_placeholder") return "Placeholder annotations";
  return "No significance testing";
}

function buildSignificanceEligibility(tile: DashboardTile): AnalysisSignificanceEligibilityView {
  const result = tile.result;
  const significanceMethod = result.statistics?.significanceMethod ?? "none";
  const comparisonMode = result.query.comparisonMode ?? tile.query.comparisonMode ?? "none";
  const columnCount = result.columns.length;
  const rowCount = result.table.length;
  const isWaveComparison = comparisonMode === "wave";
  const isSummaryOnly = columnCount <= 1;
  const hasTabularResult = rowCount > 0 && columnCount > 0;
  const comparisonBasisLabel = isWaveComparison
    ? `Wave comparison: ${result.columns.map((column) => column.label).join(" vs ") || "No waves"}`
    : isSummaryOnly
      ? "Summary-only result"
      : `Breakout columns: ${result.columns.map((column) => column.label).join(", ")}`;

  if (!hasTabularResult) {
    return {
      status: "notEligible",
      label: "Significance eligibility not available",
      message: "This result does not have enough table structure to evaluate significance readiness.",
      helper: "A future significance engine needs rows and comparison columns before tests can be considered.",
      comparisonBasisLabel,
      chips: ["No test performed", "No table basis", "Advisory only"],
      limitations: ["No tabular rows or columns are available for significance evaluation."]
    };
  }

  const limitations = [
    significanceMethod === "mock_placeholder" ? "Current markers are placeholders, not statistical test results." : "No significance method is active for this result.",
    isWaveComparison ? "Wave comparison significance is not implemented in the mock provider." : "",
    isSummaryOnly ? "Summary-only results do not provide comparison columns for column significance." : ""
  ].filter(Boolean);

  if (!isWaveComparison && !isSummaryOnly) {
    return {
      status: "candidate",
      label: "Eligible for future significance logic",
      message: "This result has table rows and breakout columns that could support real significance testing later.",
      helper: "No p-values or real tests are calculated yet; eligibility only describes whether the current result has a plausible comparison structure.",
      comparisonBasisLabel,
      chips: ["Future candidate", "Breakout basis", significanceMethod === "mock_placeholder" ? "Placeholder only" : "No test performed"],
      limitations
    };
  }

  return {
    status: "limited",
    label: "Limited significance eligibility",
    message: isWaveComparison
      ? "This result compares waves, but the current mock provider does not run significance tests for wave comparisons."
      : "This result is summary-only, so there is no column comparison basis for significance testing.",
    helper: "Eligibility is advisory. It explains current analytical structure without performing a statistical test.",
    comparisonBasisLabel,
    chips: ["Limited", isWaveComparison ? "Wave comparison" : "Summary only", significanceMethod === "mock_placeholder" ? "Placeholder only" : "No test performed"],
    limitations
  };
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
  const refreshCue: AnalysisConfidenceRefreshCueView | null = confidenceChangedSinceRefresh
    ? {
      label: "Refresh to apply new confidence level",
      message: `Result still reflects ${resultConfidenceLabel}; current query is ${currentConfidenceLabel}.`,
      helper: "Use Apply and save below to refresh the selected object with this confidence context."
    }
    : null;
  const eligibility = buildSignificanceEligibility(tile);

  if (significanceMethod === "mock_placeholder") {
    return {
      status: "placeholder",
      label: "Statistical confidence scaffold",
      currentConfidenceLabel,
      resultConfidenceLabel,
      confidenceChangedSinceRefresh,
      refreshCue,
      eligibility,
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
    refreshCue,
    eligibility,
    significanceLabel,
    message: confidenceChangedSinceRefresh
      ? `Current query is set to ${currentConfidenceLabel}; the displayed result still reflects ${resultConfidenceLabel} until refresh.`
      : `This analysis is configured for ${currentConfidenceLabel}, but no significance method is active.`,
    helper: "Confidence context is shown for transparency. Statistical testing is not implemented for this result yet.",
    chips: [...confidenceChips, significanceLabel, "No markers", "Advisory only"]
  };
}
