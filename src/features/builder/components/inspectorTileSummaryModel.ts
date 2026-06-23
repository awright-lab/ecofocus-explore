import {
  bannerDimensions,
  filterDimensions
} from "../builderConstants";
import { datasets } from "../../../lib/metadata";
import { getChartTypeLabel, getQuestionLabel } from "../../analytics/analyticsDisplay";
import { comparisonSummaryLabel, tileSourceKindLabel } from "./CanvasRenderers";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export interface InspectorTileSummaryView {
  sourceKind: string;
  sourceLabel: string;
  sourceDescription: string;
  lifecycleLabel: string;
  lifecycleDescription: string;
  lifecycleChips: string[];
  title: string;
  subtitle: string;
  chips: string[];
  editCue: string;
}

function filterSummary(tile: DashboardTile) {
  if (tile.query.filters.length === 0) return "None";
  return tile.query.filters
    .map((filter) => {
      const dimension = filterDimensions.find((item) => item.id === filter.field);
      if (!dimension) return filter.values.join(", ");
      const values = filter.values
        .filter((value) => value !== "all")
        .map((value) => dimension.values.find((item) => item.id === value)?.label ?? value);
      return values.length ? `${dimension.label}: ${values.join(", ")}` : `All ${dimension.label.toLowerCase()}s`;
    })
    .join(" · ");
}

function sourceDescription(tile: DashboardTile) {
  if (tile.derivedOutput) {
    const outputLabel = tile.derivedOutput.kind === "top_n_extract"
      ? "top-N extract"
      : tile.derivedOutput.kind === "bottom_n_extract"
        ? "bottom-N extract"
        : "lead row summary";
    return `Derived ${outputLabel} from ${tile.derivedOutput.sourceTitle}.`;
  }
  if (tile.source?.kind === "variableSet") return "Based on a saved variable set. Row structure and saved defaults can be refined from the source library.";
  if (tile.source?.kind === "question") return "Based on a dataset question. Query settings can be edited below for this report object.";
  return "Based on an ad hoc query. Query settings can be edited below for this report object.";
}

function lifecycleSummary(tile: DashboardTile) {
  const lifecycle = tile.analysisLifecycle;

  if (lifecycle?.role === "derived") {
    return {
      label: "Derived visualization",
      description: lifecycle.derivedFrom
        ? `Derived from ${lifecycle.derivedFrom.title}. Refresh and source settings still follow the analytical query on this object.`
        : `Derived from ${lifecycle.canonicalLabel}. Refresh and source settings still follow the analytical query on this object.`,
      chips: [
        `Canonical: ${lifecycle.canonicalLabel}`,
        lifecycle.derivedFrom ? `From: ${lifecycle.derivedFrom.title}` : "From: canonical source",
        lifecycle.derivedFrom ? `Original view: ${getChartTypeLabel(lifecycle.derivedFrom.visualization)}` : "Original view: Source table"
      ]
    };
  }

  return {
    label: "Canonical source object",
    description: "This tile is the source analytical object for its current query and visualization.",
    chips: [`Canonical: ${lifecycle?.canonicalLabel ?? (tile.title || tile.name)}`, "Role: Source object"]
  };
}

export function buildInspectorTileSummary(tile: DashboardTile): InspectorTileSummaryView {
  const bannerLabel = bannerDimensions.find((item) => item.id === tile.query.breakBy)?.label ?? tile.query.breakBy;
  const metricLabel = tile.result.metric.label;
  const questionLabel = getQuestionLabel(tile.result.metadataRefs.question);
  const weightLabel = tile.result.weighting.applied ? tile.result.weighting.label : "Unweighted";
  const visualizationLabel = getChartTypeLabel(tile.visualization);
  const datasetWave = datasets.find((dataset) => dataset.id === tile.query.dataset)?.wave ?? tile.query.dataset;
  const lifecycle = lifecycleSummary(tile);
  const derivedOutputChips = tile.derivedOutput
    ? [
      `Derived output: ${tile.derivedOutput.kind === "top_n_extract" ? "Top-N extract" : tile.derivedOutput.kind === "bottom_n_extract" ? "Bottom-N extract" : "Lead row summary"}`,
      tile.derivedOutput.kind === "top_n_extract" || tile.derivedOutput.kind === "bottom_n_extract" ? `${tile.derivedOutput.rowCount ?? 0} rows` : tile.derivedOutput.rowLabel ?? "Summary row",
      `${tile.derivedOutput.columnLabel}${tile.derivedOutput.valueLabel ? `: ${tile.derivedOutput.valueLabel}` : ""}`,
      ...(tile.derivedOutput.baseLabel ? [tile.derivedOutput.baseLabel] : [])
    ]
    : [];

  return {
    sourceKind: tileSourceKindLabel(tile.source),
    sourceLabel: tile.source?.label ?? questionLabel,
    sourceDescription: sourceDescription(tile),
    lifecycleLabel: lifecycle.label,
    lifecycleDescription: lifecycle.description,
    lifecycleChips: lifecycle.chips,
    title: tile.title || tile.name,
    subtitle: `${visualizationLabel} from ${tileSourceKindLabel(tile.source).toLowerCase()}`,
    chips: [
      ...derivedOutputChips,
      `Question: ${questionLabel}`,
      `Source: ${tile.source?.label ?? "Ad hoc query"}`,
      `Visualization: ${visualizationLabel}`,
      `Banner: ${bannerLabel}`,
      `Metric: ${metricLabel}`,
      `Filter: ${filterSummary(tile)}`,
      `Weight: ${weightLabel}`,
      `Compare: ${comparisonSummaryLabel(tile.query)}`,
      `Dataset: ${datasetWave}`
    ],
    editCue: "Use Edit analysis below to change the question, banner, metric, filters, weights, comparison, or refresh this selected object."
  };
}
