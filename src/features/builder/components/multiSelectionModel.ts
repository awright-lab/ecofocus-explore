import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";
import type { MultiSelectedObject } from "../builderTypes";

export interface MultiSelectionSummary {
  tiles: DashboardTile[];
  elements: DashboardCanvasElement[];
  count: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  spreadLabel: string;
}

export function buildMultiSelectionSummary(activePage: DashboardPage, multiSelectedObjects: MultiSelectedObject[]): MultiSelectionSummary {
  const tiles = activePage.tiles.filter((tile) => multiSelectedObjects.some((item) => item.type === "tile" && item.id === tile.id));
  const elements = activePage.elements.filter((element) => multiSelectedObjects.some((item) => item.type === "element" && item.id === element.id));
  const layouts = [...tiles.map((tile) => tile.layout), ...elements.map((element) => element.layout)];

  if (layouts.length === 0) {
    return {
      tiles,
      elements,
      count: 0,
      bounds: null,
      spreadLabel: "No current-page objects selected"
    };
  }

  const minX = Math.min(...layouts.map((layout) => layout.x));
  const minY = Math.min(...layouts.map((layout) => layout.y));
  const maxX = Math.max(...layouts.map((layout) => layout.x + layout.width));
  const maxY = Math.max(...layouts.map((layout) => layout.y + layout.height));
  const bounds = {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY)
  };

  return {
    tiles,
    elements,
    count: layouts.length,
    bounds,
    spreadLabel: `${bounds.width}x${bounds.height} footprint`
  };
}
