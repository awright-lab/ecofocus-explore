import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";
import type { MultiSelectedObject } from "../builderTypes";

export type MultiSelectionLayoutAction =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distributeHorizontal"
  | "distributeVertical";

interface SelectedLayoutItem {
  id: string;
  type: "tile" | "element";
  layout: DashboardTile["layout"];
}

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
  footprintLabel: string;
  horizontalGapLabel: string;
  verticalGapLabel: string;
}

function selectedLayoutItems(activePage: DashboardPage, multiSelectedObjects: MultiSelectedObject[]): SelectedLayoutItem[] {
  const tiles = activePage.tiles.filter((tile) => multiSelectedObjects.some((item) => item.type === "tile" && item.id === tile.id));
  const elements = activePage.elements.filter((element) => multiSelectedObjects.some((item) => item.type === "element" && item.id === element.id));

  return [
    ...tiles.map((tile) => ({ id: tile.id, type: "tile" as const, layout: tile.layout })),
    ...elements.map((element) => ({ id: element.id, type: "element" as const, layout: element.layout }))
  ];
}

function averageGap(items: SelectedLayoutItem[], axis: "x" | "y") {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => a.layout[axis] - b.layout[axis]);
  const gaps = sorted.slice(1).map((item, index) => {
    const previous = sorted[index];
    const previousEnd = axis === "x" ? previous.layout.x + previous.layout.width : previous.layout.y + previous.layout.height;
    return item.layout[axis] - previousEnd;
  });
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

  return Math.round(average);
}

export function buildMultiSelectionSummary(activePage: DashboardPage, multiSelectedObjects: MultiSelectedObject[]): MultiSelectionSummary {
  const tiles = activePage.tiles.filter((tile) => multiSelectedObjects.some((item) => item.type === "tile" && item.id === tile.id));
  const elements = activePage.elements.filter((element) => multiSelectedObjects.some((item) => item.type === "element" && item.id === element.id));
  const items = selectedLayoutItems(activePage, multiSelectedObjects);
  const layouts = items.map((item) => item.layout);

  if (layouts.length === 0) {
    return {
      tiles,
      elements,
      count: 0,
      bounds: null,
      spreadLabel: "No current-page objects selected",
      footprintLabel: "No footprint",
      horizontalGapLabel: "Horizontal spacing unavailable",
      verticalGapLabel: "Vertical spacing unavailable"
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
    spreadLabel: `${bounds.width}x${bounds.height} footprint`,
    footprintLabel: `Covers ${bounds.width} x ${bounds.height} px from ${bounds.x}, ${bounds.y}`,
    horizontalGapLabel: averageGap(items, "x") === null ? "Horizontal spacing unavailable" : `Avg horizontal gap ${averageGap(items, "x")} px`,
    verticalGapLabel: averageGap(items, "y") === null ? "Vertical spacing unavailable" : `Avg vertical gap ${averageGap(items, "y")} px`
  };
}

export function buildMultiSelectionLayoutUpdates(
  activePage: DashboardPage,
  multiSelectedObjects: MultiSelectedObject[],
  action: MultiSelectionLayoutAction
) {
  const items = selectedLayoutItems(activePage, multiSelectedObjects);
  if (items.length < 2) return new Map<string, Partial<DashboardTile["layout"]>>();

  const minX = Math.min(...items.map((item) => item.layout.x));
  const minY = Math.min(...items.map((item) => item.layout.y));
  const maxX = Math.max(...items.map((item) => item.layout.x + item.layout.width));
  const maxY = Math.max(...items.map((item) => item.layout.y + item.layout.height));
  const centerX = minX + (maxX - minX) / 2;
  const centerY = minY + (maxY - minY) / 2;
  const updates = new Map<string, Partial<DashboardTile["layout"]>>();

  if (["left", "center", "right", "top", "middle", "bottom"].includes(action)) {
    items.forEach((item) => {
      const nextLayout: Partial<DashboardTile["layout"]> = {};
      if (action === "left") nextLayout.x = Math.round(minX);
      if (action === "center") nextLayout.x = Math.round(centerX - item.layout.width / 2);
      if (action === "right") nextLayout.x = Math.round(maxX - item.layout.width);
      if (action === "top") nextLayout.y = Math.round(minY);
      if (action === "middle") nextLayout.y = Math.round(centerY - item.layout.height / 2);
      if (action === "bottom") nextLayout.y = Math.round(maxY - item.layout.height);
      updates.set(`${item.type}:${item.id}`, nextLayout);
    });

    return updates;
  }

  if (action === "distributeHorizontal") {
    const sorted = [...items].sort((a, b) => a.layout.x - b.layout.x);
    const totalWidth = sorted.reduce((sum, item) => sum + item.layout.width, 0);
    const gap = sorted.length > 1 ? (maxX - minX - totalWidth) / (sorted.length - 1) : 0;
    let cursor = minX;
    sorted.forEach((item) => {
      updates.set(`${item.type}:${item.id}`, { x: Math.round(cursor) });
      cursor += item.layout.width + gap;
    });
  }

  if (action === "distributeVertical") {
    const sorted = [...items].sort((a, b) => a.layout.y - b.layout.y);
    const totalHeight = sorted.reduce((sum, item) => sum + item.layout.height, 0);
    const gap = sorted.length > 1 ? (maxY - minY - totalHeight) / (sorted.length - 1) : 0;
    let cursor = minY;
    sorted.forEach((item) => {
      updates.set(`${item.type}:${item.id}`, { y: Math.round(cursor) });
      cursor += item.layout.height + gap;
    });
  }

  return updates;
}
