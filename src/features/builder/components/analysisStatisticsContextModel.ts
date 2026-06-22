import type { AnalyticsSignificanceResult, ConfidenceLevel, SignificanceMethod, SignificanceReasonCode } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";
import { datasets } from "../builderConstants";
import { filterLabel, weightLabel } from "./analysisWeightDiagnosticsModel";

export const supportedConfidenceLevels: ConfidenceLevel[] = [0.9, 0.95, 0.99];

export interface AnalysisStatisticsContextView {
  status: "placeholder" | "none";
  label: string;
  currentConfidenceLabel: string;
  resultConfidenceLabel: string;
  confidenceChangedSinceRefresh: boolean;
  refreshCue: AnalysisConfidenceRefreshCueView | null;
  eligibility: AnalysisSignificanceEligibilityView;
  executionDiagnostics: AnalysisExecutionDiagnosticsView;
  baseDiagnostics: AnalysisBaseDiagnosticsView;
  comparisonDiagnostics: AnalysisComparisonDiagnosticsView;
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

export interface AnalysisExecutionDiagnosticsView {
  status: "deferred" | "invalid" | "unsupported" | "ready" | "unavailable";
  label: string;
  message: string;
  helper: string;
  chips: string[];
  details: string[];
}

export interface AnalysisBaseDiagnosticsView {
  status: "strong" | "review" | "unavailable";
  label: string;
  message: string;
  helper: string;
  chips: string[];
  notes: string[];
}

export interface AnalysisComparisonDiagnosticsView {
  status: "inactive" | "active" | "limited";
  label: string;
  message: string;
  helper: string;
  waveLabel: string;
  filterLabel: string;
  weightLabel: string;
  chips: string[];
  limitations: string[];
}

export function confidenceLevelLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function significanceMethodLabel(method: SignificanceMethod) {
  if (method === "mock_placeholder") return "Placeholder annotations";
  if (method === "column_comparison") return "Eligible column comparison";
  if (method === "wave_comparison") return "Eligible wave comparison";
  return "No significance testing";
}

function fallbackSignificance(tile: DashboardTile): AnalyticsSignificanceResult {
  const method = tile.result.statistics?.significanceMethod ?? "none";
  const comparisonBasis: AnalyticsSignificanceResult["comparisonBasis"] =
    (tile.result.query.comparisonMode ?? tile.query.comparisonMode) === "wave"
      ? "wave"
      : tile.result.columns.length > 1
        ? "breakout"
        : tile.result.columns.length === 1
          ? "summary"
          : "none";
  const hasPlaceholders = method === "mock_placeholder" || tile.result.annotations.length > 0;
  const readiness: AnalyticsSignificanceResult["readiness"] =
    comparisonBasis === "wave"
      ? {
          status: "unsupported",
          method: "wave_comparison",
          reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
          comparisonBasis
        }
      : comparisonBasis === "breakout"
        ? {
            status: "candidate",
            method: "column_comparison",
            reasonCodes: ["future_method"],
            comparisonBasis
          }
        : {
            status: "not_applicable",
            method: "none",
            reasonCodes: ["summary_only", "no_comparison_basis"],
            comparisonBasis
          };

  return {
    status: hasPlaceholders ? "placeholder" : method === "none" ? "none" : "eligible",
    method,
    readiness,
    reasonCodes: hasPlaceholders ? ["mock_provider_placeholder"] : ["mock_provider_not_available"],
    comparisonBasis,
    hasPlaceholders,
    details: tile.result.annotations.map((annotation) => ({
      rowId: annotation.rowId,
      columnId: annotation.columnId,
      direction: annotation.direction,
      confidence: annotation.confidence as ConfidenceLevel,
      status: "placeholder",
      reasonCodes: ["mock_provider_placeholder"]
    }))
  };
}

function significanceReasonLabel(reasonCode: SignificanceReasonCode) {
  const labels: Record<SignificanceReasonCode, string> = {
    mock_provider_placeholder: "Mock provider placeholder",
    mock_provider_not_available: "Mock provider does not calculate significance",
    wave_comparison_unsupported: "Wave comparison significance unsupported",
    summary_only: "Summary-only result",
    no_comparison_basis: "No comparison basis",
    insufficient_base: "Insufficient base",
    future_method: "Future method scaffold",
    invalid_execution_input: "Invalid execution input"
  };
  return labels[reasonCode];
}

function datasetWaveLabel(datasetId: string) {
  return datasets.find((dataset) => dataset.id === datasetId)?.wave ?? datasetId;
}

function buildSignificanceEligibility(tile: DashboardTile): AnalysisSignificanceEligibilityView {
  const result = tile.result;
  const significance = result.statistics?.significance ?? fallbackSignificance(tile);
  const readiness = significance.readiness;
  const significanceMethod = significance.method;
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

  const significanceReasonLabels = Array.from(new Set([...significance.reasonCodes, ...readiness.reasonCodes])).map(significanceReasonLabel);
  const limitations = [
    significance.hasPlaceholders ? "Current markers are placeholders, not statistical test results." : "",
    significance.status === "unsupported" ? "The current provider reports this significance method as unsupported." : "",
    readiness.status === "unsupported" ? "The provider readiness model marks this query shape as unsupported." : "",
    readiness.status === "not_applicable" ? "The provider readiness model does not see a comparison method for this query shape." : "",
    significance.status === "eligible" ? "The result is structurally eligible, but no real significance test has been run." : "",
    significance.status === "none" ? "No significance method is active for this result." : "",
    ...significanceReasonLabels,
    isWaveComparison ? "Wave comparison significance is not implemented in the mock provider." : "",
    isSummaryOnly ? "Summary-only results do not provide comparison columns for column significance." : ""
  ].filter(Boolean);

  if (!isWaveComparison && !isSummaryOnly) {
    return {
      status: "candidate",
      label: "Eligible for future significance logic",
      message:
        significance.status === "eligible"
          ? "This result has a plausible comparison basis and is marked eligible, but it has not been tested."
          : "This result has table rows and breakout columns that could support real significance testing later.",
      helper: "No p-values or real tests are calculated yet; eligibility only describes whether the current result has a plausible comparison structure.",
      comparisonBasisLabel,
      chips: ["Future candidate", "Breakout basis", significance.hasPlaceholders ? "Placeholder only" : significance.status === "eligible" ? "Eligible, not tested" : significance.status === "tested" ? "Tested" : "No test performed"],
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
    chips: ["Limited", isWaveComparison ? "Wave comparison" : "Summary only", significance.hasPlaceholders ? "Placeholder only" : "No test performed"],
    limitations
  };
}

function buildBaseDiagnostics(tile: DashboardTile): AnalysisBaseDiagnosticsView {
  const result = tile.result;
  const bases = result.table
    .flatMap((row) => Object.values(row.bases))
    .filter((base) => base > 0)
    .sort((a, b) => a - b);

  if (bases.length === 0) {
    return {
      status: "unavailable",
      label: "Base diagnostics unavailable",
      message: "This result does not expose positive base counts for interpretation checks.",
      helper: "Base diagnostics are advisory and depend on result table base metadata.",
      chips: ["No base counts", "Advisory only"],
      notes: result.warnings
    };
  }

  const minBase = bases[0];
  const maxBase = bases[bases.length - 1];
  const uniqueBases = Array.from(new Set(bases));
  const hasProviderWarnings = result.warnings.length > 0;
  const hasUnevenBases = uniqueBases.length > 1 && maxBase >= minBase * 1.5;
  const notes = [
    ...result.warnings,
    hasUnevenBases ? `Bases range from ${minBase.toLocaleString()} to ${maxBase.toLocaleString()}; compare columns cautiously.` : ""
  ].filter(Boolean);

  if (hasProviderWarnings || hasUnevenBases) {
    return {
      status: "review",
      label: "Review base strength",
      message: hasProviderWarnings
        ? `Provider warnings or low-base signals are present. Lowest visible base is ${minBase.toLocaleString()}.`
        : `Bases vary across the result. Lowest visible base is ${minBase.toLocaleString()}.`,
      helper: "Low or uneven bases can make interpretation weaker. This does not run a statistical validity test.",
      chips: [`Lowest base: ${minBase.toLocaleString()}`, `Highest base: ${maxBase.toLocaleString()}`, hasProviderWarnings ? `${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}` : "Uneven bases"],
      notes
    };
  }

  return {
    status: "strong",
    label: "Base strength looks stable",
    message: `Visible bases range from ${minBase.toLocaleString()} to ${maxBase.toLocaleString()}.`,
    helper: "No provider base warnings are present for this result. This remains an advisory check.",
    chips: [`Lowest base: ${minBase.toLocaleString()}`, `Highest base: ${maxBase.toLocaleString()}`, "No base warnings"],
    notes: []
  };
}

function buildExecutionDiagnostics(tile: DashboardTile): AnalysisExecutionDiagnosticsView {
  const statistics = tile.result.statistics;
  const plan = statistics?.significanceExecutionPlan;
  const report = statistics?.significanceExecutionReport;
  const input = statistics?.significanceExecutionInput;

  if (!plan) {
    return {
      status: "unavailable",
      label: "Execution diagnostics unavailable",
      message: "This result does not expose significance execution planning metadata.",
      helper: "Older or external results may not include the provider execution handoff scaffold.",
      chips: ["No execution plan", "Advisory only"],
      details: []
    };
  }

  const reasonLabels = plan.reasonCodes.map(significanceReasonLabel);
  const prerequisiteLabels = plan.unmetPrerequisites.map((item) => {
    if (item === "comparison_basis") return "Comparison basis";
    if (item === "provider_method") return "Provider method";
    if (item === "statistical_engine") return "Statistical engine";
    if (item === "wave_support") return "Wave support";
    return "Execution input";
  });
  const details = Array.from(new Set([...reasonLabels, ...prerequisiteLabels]));

  if (report?.inputAccepted === false || plan.reasonCodes.includes("invalid_execution_input") || report?.reasonCodes.includes("invalid_execution_input")) {
    return {
      status: "invalid",
      label: "Execution input needs review",
      message: "The provider handoff found malformed or incomplete significance execution input.",
      helper: "No statistical output was generated. The adapter returned a structured deferred report with the input issue attached.",
      chips: ["Invalid input", plan.executionInputContract ?? "No input contract", "No test performed"],
      details
    };
  }

  if (plan.status === "blocked" || plan.status === "not_applicable") {
    return {
      status: "unsupported",
      label: plan.status === "blocked" ? "Execution unsupported" : "No execution basis",
      message:
        plan.status === "blocked"
          ? "This context is outside the current significance execution boundary."
          : "This result does not have a comparison structure for significance execution.",
      helper: "The execution adapter stays inactive for unsupported or summary-only contexts.",
      chips: [plan.candidateMethod === "none" ? "No method" : plan.candidateMethod, plan.status === "blocked" ? "Unsupported" : "Not applicable", "No test performed"],
      details
    };
  }

  if (plan.providerCanExecute && report?.status === "not_executed") {
    return {
      status: "ready",
      label: "Execution handoff ready",
      message: "The query shape and provider plan are ready, but the current adapter still does not run statistical tests.",
      helper: "This is a non-calculating scaffold. Future provider code can replace this report with real execution output.",
      chips: [plan.executionInputContract ?? "No input contract", "Ready structure", "Not executed"],
      details
    };
  }

  const deferredComparisons = report?.result?.summary.deferredComparisons ?? 0;
  const hasInput = Boolean(input);

  return {
    status: "deferred",
    label: "Execution deferred",
    message: hasInput
      ? `Column-comparison input was accepted and ${deferredComparisons.toLocaleString()} comparison ${deferredComparisons === 1 ? "pair is" : "pairs are"} shaped as deferred.`
      : "The provider has a candidate method, but no execution input payload is attached.",
    helper: "No p-values, directions, or significance flags are calculated yet.",
    chips: [plan.executionInputContract ?? "No input contract", hasInput ? "Input accepted" : "No input", "Provider deferred"],
    details
  };
}

function buildComparisonDiagnostics(tile: DashboardTile): AnalysisComparisonDiagnosticsView {
  const query = tile.query;
  const resultQuery = tile.result.query;
  const comparisonMode = query.comparisonMode ?? resultQuery.comparisonMode ?? "none";
  const comparisonDatasets = query.comparisonDatasets ?? resultQuery.comparisonDatasets ?? [];
  const waveIds = [query.dataset, ...comparisonDatasets];
  const waveLabels = waveIds.map(datasetWaveLabel);
  const activeFilter = query.filters[0];
  const currentFilterLabel = filterLabel(activeFilter?.field ?? null, activeFilter?.values[0] ?? "all");
  const currentWeightLabel = weightLabel(query.weight);
  const isSummaryOnly = query.breakBy === "SUMMARY" || tile.result.columns.length <= 1 || comparisonMode === "wave";

  if (comparisonMode !== "wave") {
    return {
      status: "inactive",
      label: "No wave comparison active",
      message: `Current result uses ${datasetWaveLabel(query.dataset)} only.`,
      helper: "Turn on wave comparison to compare the selected question across prior waves.",
      waveLabel: datasetWaveLabel(query.dataset),
      filterLabel: currentFilterLabel,
      weightLabel: currentWeightLabel,
      chips: [`Wave: ${datasetWaveLabel(query.dataset)}`, `Filter: ${currentFilterLabel}`, `Weight: ${currentWeightLabel}`],
      limitations: ["Trend diagnostics apply when wave comparison is active."]
    };
  }

  const limitations = [
    comparisonDatasets.length === 0 ? "No comparison waves are selected for the current query." : "",
    isSummaryOnly ? "Wave comparison uses the Summary breakout in the current model." : "",
    "Trend statistics and cross-wave significance tests are not implemented yet.",
    activeFilter ? "Filter context is shown, but cross-wave filter harmonization is not audited yet." : "",
    query.weight ? "Weight context is shown, but weight-method comparability across waves is not audited yet." : ""
  ].filter(Boolean);

  return {
    status: comparisonDatasets.length > 0 ? "limited" : "active",
    label: "Wave comparison context",
    message:
      comparisonDatasets.length > 0
        ? `Comparing ${waveLabels.join(" vs ")} for the selected question.`
        : "Wave comparison is active, but no comparison waves are selected.",
    helper: "This summarizes the comparison setup only. It does not calculate trend statistics or cross-wave significance.",
    waveLabel: waveLabels.join(" vs "),
    filterLabel: currentFilterLabel,
    weightLabel: currentWeightLabel,
    chips: [
      `Waves: ${waveLabels.join(" vs ") || "None"}`,
      isSummaryOnly ? "Summary breakout" : "Custom breakout",
      `Filter: ${currentFilterLabel}`,
      `Weight: ${currentWeightLabel}`
    ],
    limitations
  };
}

export function buildAnalysisStatisticsContext(tile: DashboardTile): AnalysisStatisticsContextView {
  const queryConfidence = tile.query.confidenceLevel ?? 0.95;
  const resultConfidence = tile.result.statistics?.confidenceLevel ?? tile.result.query.confidenceLevel ?? queryConfidence;
  const confidenceChangedSinceRefresh = resultConfidence !== queryConfidence;
  const significance = tile.result.statistics?.significance ?? fallbackSignificance(tile);
  const significanceMethod = significance.method;
  const annotationCount = significance.details.length || tile.result.annotations.length;
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
  const executionDiagnostics = buildExecutionDiagnostics(tile);
  const baseDiagnostics = buildBaseDiagnostics(tile);
  const comparisonDiagnostics = buildComparisonDiagnostics(tile);

  if (significance.hasPlaceholders || significance.status === "placeholder") {
    return {
      status: "placeholder",
      label: "Statistical confidence scaffold",
      currentConfidenceLabel,
      resultConfidenceLabel,
      confidenceChangedSinceRefresh,
      refreshCue,
      eligibility,
      executionDiagnostics,
      baseDiagnostics,
      comparisonDiagnostics,
      significanceLabel,
      message: confidenceChangedSinceRefresh
        ? `Current query is set to ${currentConfidenceLabel}; the displayed result still reflects ${resultConfidenceLabel} until refresh.`
        : `${annotationCount} placeholder significance ${annotationCount === 1 ? "marker" : "markers"} at ${currentConfidenceLabel}.`,
      helper: "Markers are mock placeholders for report rendering and review. They are not a real significance test yet.",
      chips: [...confidenceChips, significanceLabel, `${annotationCount} markers`, "Advisory only"]
    };
  }

  if (significance.status === "eligible") {
    return {
      status: "none",
      label: "Statistical confidence scaffold",
      currentConfidenceLabel,
      resultConfidenceLabel,
      confidenceChangedSinceRefresh,
      refreshCue,
      eligibility,
      executionDiagnostics,
      baseDiagnostics,
      comparisonDiagnostics,
      significanceLabel,
      message: confidenceChangedSinceRefresh
        ? `Current query is set to ${currentConfidenceLabel}; the displayed result still reflects ${resultConfidenceLabel} until refresh.`
        : `This result is eligible for future ${significanceLabel.toLowerCase()} logic at ${currentConfidenceLabel}, but no real test has been run.`,
      helper: "Eligibility is structural only. The current provider does not calculate p-values or significance decisions yet.",
      chips: [...confidenceChips, significanceLabel, "Eligible, not tested", "Advisory only"]
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
    executionDiagnostics,
    baseDiagnostics,
    comparisonDiagnostics,
    significanceLabel,
    message: confidenceChangedSinceRefresh
      ? `Current query is set to ${currentConfidenceLabel}; the displayed result still reflects ${resultConfidenceLabel} until refresh.`
      : `This analysis is configured for ${currentConfidenceLabel}, but no significance method is active.`,
    helper: "Confidence context is shown for transparency. Statistical testing is not implemented for this result yet.",
    chips: [...confidenceChips, significanceLabel, "No markers", "Advisory only"]
  };
}
