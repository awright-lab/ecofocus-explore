import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
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

function tileTitle(tile: DashboardTile) {
  return tile.title || tile.name || "Untitled object";
}

function canonicalIdFor(tile: DashboardTile) {
  return tile.analysisLifecycle?.canonicalTileId ?? tile.id;
}

function canonicalLabelFor(tile: DashboardTile) {
  return tile.analysisLifecycle?.canonicalLabel ?? tileTitle(tile);
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
