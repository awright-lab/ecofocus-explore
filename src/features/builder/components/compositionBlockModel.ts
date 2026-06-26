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

export type SmartCompositionStarterId = "selected_tile_story" | "comparison_insight" | "methodology_chart_section";

export type SmartCompositionStarterView = {
  id: SmartCompositionStarterId;
  label: string;
  description: string;
  requirementLabel: string;
  readinessLabel: string;
  helperText: string;
  ready: boolean;
  recommended: boolean;
  tags: string[];
};

type SmartStarterDefinition = {
  id: SmartCompositionStarterId;
  label: string;
  description: string;
  requirementLabel: string;
  tags: string[];
};

const smartStarterDefinitions: SmartStarterDefinition[] = [
  {
    id: "selected_tile_story",
    label: "Selected chart story",
    description: "Build a chart plus commentary section from the analytical tile you already selected.",
    requirementLabel: "Needs an analytical tile",
    tags: ["tile", "insight"]
  },
  {
    id: "comparison_insight",
    label: "Comparison insight section",
    description: "Frame a breakout or wave comparison with a focused interpretation block and source note.",
    requirementLabel: "Best for comparison analyses",
    tags: ["tile", "comparison"]
  },
  {
    id: "methodology_chart_section",
    label: "Chart with methodology note",
    description: "Pair the current analysis with a compact base, filter, weight, and confidence note.",
    requirementLabel: "Needs an analytical tile",
    tags: ["tile", "methodology"]
  }
];

export const compositionBlockCategoryOptions: Array<{ id: SavedCompositionBlock["category"]; label: string; helper: string }> = [
  { id: "title_section", label: "Title section", helper: "Headline, subhead, and page opener structure" },
  { id: "chart_commentary", label: "Chart commentary", helper: "Analytical tile with supporting explanation" },
  { id: "quote_stat", label: "Quote/stat block", helper: "Editorial proof point, quote, or metric callout" },
  { id: "methodology", label: "Methodology note", helper: "Source, sample, or footnote structure" },
  { id: "image_caption", label: "Image caption", helper: "Visual with caption or supporting copy" },
  { id: "callout", label: "Callout", helper: "Reusable emphasis or annotation block" },
  { id: "narrative", label: "Narrative text", helper: "Reusable explanatory text structure" },
  { id: "chart_story", label: "Chart story", helper: "Legacy chart and commentary block" },
  { id: "image_story", label: "Image story", helper: "Legacy image and narrative block" },
  { id: "custom", label: "Custom", helper: "General reusable composition pattern" }
];

export function compositionBlockCategoryLabel(category: SavedCompositionBlock["category"]) {
  return compositionBlockCategoryOptions.find((option) => option.id === category)?.label ?? "Custom";
}

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

function baseTextStyle(overrides: Partial<DashboardCanvasElement["style"]> = {}): DashboardCanvasElement["style"] {
  const { gradientStops, ...styleOverrides } = overrides;
  return {
    fill: "transparent",
    fillMode: "solid",
    gradientFrom: "#ffffff",
    gradientTo: "#ffffff",
    gradientType: "linear",
    textColor: "#17211b",
    borderColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
    borderRadius: 0,
    opacity: 100,
    shadow: false,
    shadowPreset: "soft",
    shadowColor: "#142019",
    shadowOpacity: 12,
    shadowBlur: 18,
    shadowOffsetX: 0,
    shadowOffsetY: 8,
    glow: false,
    glowColor: "#0fa87a",
    glowSize: 0,
    objectFit: "cover",
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "600",
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
    lineHeight: 1.35,
    padding: 0,
    ...styleOverrides,
    gradientStops: gradientStops ?? []
  };
}

function smartStarterTextElement(args: {
  id: string;
  name: string;
  content: string;
  layout: CanvasLayout;
  style?: Partial<DashboardCanvasElement["style"]>;
}): DashboardCanvasElement {
  return {
    id: args.id,
    name: args.name,
    type: "text",
    locked: false,
    hidden: false,
    layout: args.layout,
    content: args.content,
    style: baseTextStyle(args.style)
  };
}

function smartStarterShapeElement(args: {
  id: string;
  name: string;
  layout: CanvasLayout;
  style?: Partial<DashboardCanvasElement["style"]>;
}): DashboardCanvasElement {
  return {
    id: args.id,
    name: args.name,
    type: "rectangle",
    locked: false,
    hidden: false,
    layout: args.layout,
    content: "",
    style: baseTextStyle({
      fill: "#f7fbf9",
      borderColor: "#d8e7df",
      borderWidth: 1,
      borderStyle: "solid",
      borderRadius: 18,
      ...args.style
    })
  };
}

function comparisonContextLabel(tile: DashboardTile) {
  if ((tile.query.comparisonMode ?? "none") === "wave") {
    const comparisonDatasets = tile.query.comparisonDatasets ?? [];
    return comparisonDatasets.length
      ? `${comparisonDatasets.length + 1} waves compared`
      : "Wave comparison setup";
  }
  if (tile.result.columns.length > 1) return `${tile.result.columns.length} comparison columns`;
  if (tile.query.breakBy !== "SUMMARY") return `Breakout by ${tile.query.breakBy}`;
  return "Summary view";
}

function tileMethodologyLabel(tile: DashboardTile) {
  const filter = tile.query.filters[0];
  const filterLabel = filter && filter.values[0] !== "all" ? `${filter.field}: ${filter.values.join(", ")}` : "No filter";
  const weightLabel = tile.query.weight ? `Weighted: ${tile.query.weight}` : "Unweighted";
  const confidenceLabel = `${Math.round((tile.query.confidenceLevel ?? 0.95) * 100)}% confidence context`;
  return `${filterLabel}. ${weightLabel}. ${confidenceLabel}.`;
}

function isComparisonTile(tile: DashboardTile | null) {
  if (!tile) return false;
  return (tile.query.comparisonMode ?? "none") !== "none" || tile.result.columns.length > 1 || tile.query.breakBy !== "SUMMARY";
}

function smartStarterSummaryText(starterId: SmartCompositionStarterId, tile: DashboardTile) {
  if (starterId === "comparison_insight") {
    return `Use this space to explain the strongest contrast in ${comparisonContextLabel(tile).toLowerCase()}. Replace this copy with the comparison that matters most.`;
  }
  if (starterId === "methodology_chart_section") {
    return "Keep the analytical claim close to the chart, then use the methodology note to clarify filter, weight, base, or confidence context.";
  }
  return "Lead with the chart, then write the one-sentence interpretation a reader should remember from this analysis.";
}

function smartStarterSourceNote(starterId: SmartCompositionStarterId, tile: DashboardTile) {
  if (starterId === "methodology_chart_section") return `Method note: ${tileMethodologyLabel(tile)}`;
  if (starterId === "comparison_insight") return `Comparison context: ${comparisonContextLabel(tile)}. Update with base and method notes before publishing.`;
  return `Source: ${tile.source?.label ?? tile.title}. ${tileMethodologyLabel(tile)}`;
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
  const textContent = objects
    .filter((item) => item.kind === "element" && item.element.type === "text")
    .map((item) => (item.kind === "element" ? item.element.content.toLowerCase() : ""))
    .join(" ");

  if (hasTile && hasText) return "chart_commentary";
  if (hasImage && hasText) return "image_caption";
  if (textContent.includes("source") || textContent.includes("sample") || textContent.includes("method")) return "methodology";
  if (textContent.includes("%") || textContent.includes("“") || textContent.includes("\"")) return "quote_stat";
  if (hasText && objects.length <= 2) return "title_section";
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
  const category = blockCategory(objects);
  const categoryLabel = compositionBlockCategoryLabel(category);

  return {
    id: `composition_block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    description:
      objects.length === 1
        ? `${categoryLabel} pattern saved from one selected page object.`
        : `${categoryLabel} pattern saved from a current-page multi-selection.`,
    category,
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

export function createObjectsFromCompositionBlock(
  block: SavedCompositionBlock,
  page: DashboardPage,
  options: { sourceKind?: "savedBlock" | "starter" } = {}
) {
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
          insertedAt: Date.now(),
          sourceKind: options.sourceKind ?? "savedBlock"
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
        insertedAt: Date.now(),
        sourceKind: options.sourceKind ?? "savedBlock"
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
    categoryLabel: compositionBlockCategoryLabel(block.category)
  };
}

export function buildCompositionBlockLibraryView(block: SavedCompositionBlock) {
  const summary = compositionBlockSummary(block);
  const hasTile = block.summary.tileCount > 0;
  const hasElement = block.summary.elementCount > 0;
  const roleHelper = compositionBlockCategoryOptions.find((option) => option.id === block.category)?.helper ?? "Reusable page composition";
  const recency = block.lastUsedAt
    ? "Recently used"
    : block.updatedAt
      ? "Updated"
      : "Saved";

  return {
    ...summary,
    roleHelper,
    recency,
    structureLabel: hasTile && hasElement ? "Mixed analytical + visual block" : hasTile ? "Analytical layout block" : "Visual composition block",
    previewTone: hasTile ? "analytical" : block.category === "image_caption" ? "image" : "editorial"
  };
}

export function buildCompositionStarterLibraryView(block: SavedCompositionBlock) {
  const view = buildCompositionBlockLibraryView(block);
  return {
    ...view,
    actionLabel: "Insert section",
    starterLabel: block.category === "chart_commentary" ? "Analysis story starter" : "Editorial section starter"
  };
}

export function buildSmartCompositionStarterViews(args: { selectedTile: DashboardTile | null }): SmartCompositionStarterView[] {
  const hasTile = Boolean(args.selectedTile);
  const hasComparison = isComparisonTile(args.selectedTile);

  return smartStarterDefinitions.map((definition) => {
    const isComparisonStarter = definition.id === "comparison_insight";
    const ready = isComparisonStarter ? hasTile && hasComparison : hasTile;
    const recommended = definition.id === "selected_tile_story"
      ? hasTile
      : definition.id === "comparison_insight"
        ? hasComparison
        : hasTile && !hasComparison;

    return {
      ...definition,
      ready,
      recommended,
      readinessLabel: ready
        ? isComparisonStarter
          ? "Ready for comparison tile"
          : "Ready for selected tile"
        : isComparisonStarter && hasTile
          ? "Needs comparison context"
          : "Needs an analytical tile",
      helperText: ready
        ? "Creates normal editable objects from the selected analysis."
        : isComparisonStarter && hasTile
          ? "Select a tile with a breakout, banner, or wave comparison to use this starter."
          : "Select an analytical tile on the page to unlock this starter."
    };
  });
}

export function buildSmartCompositionBlockFromTile(starterId: SmartCompositionStarterId, tile: DashboardTile): SavedCompositionBlock | null {
  if (starterId === "comparison_insight" && !isComparisonTile(tile)) return null;

  const definition = smartStarterDefinitions.find((item) => item.id === starterId);
  if (!definition) return null;

  const width = starterId === "methodology_chart_section" ? 820 : 860;
  const height = starterId === "methodology_chart_section" ? 520 : 560;
  const tileLayout: CanvasLayout =
    starterId === "methodology_chart_section"
      ? { x: 32, y: 92, width: 756, height: 300, zIndex: 2 }
      : { x: 28, y: 102, width: 520, height: 350, zIndex: 2 };
  const tileItem: SavedCompositionBlock["items"][number] = {
    kind: "tile",
    tile: {
      ...cloneTile(tile),
      title: tile.title || tile.name,
      layout: tileLayout
    },
    relativeLayout: tileLayout
  };

  const label = starterId === "comparison_insight"
    ? `${tile.title || tile.name} comparison section`
    : starterId === "methodology_chart_section"
      ? `${tile.title || tile.name} method section`
      : `${tile.title || tile.name} story section`;

  const elements: DashboardCanvasElement[] =
    starterId === "methodology_chart_section"
      ? [
          smartStarterTextElement({
            id: "smart_method_title",
            name: "Analysis section title",
            content: tile.title || tile.name,
            layout: { x: 32, y: 18, width: 650, height: 58, zIndex: 1 },
            style: { textColor: "#102332", fontSize: 28, fontWeight: "850", lineHeight: 1.1 }
          }),
          smartStarterShapeElement({
            id: "smart_method_note_backdrop",
            name: "Methodology note backdrop",
            layout: { x: 32, y: 414, width: 756, height: 78, zIndex: 3 },
            style: { fill: "#f8fbfa", borderColor: "#dfe9e4", borderRadius: 18 }
          }),
          smartStarterTextElement({
            id: "smart_method_note",
            name: "Methodology note",
            content: smartStarterSourceNote(starterId, tile),
            layout: { x: 52, y: 434, width: 690, height: 42, zIndex: 4 },
            style: { textColor: "#61766c", fontSize: 12, fontWeight: "700", lineHeight: 1.28 }
          })
        ]
      : [
          smartStarterTextElement({
            id: "smart_story_title",
            name: "Analysis story title",
            content: starterId === "comparison_insight" ? `What changes across ${comparisonContextLabel(tile).toLowerCase()}?` : tile.title || tile.name,
            layout: { x: 28, y: 18, width: 720, height: 62, zIndex: 1 },
            style: { textColor: "#102332", fontSize: 28, fontWeight: "850", lineHeight: 1.1 }
          }),
          smartStarterTextElement({
            id: "smart_story_commentary",
            name: "Insight commentary",
            content: smartStarterSummaryText(starterId, tile),
            layout: { x: 590, y: 120, width: 230, height: 150, zIndex: 3 },
            style: { textColor: "#334b40", fontSize: 16, fontWeight: "650", lineHeight: 1.38 }
          }),
          smartStarterShapeElement({
            id: "smart_story_note_backdrop",
            name: "Analytical context backdrop",
            layout: { x: 590, y: 302, width: 230, height: 108, zIndex: 4 },
            style: { fill: starterId === "comparison_insight" ? "#f4fbff" : "#f8fbfa", borderColor: starterId === "comparison_insight" ? "#cde7f4" : "#dfe9e4", borderRadius: 18 }
          }),
          smartStarterTextElement({
            id: "smart_story_note",
            name: "Analytical context note",
            content: smartStarterSourceNote(starterId, tile),
            layout: { x: 606, y: 320, width: 196, height: 78, zIndex: 5 },
            style: { textColor: "#61766c", fontSize: 11, fontWeight: "700", lineHeight: 1.28 }
          })
        ];

  return {
    id: `smart_starter_${starterId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    description: definition.description,
    category: starterId === "methodology_chart_section" ? "methodology" : "chart_commentary",
    createdAt: Date.now(),
    summary: {
      objectCount: elements.length + 1,
      tileCount: 1,
      elementCount: elements.length,
      width,
      height
    },
    items: [
      tileItem,
      ...elements.map((element) => ({
        kind: "element" as const,
        element,
        relativeLayout: element.layout
      }))
    ]
  };
}

export function editorialTextStyleRole(styleId: string) {
  if (styleId.includes("display") || styleId.includes("title")) return "Heading";
  if (styleId.includes("subhead")) return "Subhead";
  if (styleId.includes("body")) return "Body";
  if (styleId.includes("stat")) return "Stat";
  if (styleId.includes("caption")) return "Caption";
  if (styleId.includes("method")) return "Methodology";
  return "Text style";
}

export function editorialTextBlockRole(blockId: string) {
  if (blockId.includes("hero") || blockId.includes("headline")) return "Title section";
  if (blockId.includes("intro")) return "Section intro";
  if (blockId.includes("stat")) return "Stat callout";
  if (blockId.includes("quote")) return "Quote";
  if (blockId.includes("caption")) return "Caption";
  if (blockId.includes("source") || blockId.includes("method")) return "Methodology";
  return "Text block";
}
