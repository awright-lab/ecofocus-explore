import { canvasHeight, canvasWidth } from "../builderConstants";
import { makeElementId, makeTileId, nextZIndex } from "../../document/documentModel";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardPage,
  DashboardTile,
  SavedCompositionBlock,
  SavedDesignAsset
} from "../../../../shared/types/dashboard";
import type { MultiSelectedObject } from "../builderTypes";

type SelectedCompositionObject =
  | { kind: "tile"; tile: DashboardTile; layout: CanvasLayout }
  | { kind: "element"; element: DashboardCanvasElement; layout: CanvasLayout };

function cloneTile(tile: DashboardTile): DashboardTile {
  return {
    ...tile,
    appearance: {
      ...tile.appearance,
      palette: [...tile.appearance.palette],
      gradientStops: [...tile.appearance.gradientStops],
      barGradientStops: [...tile.appearance.barGradientStops],
      barStyles: Object.fromEntries(
        Object.entries(tile.appearance.barStyles).map(([id, style]) => [
          id,
          {
            ...style,
            gradientStops: style.gradientStops ? [...style.gradientStops] : style.gradientStops
          }
        ])
      )
    }
  };
}

function cloneElement(element: DashboardCanvasElement): DashboardCanvasElement {
  return {
    ...element,
    style: {
      ...element.style,
      gradientStops: [...element.style.gradientStops]
    }
  };
}

function selectedObjects(args: {
  page: DashboardPage;
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  multiSelectedObjects: MultiSelectedObject[];
}): SelectedCompositionObject[] {
  const { page, selectedTile, selectedElement, multiSelectedObjects } = args;

  if (multiSelectedObjects.length > 0) {
    return multiSelectedObjects
      .map((item): SelectedCompositionObject | null => {
        if (item.type === "tile") {
          const tile = page.tiles.find((candidate) => candidate.id === item.id);
          return tile ? { kind: "tile", tile, layout: tile.layout } : null;
        }

        const element = page.elements.find((candidate) => candidate.id === item.id);
        return element ? { kind: "element", element, layout: element.layout } : null;
      })
      .filter((item): item is SelectedCompositionObject => Boolean(item));
  }

  if (selectedTile) {
    return [{ kind: "tile", tile: selectedTile, layout: selectedTile.layout }];
  }

  if (selectedElement) {
    return [{ kind: "element", element: selectedElement, layout: selectedElement.layout }];
  }

  return [];
}

function boundsForObjects(objects: SelectedCompositionObject[]) {
  if (objects.length === 0) return null;
  const left = Math.min(...objects.map((item) => item.layout.x));
  const top = Math.min(...objects.map((item) => item.layout.y));
  const right = Math.max(...objects.map((item) => item.layout.x + item.layout.width));
  const bottom = Math.max(...objects.map((item) => item.layout.y + item.layout.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function blockCategory(objects: SelectedCompositionObject[]): SavedCompositionBlock["category"] {
  const hasTile = objects.some((item) => item.kind === "tile");
  const hasImage = objects.some((item) => item.kind === "element" && item.element.type === "image");
  const hasText = objects.some((item) => item.kind === "element" && item.element.type === "text");

  if (hasTile && hasText) return "chart_story";
  if (hasImage && hasText) return "image_story";
  if (hasText) return "narrative";
  return objects.length > 1 ? "callout" : "custom";
}

export function buildCompositionBlockFromSelection(args: {
  page: DashboardPage;
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  multiSelectedObjects: MultiSelectedObject[];
}): SavedCompositionBlock | null {
  const objects = selectedObjects(args);
  const bounds = boundsForObjects(objects);
  if (!bounds || objects.length === 0) return null;

  const tileCount = objects.filter((item) => item.kind === "tile").length;
  const elementCount = objects.length - tileCount;
  const primaryLabel =
    objects[0]?.kind === "tile"
      ? objects[0].tile.title || objects[0].tile.name
      : objects[0]?.element.name ?? "Selection";
  const label = objects.length === 1 ? `${primaryLabel} block` : `${objects.length}-object composition block`;

  return {
    id: `composition_block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    description:
      objects.length === 1
        ? "Reusable block saved from one selected page object."
        : "Reusable block saved from a current-page multi-selection.",
    category: blockCategory(objects),
    createdAt: Date.now(),
    summary: {
      objectCount: objects.length,
      tileCount,
      elementCount,
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    },
    items: objects.map((item) => {
      const relativeLayout = {
        ...item.layout,
        x: item.layout.x - bounds.x,
        y: item.layout.y - bounds.y
      };
      return item.kind === "tile"
        ? { kind: "tile" as const, tile: cloneTile(item.tile), relativeLayout }
        : { kind: "element" as const, element: cloneElement(item.element), relativeLayout };
    })
  };
}

export function createObjectsFromCompositionBlock(block: SavedCompositionBlock, page: DashboardPage) {
  const baseX = Math.max(24, Math.min(canvasWidth - block.summary.width - 24, 72));
  const baseY = Math.max(24, Math.min(canvasHeight - block.summary.height - 24, 72));
  const baseZ = nextZIndex(page);
  const tiles: DashboardTile[] = [];
  const elements: DashboardCanvasElement[] = [];

  block.items.forEach((item, index) => {
    const layout = {
      ...item.relativeLayout,
      x: baseX + item.relativeLayout.x,
      y: baseY + item.relativeLayout.y,
      zIndex: baseZ + index
    };

    if (item.kind === "tile") {
      const nextTileId = makeTileId();
      tiles.push({
        ...cloneTile(item.tile),
        id: nextTileId,
        name: item.tile.name,
        title: item.tile.title,
        locked: false,
        hidden: false,
        layout,
        compositionBlock: {
          id: block.id,
          label: block.label,
          insertedAt: Date.now()
        }
      });
      return;
    }

    elements.push({
      ...cloneElement(item.element),
      id: makeElementId(),
      locked: false,
      hidden: false,
      layout,
      compositionBlock: {
        id: block.id,
        label: block.label,
        insertedAt: Date.now()
      }
    });
  });

  return { tiles, elements };
}

export function createImageElementFromAsset(asset: SavedDesignAsset, page: DashboardPage): DashboardCanvasElement {
  return {
    id: makeElementId(),
    name: asset.label,
    type: "image",
    locked: false,
    hidden: false,
    layout: {
      x: 96,
      y: 96,
      width: 360,
      height: 240,
      zIndex: nextZIndex(page)
    },
    content: asset.url,
    style: {
      fill: "transparent",
      fillMode: "solid",
      gradientFrom: "#ffffff",
      gradientTo: "#ffffff",
      gradientType: "linear",
      gradientStops: [],
      textColor: "#17211b",
      borderColor: "#ffffff",
      borderWidth: 0,
      borderStyle: "none",
      borderRadius: 18,
      opacity: 100,
      shadow: true,
      shadowPreset: "soft",
      shadowColor: "#102332",
      shadowOpacity: 16,
      shadowBlur: 24,
      shadowOffsetX: 0,
      shadowOffsetY: 12,
      glow: false,
      glowColor: "#0fa87a",
      glowSize: 0,
      objectFit: "cover",
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: "500",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "left",
      lineHeight: 1.3,
      padding: 0
    },
    assetSource: {
      id: asset.id,
      label: asset.label,
      kind: asset.kind
    }
  };
}

export function compositionBlockSummary(block: SavedCompositionBlock) {
  const dimensions = `${block.summary.width} x ${block.summary.height}`;
  const objectSummary = `${block.summary.objectCount} object${block.summary.objectCount === 1 ? "" : "s"}`;
  const mix = [block.summary.tileCount ? `${block.summary.tileCount} tile${block.summary.tileCount === 1 ? "" : "s"}` : null, block.summary.elementCount ? `${block.summary.elementCount} element${block.summary.elementCount === 1 ? "" : "s"}` : null]
    .filter(Boolean)
    .join(" · ");
  return {
    dimensions,
    objectSummary,
    mix,
    categoryLabel: block.category.replace("_", " ")
  };
}
