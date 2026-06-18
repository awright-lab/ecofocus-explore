import { canvasHeight, canvasWidth } from "./builderConstants";
import { defaultElementStyle, defaultPageDesign } from "../document/documentSeeds";
import { makeElementId, makePageId, makeTileId, nextZIndex } from "../document/documentModel";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardCanvasElementType,
  DashboardPage,
  DashboardTile,
  PageMasterPreset,
  PageTemplatePreset,
  PageThemePreset,
  TextBlockPreset
} from "../../../shared/types/dashboard";

type CanvasElementInsertionPlacement =
  | { mode: "default" }
  | { mode: "below-selection"; referenceLayout: CanvasLayout };

export function buildPageFromTemplate(args: {
  template?: PageTemplatePreset;
  pageCount: number;
  pageThemes: PageThemePreset[];
  pageMasters: PageMasterPreset[];
}): DashboardPage {
  const { template, pageCount, pageThemes, pageMasters } = args;
  const pageTheme = pageThemes.find((item) => item.id === template?.pageThemeId) ?? pageThemes[0];
  const pageMaster = pageMasters.find((item) => item.id === template?.pageMasterId);

  return {
    id: makePageId(),
    title: template ? template.label : `Page ${pageCount + 1}`,
    order: pageCount + 1,
    provenance: {
      templateId: template?.id,
      templateLabel: template?.label,
      themeId: pageTheme?.id,
      themeLabel: pageTheme?.label,
      masterId: pageMaster?.id,
      masterLabel: pageMaster?.label,
      masterStatus: pageMaster ? "master-based" : "none",
      status: template ? "template-derived" : "custom"
    },
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

export function createElementsFromPageMaster(pageMaster: PageMasterPreset, activePage: DashboardPage): DashboardCanvasElement[] {
  return pageMaster.elements.map((element, index) => ({
    id: makeElementId(),
    name: element.name,
    type: "text" as const,
    locked: false,
    hidden: false,
    layout: {
      ...element.layout,
      zIndex: nextZIndex(activePage) + index
    },
    content: element.content,
    style: {
      ...defaultElementStyle("text"),
      ...element.style
    }
  }));
}

export function duplicatePage(page: DashboardPage, pageCount: number): DashboardPage {
  const tileIdMap = new Map(page.tiles.map((tile) => [tile.id, makeTileId()]));

  return {
    ...page,
    id: makePageId(),
    title: `${page.title} copy`,
    order: pageCount + 1,
    provenance: {
      ...page.provenance,
      masterStatus: page.provenance?.masterStatus ?? (page.provenance?.masterId ? "master-based" : "none"),
      status: "custom"
    },
    elements: page.elements.map((element) => ({
      ...element,
      id: makeElementId(),
      layout: { ...element.layout, zIndex: element.layout.zIndex }
    })),
    tiles: page.tiles.map((tile) => {
      const nextTileId = tileIdMap.get(tile.id) ?? makeTileId();
      const mappedCanonicalId = tile.analysisLifecycle?.canonicalTileId
        ? tileIdMap.get(tile.analysisLifecycle.canonicalTileId)
        : undefined;
      const mappedDerivedFromId = tile.analysisLifecycle?.derivedFrom?.tileId
        ? tileIdMap.get(tile.analysisLifecycle.derivedFrom.tileId)
        : undefined;

      return {
        ...tile,
        id: nextTileId,
        analysisLifecycle:
          tile.analysisLifecycle?.role === "derived"
            ? {
                ...tile.analysisLifecycle,
                canonicalTileId: mappedCanonicalId ?? tile.analysisLifecycle.canonicalTileId,
                derivedFrom: tile.analysisLifecycle.derivedFrom
                  ? {
                      ...tile.analysisLifecycle.derivedFrom,
                      tileId: mappedDerivedFromId ?? tile.analysisLifecycle.derivedFrom.tileId
                    }
                  : tile.analysisLifecycle.derivedFrom
              }
            : {
                role: "canonical",
                canonicalTileId: nextTileId,
                canonicalLabel: `${tile.title} copy`
              },
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
      };
    })
  };
}

export function reorderPage(pages: DashboardPage[], pageId: string, direction: "up" | "down"): DashboardPage[] {
  const sortedPages = [...pages].sort((first, second) => first.order - second.order);
  const currentIndex = sortedPages.findIndex((page) => page.id === pageId);
  if (currentIndex === -1) return pages;

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= sortedPages.length) return pages;

  const nextPages = [...sortedPages];
  const [page] = nextPages.splice(currentIndex, 1);
  nextPages.splice(nextIndex, 0, page);

  return nextPages.map((nextPage, index) => ({
    ...nextPage,
    order: index + 1
  }));
}

export function remainingPagesAfterDelete(sortedPages: DashboardPage[], activePage: DashboardPage): DashboardPage[] {
  return sortedPages.filter((page) => page.id !== activePage.id).map((page, index) => ({ ...page, order: index + 1 }));
}

function canvasElementDefaultSize(type: DashboardCanvasElementType) {
  return {
    width: type === "text" ? 280 : 220,
    height: type === "text" ? 80 : 160
  };
}

function canvasElementInsertionPosition(
  type: DashboardCanvasElementType,
  activePage: DashboardPage,
  placement: CanvasElementInsertionPlacement = { mode: "default" }
) {
  const size = canvasElementDefaultSize(type);

  if (placement.mode === "below-selection") {
    return {
      x: Math.max(24, Math.min(canvasWidth - size.width - 24, placement.referenceLayout.x)),
      y: Math.max(24, Math.min(canvasHeight - size.height - 24, placement.referenceLayout.y + placement.referenceLayout.height + 24)),
      ...size,
      zIndex: nextZIndex(activePage)
    };
  }

  return {
    x: 64,
    y: 64,
    ...size,
    zIndex: nextZIndex(activePage)
  };
}

export function createCanvasElement(
  type: DashboardCanvasElementType,
  activePage: DashboardPage,
  placement?: CanvasElementInsertionPlacement
): DashboardCanvasElement {
  return {
    id: makeElementId(),
    name: type === "text" ? "Text" : type === "image" ? "Image" : type === "circle" ? "Circle" : "Rectangle",
    type,
    locked: false,
    hidden: false,
    layout: canvasElementInsertionPosition(type, activePage, placement),
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
  const nextTileId = makeTileId();
  return {
    ...tile,
    id: nextTileId,
    name: `${tile.name} copy`,
    title: `${tile.title} copy`,
    analysisLifecycle:
      tile.analysisLifecycle?.role === "derived"
        ? tile.analysisLifecycle
        : {
            role: "canonical",
            canonicalTileId: nextTileId,
            canonicalLabel: `${tile.title} copy`
          },
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
