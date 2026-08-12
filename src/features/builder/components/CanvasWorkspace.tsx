import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  ImagePlus,
  Maximize2,
  MessageSquare,
  Move,
  Rocket,
  Shapes,
  Sparkles,
  StickyNote,
  Table2,
  Trash2,
  Type,
  UsersRound,
  Heart,
  Settings,
  Copy,
  X,
  type LucideIcon
} from "lucide-react";
import { Rnd } from "react-rnd";
import { canvasHeight, canvasWidth } from "../builderConstants";
import { buildCompositionGuideObjects, buildCompositionGuideState, type CompositionGuideObject, type CompositionGuideState } from "./compositionGuidesModel";
import { buildMultiSelectionSummary } from "./multiSelectionModel";
import { buildStoryGuidanceView } from "./storyGuidanceModel";
import type { MultiSelectedObject } from "../builderTypes";
import type { OutcomeWorkspaceMode } from "./BuilderChrome";
import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";

function rangeFill(value: number | string, min: number, max: number) {
  const numericValue = Number(value);
  const percentage = ((numericValue - min) / (max - min)) * 100;
  return `${Math.min(100, Math.max(0, percentage))}%`;
}

function guideStateSignature(state: CompositionGuideState) {
  return `${state.snappedX}:${state.snappedY}:${state.guides.map((guide) => `${guide.orientation}:${guide.position}:${guide.label}`).join("|")}`;
}

const canvasResizeHandleClasses = {
  top: "canvas-resize-handle canvas-resize-handle--top",
  right: "canvas-resize-handle canvas-resize-handle--right",
  bottom: "canvas-resize-handle canvas-resize-handle--bottom",
  left: "canvas-resize-handle canvas-resize-handle--left",
  topLeft: "canvas-resize-handle canvas-resize-handle--top-left",
  topRight: "canvas-resize-handle canvas-resize-handle--top-right",
  bottomRight: "canvas-resize-handle canvas-resize-handle--bottom-right",
  bottomLeft: "canvas-resize-handle canvas-resize-handle--bottom-left"
};

function CanvasSelectionHandles() {
  return (
    <div className="canvas-selection-handles" aria-hidden="true">
      {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
        <span key={handle} className={`canvas-selection-handle ${handle}`} />
      ))}
      <span className="canvas-selection-hint">Drag or resize</span>
    </div>
  );
}

type CanvasActionIconName = "addSlide" | "data" | "text" | "shape" | "image" | "comment" | "notes" | "fit";

function CanvasActionIcon({ icon }: { icon: CanvasActionIconName }) {
  const icons: Record<CanvasActionIconName, LucideIcon> = {
    addSlide: FilePlus2,
    data: Table2,
    text: Type,
    shape: Shapes,
    image: ImagePlus,
    comment: MessageSquare,
    notes: StickyNote,
    fit: Maximize2
  };
  const Icon = icons[icon];

  return <Icon className="canvas-action-icon" aria-hidden="true" strokeWidth={1.9} />;
}

type CanvasElementFrameProps = {
  element: DashboardCanvasElement;
  selected: boolean;
  canvasScale: number;
  snapToGrid: boolean;
  gridSize: number;
  compositionObjects: CompositionGuideObject[];
  updateGuideState: (movingObject: CompositionGuideObject, immediate?: boolean) => void;
  clearGuideState: () => void;
  onSelectElement: (elementId: string) => void;
  onUpdateElementLayout: (elementId: string, updates: Partial<DashboardCanvasElement["layout"]>) => void;
  renderElement: (element: DashboardCanvasElement, selected: boolean, onSelect: () => void) => ReactNode;
};

const CanvasElementFrame = memo(function CanvasElementFrame({
  element,
  selected,
  canvasScale,
  snapToGrid,
  gridSize,
  compositionObjects,
  updateGuideState,
  clearGuideState,
  onSelectElement,
  onUpdateElementLayout,
  renderElement
}: CanvasElementFrameProps) {
  return (
    <Rnd
      className={selected ? "canvas-draggable-frame selected" : "canvas-draggable-frame"}
      bounds="parent"
      scale={canvasScale}
      size={{ width: element.layout.width, height: element.layout.height }}
      position={{ x: element.layout.x, y: element.layout.y }}
      style={{ zIndex: element.layout.zIndex }}
      dragGrid={snapToGrid ? [gridSize, gridSize] : undefined}
      resizeGrid={snapToGrid ? [gridSize, gridSize] : undefined}
      resizeHandleClasses={canvasResizeHandleClasses}
      disableDragging={element.locked}
      enableResizing={!element.locked}
      onDragStart={() => {
        onSelectElement(element.id);
        updateGuideState({ id: element.id, type: "element", layout: element.layout }, true);
      }}
      onDrag={(_, data) => updateGuideState({ id: element.id, type: "element", layout: { ...element.layout, x: data.x, y: data.y } })}
      onDragStop={(_, data) => {
        const guideState = buildCompositionGuideState({
          movingObject: { id: element.id, type: "element", layout: { ...element.layout, x: data.x, y: data.y } },
          objects: compositionObjects
        });
        onUpdateElementLayout(element.id, { x: guideState.snappedX, y: guideState.snappedY });
        clearGuideState();
      }}
      onResizeStop={(_, __, ref, ___, position) =>
        onUpdateElementLayout(element.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y
        })
      }
    >
      {renderElement(element, selected, () => onSelectElement(element.id))}
      {selected && <CanvasSelectionHandles />}
    </Rnd>
  );
});

type CanvasTileFrameProps = {
  tile: DashboardTile;
  selected: boolean;
  canvasScale: number;
  snapToGrid: boolean;
  gridSize: number;
  compositionObjects: CompositionGuideObject[];
  updateGuideState: (movingObject: CompositionGuideObject, immediate?: boolean) => void;
  clearGuideState: () => void;
  onSelectTile: (tileId: string) => void;
  onUpdateTileLayout: (tileId: string, updates: Partial<DashboardTile["layout"]>) => void;
  onUpdateTileTitle: (tileId: string, title: string) => void;
  onUpdateTileAppearance: (tileId: string, updates: Partial<DashboardTile["appearance"]>) => void;
  renderTile: (
    tile: DashboardTile,
    selected: boolean,
    onSelect: () => void,
    onTitleChange: (title: string) => void,
    onTitleAppearanceChange: (updates: Partial<DashboardTile["appearance"]>) => void
  ) => ReactNode;
};

const CanvasTileFrame = memo(function CanvasTileFrame({
  tile,
  selected,
  canvasScale,
  snapToGrid,
  gridSize,
  compositionObjects,
  updateGuideState,
  clearGuideState,
  onSelectTile,
  onUpdateTileLayout,
  onUpdateTileTitle,
  onUpdateTileAppearance,
  renderTile
}: CanvasTileFrameProps) {
  return (
    <Rnd
      className={selected ? "canvas-draggable-frame selected" : "canvas-draggable-frame"}
      bounds="parent"
      scale={canvasScale}
      dragHandleClassName="tile-drag-handle"
      minWidth={320}
      minHeight={220}
      size={{ width: tile.layout.width, height: tile.layout.height }}
      position={{ x: tile.layout.x, y: tile.layout.y }}
      style={{ zIndex: tile.layout.zIndex }}
      dragGrid={snapToGrid ? [gridSize, gridSize] : undefined}
      resizeGrid={snapToGrid ? [gridSize, gridSize] : undefined}
      resizeHandleClasses={canvasResizeHandleClasses}
      disableDragging={tile.locked}
      enableResizing={!tile.locked}
      onDragStart={() => {
        onSelectTile(tile.id);
        updateGuideState({ id: tile.id, type: "tile", layout: tile.layout }, true);
      }}
      onDrag={(_, data) => updateGuideState({ id: tile.id, type: "tile", layout: { ...tile.layout, x: data.x, y: data.y } })}
      onDragStop={(_, data) => {
        const guideState = buildCompositionGuideState({
          movingObject: { id: tile.id, type: "tile", layout: { ...tile.layout, x: data.x, y: data.y } },
          objects: compositionObjects
        });
        onUpdateTileLayout(tile.id, { x: guideState.snappedX, y: guideState.snappedY });
        clearGuideState();
      }}
      onResizeStop={(_, __, ref, ___, position) =>
        onUpdateTileLayout(tile.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y
        })
      }
    >
      {renderTile(
        tile,
        selected,
        () => onSelectTile(tile.id),
        (title) => onUpdateTileTitle(tile.id, title),
        (updates) => onUpdateTileAppearance(tile.id, updates)
      )}
      {selected && <CanvasSelectionHandles />}
    </Rnd>
  );
});

function MockupStorySlide() {
  const bars = [
    { label: "Workplace\nCulture", value: 72 },
    { label: "Flexibility", value: 61 },
    { label: "Compensation", value: 53 },
    { label: "Career\nGrowth", value: 38 },
    { label: "Sustainability", value: 29 },
    { label: "Brand\nReputation", value: 21 }
  ];

  return (
    <div className="mockup-slide-artboard" aria-label="InsightCanvas story mockup">
      <div className="mockup-accent-rule" />
      <section className="mockup-hero-copy">
        <h1>Workplace Trends 2026</h1>
        <p>What matters most to today&apos;s workforce-and what it means for business</p>
      </section>

      <div className="mockup-kpi-strip" aria-label="Key performance indicators">
        {[
          { icon: UsersRound, value: "84%", label: "Care About Workplace Culture", helper: "vs. 78% in 2024 ↑", tone: "teal" },
          { icon: Heart, value: "41%", label: "Feel Supported at Work", helper: "vs. 35% in 2024 ↑", tone: "indigo" },
          { icon: Rocket, value: "2x", label: "Growth in Job-Seeker Influence", helper: "vs. 2024 ↑", tone: "coral" }
        ].map((item) => (
          <article className={`mockup-kpi-card ${item.tone}`} key={item.value}>
            <span><item.icon className="mockup-kpi-icon" aria-hidden="true" strokeWidth={1.9} /></span>
            <strong>{item.value}</strong>
            <p>{item.label}</p>
            <small>{item.helper}</small>
          </article>
        ))}
      </div>

      <section className="mockup-chart-card mockup-selected-chart">
        <div className="mockup-object-toolbar" aria-hidden="true">
          <button type="button"><Move className="mockup-toolbar-icon" strokeWidth={1.9} /></button>
          <button type="button"><Settings className="mockup-toolbar-icon" strokeWidth={1.9} /></button>
          <button type="button"><Copy className="mockup-toolbar-icon" strokeWidth={1.9} /></button>
          <button type="button"><Trash2 className="mockup-toolbar-icon" strokeWidth={1.9} /></button>
        </div>
        {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => <span key={handle} className={`mockup-resize-handle ${handle}`} />)}
        <div className="mockup-chart-heading">
          <div>
            <strong>Top Drivers of Workplace Choice</strong>
            <small>% selecting as a top 3 driver</small>
          </div>
          <span>N = 12,540 ⋮</span>
        </div>
        <div className="mockup-bar-chart" aria-hidden="true">
          <div className="mockup-y-axis">
            <span>100%</span>
            <span>80%</span>
            <span>60%</span>
            <span>40%</span>
            <span>20%</span>
            <span>0%</span>
          </div>
          <div className="mockup-bars">
            {bars.map((bar) => (
              <div className="mockup-bar-item" key={bar.label}>
                <span>{bar.value}%</span>
                <i style={{ height: `${bar.value * 1.62}px` }} />
                <small>{bar.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="mockup-chart-legend"><span /> All Respondents</div>
      </section>

      <section className="mockup-chart-card mockup-donut-card">
        <div className="mockup-chart-heading">
          <div>
            <strong>Preferred Work Arrangement</strong>
            <small>% of respondents</small>
          </div>
          <span>⋮</span>
        </div>
        <div className="mockup-donut-wrap">
          <div className="mockup-donut" aria-hidden="true">
            <span className="donut-label one">44%</span>
            <span className="donut-label two">33%</span>
            <span className="donut-label three">23%</span>
          </div>
        </div>
        <div className="mockup-donut-legend">
          <span><i className="teal" /> Hybrid</span>
          <span><i className="indigo" /> Fully Remote</span>
          <span><i className="coral" /> On-site</span>
        </div>
        <small className="mockup-base-note">N = 12,540</small>
      </section>

      <section className="mockup-insight-card">
        <div className="mockup-insight-icon">◌</div>
        <div>
          <span>Insight</span>
          <p>Culture leads the decision hierarchy, outranking compensation and growth. Support at work remains low-an opportunity for employers to differentiate.</p>
        </div>
      </section>

      <section className="mockup-section-card">
        <div className="mockup-dot-grid" aria-hidden="true" />
        <div>
          <span>Section 2</span>
          <h2>Opportunity</h2>
          <p>Where organizations can take action</p>
        </div>
        <button type="button" aria-label="Open next section">→</button>
      </section>
    </div>
  );
}

export function CanvasWorkspace({
  outcomeMode,
  outcomeCanvasLabel,
  activePage,
  sortedPages,
  canvasScale,
  canvasZoom,
  selectedTileId,
  selectedElementId,
  multiSelectedObjects,
  hasSelection,
  canvasBackground,
  canvasBackgroundSize,
  canvasBackgroundRepeat,
  canvasBackgroundPosition,
  onZoomChange,
  onSelectPage,
  onSelectTile,
  onSelectElement,
  onDrop,
  onOpenPageDesign,
  onOpenFormat,
  onOpenLayout,
  onOpenDataLibrary,
  onOpenInsertPanel,
  onBringForward,
  onDuplicateSelection,
  onDeleteSelection,
  onAddPage,
  onSetActivePage,
  onUpdateTileLayout,
  onUpdateTileTitle,
  onUpdateTileAppearance,
  onUpdateElementLayout,
  renderTile,
  renderElement
}: {
  outcomeMode: OutcomeWorkspaceMode | null;
  outcomeCanvasLabel: string;
  activePage: DashboardPage;
  sortedPages: DashboardPage[];
  canvasScale: number;
  canvasZoom: number;
  selectedTileId: string | null;
  selectedElementId: string | null;
  multiSelectedObjects: MultiSelectedObject[];
  hasSelection: boolean;
  canvasBackground: (page: DashboardPage) => string;
  canvasBackgroundSize: (page: DashboardPage) => string;
  canvasBackgroundRepeat: (page: DashboardPage) => string;
  canvasBackgroundPosition: (page: DashboardPage) => string;
  onZoomChange: (zoom: number) => void;
  onSelectPage: () => void;
  onSelectTile: (tileId: string) => void;
  onSelectElement: (elementId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onOpenPageDesign: () => void;
  onOpenFormat: () => void;
  onOpenLayout: () => void;
  onOpenDataLibrary: () => void;
  onOpenInsertPanel: () => void;
  onBringForward: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onAddPage: () => void;
  onSetActivePage: (pageId: string) => void;
  onUpdateTileLayout: (tileId: string, updates: Partial<DashboardTile["layout"]>) => void;
  onUpdateTileTitle: (tileId: string, title: string) => void;
  onUpdateTileAppearance: (tileId: string, updates: Partial<DashboardTile["appearance"]>) => void;
  onUpdateElementLayout: (elementId: string, updates: Partial<DashboardCanvasElement["layout"]>) => void;
  renderTile: (
    tile: DashboardTile,
    selected: boolean,
    onSelect: () => void,
    onTitleChange: (title: string) => void,
    onTitleAppearanceChange: (updates: Partial<DashboardTile["appearance"]>) => void
  ) => ReactNode;
  renderElement: (element: DashboardCanvasElement, selected: boolean, onSelect: () => void) => ReactNode;
}) {
  const canvasSectionRef = useRef<HTMLElement | null>(null);
  const guideFrameRef = useRef<number | null>(null);
  const guideObjectRef = useRef<CompositionGuideObject | null>(null);
  const guideSignatureRef = useRef("");
  const lastGuideUpdateRef = useRef(0);
  const [activeGuideState, setActiveGuideState] = useState<CompositionGuideState | null>(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const compositionObjects = useMemo(
    () =>
      buildCompositionGuideObjects([
        ...activePage.tiles.filter((tile) => !tile.hidden).map((tile) => ({ id: tile.id, type: "tile" as const, layout: tile.layout })),
        ...activePage.elements.filter((element) => !element.hidden).map((element) => ({ id: element.id, type: "element" as const, layout: element.layout }))
      ]),
    [activePage.tiles, activePage.elements]
  );
  const multiSelectionSummary = useMemo(
    () => buildMultiSelectionSummary(activePage, multiSelectedObjects),
    [activePage, multiSelectedObjects]
  );
  const selectedTile = useMemo(
    () => activePage.tiles.find((tile) => tile.id === selectedTileId) ?? null,
    [activePage.tiles, selectedTileId]
  );
  const selectedElement = useMemo(
    () => activePage.elements.find((element) => element.id === selectedElementId) ?? null,
    [activePage.elements, selectedElementId]
  );
  const visibleElements = useMemo(
    () => activePage.elements.filter((element) => !element.hidden),
    [activePage.elements]
  );
  const visibleTiles = useMemo(
    () => activePage.tiles.filter((tile) => !tile.hidden),
    [activePage.tiles]
  );
  const selectedObjectLabel = useMemo(
    () =>
      multiSelectionSummary.count > 1
        ? `${multiSelectionSummary.count} objects selected`
        : selectedTile
          ? selectedTile.title
          : selectedElement
            ? selectedElement.name
            : "Page canvas",
    [multiSelectionSummary.count, selectedElement, selectedTile]
  );
  const activePageIndex = sortedPages.findIndex((page) => page.id === activePage.id);
  const previousPage = activePageIndex > 0 ? sortedPages[activePageIndex - 1] : null;
  const nextPage = activePageIndex >= 0 && activePageIndex < sortedPages.length - 1 ? sortedPages[activePageIndex + 1] : null;
  const showMockupStorySurface = false;
  const storyGuidance = useMemo(
    () => buildStoryGuidanceView(activePage, selectedTile, selectedElement, sortedPages.length),
    [activePage, selectedElement, selectedTile, sortedPages.length]
  );
  const outcomePreviewHelper =
    outcomeMode === "dashboard"
      ? "Check evidence clarity, filter context, and whether the page can support analytical exploration."
      : outcomeMode === "report"
        ? "Check section hierarchy, narrative continuity, and document-ready page structure."
        : storyGuidance.pageFlowHelper;
  const canvasStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    background: canvasBackground(activePage),
    backgroundSize: canvasBackgroundSize(activePage),
    backgroundRepeat: canvasBackgroundRepeat(activePage),
    backgroundPosition: canvasBackgroundPosition(activePage),
    transform: `scale(${canvasScale})`
  };
  const updateGuideState = useCallback((movingObject: CompositionGuideObject, immediate = false) => {
    guideObjectRef.current = movingObject;
    if (immediate) {
      if (guideFrameRef.current !== null) {
        cancelAnimationFrame(guideFrameRef.current);
        guideFrameRef.current = null;
      }
      lastGuideUpdateRef.current = performance.now();
      const nextGuideState = buildCompositionGuideState({ movingObject, objects: compositionObjects });
      const nextSignature = guideStateSignature(nextGuideState);
      guideSignatureRef.current = nextSignature;
      setActiveGuideState(nextGuideState);
      return;
    }
    const now = performance.now();
    if (now - lastGuideUpdateRef.current < 140) return;
    lastGuideUpdateRef.current = now;
    if (guideFrameRef.current !== null) return;
    guideFrameRef.current = requestAnimationFrame(() => {
      guideFrameRef.current = null;
      const nextObject = guideObjectRef.current;
      if (!nextObject) return;
      const nextGuideState = buildCompositionGuideState({ movingObject: nextObject, objects: compositionObjects });
      const nextSignature = guideStateSignature(nextGuideState);
      if (nextSignature === guideSignatureRef.current) return;
      guideSignatureRef.current = nextSignature;
      setActiveGuideState(nextGuideState);
    });
  }, [compositionObjects]);
  const clearGuideState = useCallback(() => {
    guideObjectRef.current = null;
    guideSignatureRef.current = "";
    if (guideFrameRef.current !== null) {
      cancelAnimationFrame(guideFrameRef.current);
      guideFrameRef.current = null;
    }
    setActiveGuideState(null);
  }, []);

  useEffect(() => {
    return () => {
      if (guideFrameRef.current !== null) cancelAnimationFrame(guideFrameRef.current);
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsCanvasFullscreen(document.fullscreenElement === canvasSectionRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleCanvasFullscreen() {
    if (document.fullscreenElement === canvasSectionRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (canvasSectionRef.current?.requestFullscreen) {
      await canvasSectionRef.current.requestFullscreen();
      setIsCanvasFullscreen(true);
    }
  }

  return (
    <section
      ref={canvasSectionRef}
      className={[
        "canvas",
        isCanvasFullscreen ? "canvas-fullscreen" : "",
        outcomeMode ? "outcome-canvas" : "",
        outcomeMode ? `${outcomeMode}-canvas` : ""
      ].filter(Boolean).join(" ")}
      aria-label="Dashboard canvas"
    >
      <div className="page-header">
        <div className="page-header__identity">
          <p className="eyebrow">Story canvas · Slide {activePage.order}</p>
          <h2>{activePage.title}</h2>
          <small>Compose analytical tiles, narrative sections, and reusable report blocks.</small>
        </div>
        <div className="canvas-toolbar">
          <span className="canvas-element-count">{activePage.tiles.length + activePage.elements.length} element{activePage.tiles.length + activePage.elements.length === 1 ? "" : "s"}</span>
          <div className="zoom-control" aria-label="Canvas zoom">
            <button type="button" className="mini-button" onClick={() => onZoomChange(canvasZoom - 10)}>-</button>
            <input
              type="range"
              min="35"
              max="160"
              step="5"
              value={canvasZoom}
              style={{ "--range-fill": rangeFill(canvasZoom, 35, 160) } as CSSProperties}
              onChange={(event) => onZoomChange(Number(event.target.value))}
            />
            <button type="button" className="mini-button" onClick={() => onZoomChange(canvasZoom + 10)}>+</button>
            <strong>{canvasZoom}%</strong>
          </div>
        </div>
      </div>
      <div className={hasSelection ? "floating-format-bar has-selection" : "floating-format-bar"} aria-label="Quick actions">
        <div className="floating-format-bar__context">
          <span>{hasSelection ? "Editing" : "Canvas"}</span>
          <strong>{selectedObjectLabel}</strong>
        </div>
        <button type="button" className="page-action" onClick={onOpenPageDesign}>Page design</button>
        <span className="floating-format-bar__divider" />
        {hasSelection ? (
          <div className="selection-action-group" aria-label="Selected object actions">
            <button type="button" className="primary-action" onClick={onOpenFormat}>Format</button>
            <button type="button" onClick={onOpenLayout}>Position</button>
            <button type="button" onClick={onBringForward}>Front</button>
            <button type="button" onClick={onDuplicateSelection}>Duplicate</button>
            <button type="button" className="danger-action" onClick={onDeleteSelection}>Delete</button>
          </div>
        ) : (
          <small>Select an object to format it</small>
        )}
      </div>
      {outcomeMode && (
        <div className={`outcome-preview-card ${outcomeMode}`} role="status">
          <span>{outcomeCanvasLabel}</span>
          <strong>Slide {activePage.order} of {sortedPages.length}: {storyGuidance.pageRoleLabel}</strong>
          <small>{outcomePreviewHelper}</small>
        </div>
      )}
      <div className="canvas-viewport">
        <div className="canvas-zoom-shell" style={{ width: canvasWidth * canvasScale, height: canvasHeight * canvasScale }}>
          <div
            className={showMockupStorySurface ? "freeform-canvas mockup-story-canvas" : "freeform-canvas"}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("application/ecofocus-source")) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={onDrop}
            onClick={(event) => {
              if (event.currentTarget === event.target) {
                onSelectPage();
              }
            }}
            style={canvasStyle}
          >
            {showMockupStorySurface && <MockupStorySlide />}
            {!showMockupStorySurface && activePage.tiles.length === 0 && activePage.elements.length === 0 && (
              <div className="empty-canvas-state">
                <span>Start a story section</span>
                <strong>{activePage.title}</strong>
                <p>Use section starters, analytical sources, text, images, or reusable blocks to build a clear insight narrative.</p>
                <div>
                  <button type="button" className="secondary" onClick={onOpenPageDesign}>Page design</button>
                  <button type="button" className="secondary" onClick={onAddPage}>New page</button>
                </div>
              </div>
            )}
            {visibleElements.map((element) => (
              <CanvasElementFrame
                key={element.id}
                element={element}
                selected={element.id === selectedElementId}
                canvasScale={canvasScale}
                snapToGrid={activePage.snapToGrid}
                gridSize={activePage.gridSize}
                compositionObjects={compositionObjects}
                updateGuideState={updateGuideState}
                clearGuideState={clearGuideState}
                onSelectElement={onSelectElement}
                onUpdateElementLayout={onUpdateElementLayout}
                renderElement={renderElement}
              />
            ))}
            {visibleTiles.map((tile) => (
              <CanvasTileFrame
                key={tile.id}
                tile={tile}
                selected={tile.id === selectedTileId}
                canvasScale={canvasScale}
                snapToGrid={activePage.snapToGrid}
                gridSize={activePage.gridSize}
                compositionObjects={compositionObjects}
                updateGuideState={updateGuideState}
                clearGuideState={clearGuideState}
                onSelectTile={onSelectTile}
                onUpdateTileLayout={onUpdateTileLayout}
                onUpdateTileTitle={onUpdateTileTitle}
                onUpdateTileAppearance={onUpdateTileAppearance}
                renderTile={renderTile}
              />
            ))}
            {multiSelectionSummary.bounds && multiSelectionSummary.count > 1 && (
              <div
                className="multi-selection-canvas-bounds"
                style={{
                  left: multiSelectionSummary.bounds.x,
                  top: multiSelectionSummary.bounds.y,
                  width: multiSelectionSummary.bounds.width,
                  height: multiSelectionSummary.bounds.height
                }}
              >
                <span>{multiSelectionSummary.count} selected · {multiSelectionSummary.bounds.width} x {multiSelectionSummary.bounds.height}</span>
              </div>
            )}
            {activeGuideState && activeGuideState.guides.map((guide) => (
              <div
                className={`composition-guide ${guide.orientation}`}
                key={`${guide.orientation}-${guide.position}-${guide.label}`}
                style={guide.orientation === "vertical" ? { left: guide.position } : { top: guide.position }}
              >
                <span>{guide.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="story-arc-pill" role="status">
        <span className="story-arc-pill__icon" aria-hidden="true"><Sparkles className="story-arc-icon" strokeWidth={1.9} /></span>
        <strong>{storyGuidance.pageRoleLabel} story arc:</strong>
        <span>{storyGuidance.arcLabel}</span>
        <button type="button" aria-label="Dismiss story suggestion"><X className="canvas-action-icon" aria-hidden="true" strokeWidth={2} /></button>
      </div>
      <div className="canvas-bottom-bar" aria-label="Story page actions">
        <div className="slide-nav-controls">
          <button type="button" className="icon-button" disabled={!previousPage} onClick={() => previousPage && onSetActivePage(previousPage.id)}><ChevronLeft className="canvas-action-icon" aria-hidden="true" strokeWidth={2} /></button>
          <strong>Slide {activePage.order} of {sortedPages.length}</strong>
          <button type="button" className="icon-button" disabled={!nextPage} onClick={() => nextPage && onSetActivePage(nextPage.id)}><ChevronRight className="canvas-action-icon" aria-hidden="true" strokeWidth={2} /></button>
        </div>
        <div className="canvas-insert-actions">
          <button type="button" onClick={onAddPage}><CanvasActionIcon icon="addSlide" />Add slide</button>
          <button type="button" onClick={onOpenDataLibrary}><CanvasActionIcon icon="data" />Add data</button>
          <button type="button" onClick={onOpenInsertPanel}><CanvasActionIcon icon="text" />Add text</button>
          <button type="button" onClick={onOpenInsertPanel}><CanvasActionIcon icon="shape" />Add shape</button>
          <button type="button" onClick={onOpenInsertPanel}><CanvasActionIcon icon="image" />Add image</button>
          <button type="button"><CanvasActionIcon icon="comment" />Comment</button>
        </div>
        <div className="canvas-bottom-tools">
          <button type="button"><CanvasActionIcon icon="notes" />Notes</button>
          <button type="button" className="canvas-icon-only-action" aria-label={isCanvasFullscreen ? "Exit fullscreen canvas" : "Fullscreen canvas"} onClick={() => void toggleCanvasFullscreen()}><CanvasActionIcon icon="fit" /></button>
        </div>
      </div>
    </section>
  );
}
