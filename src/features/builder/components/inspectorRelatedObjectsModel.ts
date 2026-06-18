import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { AnalyticsFilter, AnalyticsQueryRequest } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";
import type { RelatedObjectNavigationCue } from "../builderTypes";

export interface RelatedAnalyticalObjectRow {
  id: string;
  title: string;
  description: string;
  badges: string[];
  relationship: "canonical" | "derived" | "sibling";
}

export interface RelatedAnalyticalObjectsView {
  label: string;
  description: string;
  emptyLabel: string;
  rows: RelatedAnalyticalObjectRow[];
}

export interface RelatedObjectNavigationCueView {
  label: string;
  message: string;
  helper: string;
}

export interface DerivedObjectFreshnessView {
  status: "current" | "diverged" | "missingCanonical";
  label: string;
  message: string;
  helper: string;
}

export interface IndependentDerivedContractView {
  label: string;
  message: string;
  helper: string;
}

function tileTitle(tile: DashboardTile) {
  return tile.title || tile.name || "Untitled object";
}

function canonicalIdFor(tile: DashboardTile) {
  return tile.analysisLifecycle?.canonicalTileId ?? tile.id;
}

function canonicalLabelFor(tile: DashboardTile) {
  return tile.analysisLifecycle?.canonicalLabel ?? tileTitle(tile);
}

function normalizedFilters(filters: AnalyticsFilter[]) {
  return [...filters]
    .map((filter) => ({
      field: filter.field,
      values: [...filter.values].sort()
    }))
    .sort((first, second) => first.field.localeCompare(second.field));
}

function queryContext(query: AnalyticsQueryRequest) {
  return {
    dataset: query.dataset,
    question: query.question,
    breakBy: query.breakBy,
    filters: normalizedFilters(query.filters),
    weight: query.weight,
    metric: query.metric,
    confidenceLevel: query.confidenceLevel,
    comparisonMode: query.comparisonMode ?? "none",
    comparisonDatasets: [...(query.comparisonDatasets ?? [])].sort()
  };
}

function sameQueryContext(first: AnalyticsQueryRequest, second: AnalyticsQueryRequest) {
  return JSON.stringify(queryContext(first)) === JSON.stringify(queryContext(second));
}

function relatedRow(
  tile: DashboardTile,
  relation: string,
  relationship: RelatedAnalyticalObjectRow["relationship"]
): RelatedAnalyticalObjectRow {
  return {
    id: tile.id,
    title: tileTitle(tile),
    description: relation,
    relationship,
    badges: [
      getChartTypeLabel(tile.visualization),
      tile.analysisLifecycle?.role === "derived" ? "Derived view" : "Canonical source"
    ]
  };
}

export function buildRelatedAnalyticalObjectsView(
  selectedTile: DashboardTile,
  pageTiles: DashboardTile[]
): RelatedAnalyticalObjectsView {
  const canonicalTileId = canonicalIdFor(selectedTile);
  const canonicalTile = pageTiles.find((tile) => tile.id === canonicalTileId);
  const derivedTiles = pageTiles.filter(
    (tile) => tile.id !== selectedTile.id
      && tile.analysisLifecycle?.role === "derived"
      && canonicalIdFor(tile) === canonicalTileId
  );

  if (selectedTile.analysisLifecycle?.role === "derived") {
    const rows = [
      ...(canonicalTile ? [relatedRow(canonicalTile, "Canonical source object on this page", "canonical")] : []),
      ...derivedTiles.map((tile) => relatedRow(tile, "Sibling derived view on this page", "sibling"))
    ];

    return {
      label: "Related analytical objects",
      description: `Current page relationships for ${canonicalLabelFor(selectedTile)}.`,
      emptyLabel: "No canonical source or sibling views found on this page.",
      rows
    };
  }

  return {
    label: "Related analytical objects",
    description: "Derived visualizations on the current page that reference this canonical source object.",
    emptyLabel: "No derived views from this source on the current page yet.",
    rows: derivedTiles.map((tile) => relatedRow(tile, "Derived from this canonical source", "derived"))
  };
}

export function buildRelatedObjectNavigationCueView(
  cue: RelatedObjectNavigationCue,
  tile: DashboardTile,
  now = Date.now()
): RelatedObjectNavigationCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  if (cue.relationship === "canonical") {
    return {
      label: "Viewing canonical source object",
      message: `Opened ${cue.targetTitle} from the related objects for ${cue.fromTitle}.`,
      helper: "This is the source object for related derived visualizations on the current page."
    };
  }

  if (cue.relationship === "sibling") {
    return {
      label: "Viewing sibling derived visualization",
      message: `Opened ${cue.targetTitle} from the related objects for ${cue.fromTitle}.`,
      helper: "Both objects reference the same canonical analytical source on this page."
    };
  }

  return {
    label: "Viewing derived visualization",
    message: `Opened ${cue.targetTitle} from the related objects for ${cue.fromTitle}.`,
    helper: "This visualization is derived from that canonical analytical source on the current page."
  };
}

export function buildDerivedObjectFreshnessView(
  selectedTile: DashboardTile,
  pageTiles: DashboardTile[]
): DerivedObjectFreshnessView | null {
  if (selectedTile.analysisLifecycle?.role !== "derived") return null;

  const canonicalTile = pageTiles.find((tile) => tile.id === canonicalIdFor(selectedTile));
  if (!canonicalTile) {
    return {
      status: "missingCanonical",
      label: "Canonical source not on this page",
      message: `${canonicalLabelFor(selectedTile)} was not found on the current page.`,
      helper: "Freshness is limited to current-page relationships until cross-page lifecycle management is added."
    };
  }

  if (sameQueryContext(selectedTile.query, canonicalTile.query)) {
    return {
      status: "current",
      label: "Matches canonical query context",
      message: `This derived view uses the same analytical inputs as ${tileTitle(canonicalTile)}.`,
      helper: "The visualization can differ, but source, banner, filters, weight, metric, and comparison settings match."
    };
  }

  return {
    status: "diverged",
    label: "May have diverged from canonical query",
    message: `This derived view no longer uses the same analytical inputs as ${tileTitle(canonicalTile)}.`,
    helper: "Review source, banner, filters, weight, metric, or comparison settings before treating the views as aligned."
  };
}

export function buildIndependentDerivedContractView(selectedTile: DashboardTile): IndependentDerivedContractView | null {
  if (selectedTile.analysisLifecycle?.role !== "derived") return null;

  return {
    label: "Independent derived view",
    message: "This visualization keeps provenance to its canonical source, but it does not auto-sync with that source.",
    helper: "Freshness compares query context only. Edit and refresh this object independently when its settings should change."
  };
}
