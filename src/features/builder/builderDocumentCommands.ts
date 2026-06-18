import { canvasHeight, canvasWidth } from "./builderConstants";
import { defaultElementStyle, defaultPageDesign } from "../document/documentSeeds";
import { makeElementId, makePageId, makeTileId, nextZIndex } from "../document/documentModel";
import type {
  DashboardCanvasElement,
  DashboardCanvasElementType,
  DashboardPage,
  DashboardTile,
  PageTemplatePreset,
  PageThemePreset,
  TextBlockPreset
} from "../../../shared/types/dashboard";

export function buildPageFromTemplate(args: {
  template?: PageTemplatePreset;
  pageCount: number;
  pageThemes: PageThemePreset[];
}): DashboardPage {
  const { template, pageCount, pageThemes } = args;
  const pageTheme = pageThemes.find((item) => item.id === template?.pageThemeId) ?? pageThemes[0];

  return {
    id: makePageId(),
    title: template ? template.label : `Page ${pageCount + 1}`,
    order: pageCount + 1,
    ...defaultPageDesign(),
    ...(pageTheme
      ? {
          backgroundMode: pageTheme.backgroundMode,
          background: pageTheme.background,
          backgroundImage: pageTheme.backgroundImage,
          backgroundImageFit: pageTheme.backgroundImageFit,
          gradientFrom: pageTheme.gradientFrom,
          gradientTo: pageTheme.gradientTo,
          gradientType: pageTheme.gradientType,
          gradientAngle: pageTheme.gradientAngle,
          gradientStops: pageTheme.gradientStops,
          showCanvasGrid: pageTheme.showCanvasGrid
        }
      : {}),
    elements:
      template?.elements.map((element, index) => ({
        id: makeElementId(),
        name: element.name,
        type: "text" as const,
        locked: false,
        hidden: false,
        layout: { ...element.layout, zIndex: index + 1 },
        content: element.content,
        style: {
          ...defaultElementStyle("text"),
          ...element.style
        }
      })) ?? [],
    tiles: []
  };
}

export function duplicatePage(page: DashboardPage, pageCount: number): DashboardPage {
  return {
    ...page,
    id: makePageId(),
    title: `${page.title} copy`,
    order: pageCount + 1,
    elements: page.elements.map((element) => ({
      ...element,
      id: makeElementId(),
      layout: { ...element.layout, zIndex: element.layout.zIndex }
    })),
    tiles: page.tiles.map((tile) => ({
      ...tile,
      id: makeTileId(),
      layout: { ...tile.layout, zIndex: tile.layout.zIndex },
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
    }))
  };
}

export function remainingPagesAfterDelete(sortedPages: DashboardPage[], activePage: DashboardPage): DashboardPage[] {
  return sortedPages.filter((page) => page.id !== activePage.id).map((page, index) => ({ ...page, order: index + 1 }));
}

export function createCanvasElement(type: DashboardCanvasElementType, activePage: DashboardPage): DashboardCanvasElement {
  return {
    id: makeElementId(),
    name: type === "text" ? "Text" : type === "image" ? "Image" : type === "circle" ? "Circle" : "Rectangle",
    type,
    locked: false,
    hidden: false,
    layout: { x: 64, y: 64, width: type === "text" ? 280 : 220, height: type === "text" ? 80 : 160, zIndex: nextZIndex(activePage) },
    content: type === "text" ? "Text box" : "",
    style: defaultElementStyle(type)
  };
}

export function createTextBlockElement(block: TextBlockPreset, activePage: DashboardPage): DashboardCanvasElement {
  return {
    id: makeElementId(),
    name: block.label,
    type: "text",
    locked: false,
    hidden: false,
    layout: {
      x: Math.round((canvasWidth - block.width) / 2),
      y: Math.round((canvasHeight - block.height) / 2),
      width: block.width,
      height: block.height,
      zIndex: nextZIndex(activePage)
    },
    content: block.content,
    style: {
      ...defaultElementStyle("text"),
      ...block.style
    }
  };
}

export function duplicateTile(tile: DashboardTile, activePage: DashboardPage): DashboardTile {
  return {
    ...tile,
    id: makeTileId(),
    name: `${tile.name} copy`,
    title: `${tile.title} copy`,
    layout: {
      ...tile.layout,
      x: tile.layout.x + 24,
      y: tile.layout.y + 24,
      zIndex: nextZIndex(activePage)
    },
    appearance: {
      ...tile.appearance,
      palette: [...tile.appearance.palette],
      barStyles: { ...tile.appearance.barStyles }
    }
  };
}

export function duplicateElement(element: DashboardCanvasElement, activePage: DashboardPage): DashboardCanvasElement {
  return {
    ...element,
    id: makeElementId(),
    name: `${element.name} copy`,
    layout: {
      ...element.layout,
      x: element.layout.x + 24,
      y: element.layout.y + 24,
      zIndex: nextZIndex(activePage)
    },
    style: { ...element.style }
  };
}
