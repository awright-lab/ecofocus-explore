import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export interface RelatedAnalyticalObjectRow {
  id: string;
  title: string;
  description: string;
  badges: string[];
}

export interface RelatedAnalyticalObjectsView {
  label: string;
  description: string;
  emptyLabel: string;
  rows: RelatedAnalyticalObjectRow[];
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

function relatedRow(tile: DashboardTile, relation: string): RelatedAnalyticalObjectRow {
  return {
    id: tile.id,
    title: tileTitle(tile),
    description: relation,
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
      ...(canonicalTile ? [relatedRow(canonicalTile, "Canonical source object on this page")] : []),
      ...derivedTiles.map((tile) => relatedRow(tile, "Sibling derived view on this page"))
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
    rows: derivedTiles.map((tile) => relatedRow(tile, "Derived from this canonical source"))
  };
}
