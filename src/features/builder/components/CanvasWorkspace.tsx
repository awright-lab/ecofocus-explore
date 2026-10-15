import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  ImagePlus,
  Maximize2,
  MessageSquare,
  Shapes,
  Sparkles,
  StickyNote,
  Table2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { Rnd } from "react-rnd";
import { canvasHeight, canvasWidth } from "../builderConstants";
import {
  buildCompositionGuideObjects,
  buildCompositionGuideState,
  type CompositionGuideObject,
  type CompositionGuideState,
} from "./compositionGuidesModel";
import { buildMultiSelectionSummary } from "./multiSelectionModel";
import { buildStoryGuidanceView } from "./storyGuidanceModel";
import type { MultiSelectedObject } from "../builderTypes";
import type { OutcomeWorkspaceMode } from "./BuilderChrome";
import type {
  DashboardCanvasElement,
  DashboardPage,
  DashboardTile,
} from "../../../../shared/types/dashboard";

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
  bottomLeft: "canvas-resize-handle canvas-resize-handle--bottom-left",
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

type CanvasActionIconName =
  | "addSlide"
  | "data"
  | "text"
  | "shape"
  | "image"
  | "comment"
  | "notes"
  | "fit";

function CanvasActionIcon({ icon }: { icon: CanvasActionIconName }) {
  const icons: Record<CanvasActionIconName, LucideIcon> = {
    addSlide: FilePlus2,
    data: Table2,
    text: Type,
    shape: Shapes,
    image: ImagePlus,
    comment: MessageSquare,
    notes: StickyNote,
    fit: Maximize2,
  };
  const Icon = icons[icon];

  return (
    <Icon className="canvas-action-icon" aria-hidden="true" strokeWidth={1.9} />
  );
}

type CanvasElementFrameProps = {
  element: DashboardCanvasElement;
  selected: boolean;
  canvasScale: number;
  snapToGrid: boolean;
  gridSize: number;
  compositionObjectsRef: MutableRefObject<CompositionGuideObject[]>;
  updateGuideState: (
    movingObject: CompositionGuideObject,
    immediate?: boolean,
  ) => void;
  clearGuideState: () => void;
  onSelectElement: (elementId: string) => void;
  onUpdateElementLayout: (
    elementId: string,
    updates: Partial<DashboardCanvasElement["layout"]>,
  ) => void;
  renderElement: (
    element: DashboardCanvasElement,
    selected: boolean,
    onSelect: () => void,
  ) => ReactNode;
};

const CanvasElementFrame = memo(function CanvasElementFrame({
  element,
  selected,
  canvasScale,
  snapToGrid,
  gridSize,
  compositionObjectsRef,
  updateGuideState,
  clearGuideState,
  onSelectElement,
  onUpdateElementLayout,
  renderElement,
}: CanvasElementFrameProps) {
  return (
    <Rnd
      className={
        selected ? "canvas-draggable-frame selected" : "canvas-draggable-frame"
      }
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
        updateGuideState(
          { id: element.id, type: "element", layout: element.layout },
          true,
        );
      }}
      onDrag={(_, data) =>
        updateGuideState({
          id: element.id,
          type: "element",
          layout: { ...element.layout, x: data.x, y: data.y },
        })
      }
      onDragStop={(_, data) => {
        const guideState = buildCompositionGuideState({
          movingObject: {
            id: element.id,
            type: "element",
            layout: { ...element.layout, x: data.x, y: data.y },
          },
          objects: compositionObjectsRef.current,
        });
        onUpdateElementLayout(element.id, {
          x: guideState.snappedX,
          y: guideState.snappedY,
        });
        clearGuideState();
      }}
      onResizeStop={(_, __, ref, ___, position) =>
        onUpdateElementLayout(element.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
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
  compositionObjectsRef: MutableRefObject<CompositionGuideObject[]>;
  updateGuideState: (
    movingObject: CompositionGuideObject,
    immediate?: boolean,
  ) => void;
  clearGuideState: () => void;
  onSelectTile: (tileId: string) => void;
  onUpdateTileLayout: (
    tileId: string,
    updates: Partial<DashboardTile["layout"]>,
  ) => void;
  onUpdateTileTitle: (tileId: string, title: string) => void;
  onUpdateTileAppearance: (
    tileId: string,
    updates: Partial<DashboardTile["appearance"]>,
  ) => void;
  renderTile: (
    tile: DashboardTile,
    selected: boolean,
    onSelect: () => void,
    onTitleChange: (title: string) => void,
    onTitleAppearanceChange: (
      updates: Partial<DashboardTile["appearance"]>,
    ) => void,
  ) => ReactNode;
};

const CanvasTileFrame = memo(function CanvasTileFrame({
  tile,
  selected,
  canvasScale,
  snapToGrid,
  gridSize,
  compositionObjectsRef,
  updateGuideState,
  clearGuideState,
  onSelectTile,
  onUpdateTileLayout,
  onUpdateTileTitle,
  onUpdateTileAppearance,
  renderTile,
}: CanvasTileFrameProps) {
  return (
    <Rnd
      className={
        selected ? "canvas-draggable-frame selected" : "canvas-draggable-frame"
      }
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
        updateGuideState(
          { id: tile.id, type: "tile", layout: tile.layout },
          true,
        );
      }}
      onDrag={(_, data) =>
        updateGuideState({
          id: tile.id,
          type: "tile",
          layout: { ...tile.layout, x: data.x, y: data.y },
        })
      }
      onDragStop={(_, data) => {
        const guideState = buildCompositionGuideState({
          movingObject: {
            id: tile.id,
            type: "tile",
            layout: { ...tile.layout, x: data.x, y: data.y },
          },
          objects: compositionObjectsRef.current,
        });
        onUpdateTileLayout(tile.id, {
          x: guideState.snappedX,
          y: guideState.snappedY,
        });
        clearGuideState();
      }}
      onResizeStop={(_, __, ref, ___, position) =>
        onUpdateTileLayout(tile.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        })
      }
    >
      {renderTile(
        tile,
        selected,
        () => onSelectTile(tile.id),
        (title) => onUpdateTileTitle(tile.id, title),
        (updates) => onUpdateTileAppearance(tile.id, updates),
      )}
      {selected && <CanvasSelectionHandles />}
    </Rnd>
  );
});

export const CanvasWorkspace = memo(function CanvasWorkspace({
  fitRequest,
  onAddElement,
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
  renderElement,
}: {
  fitRequest: number;
  onAddElement: (type: DashboardCanvasElement["type"]) => void;
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
  onUpdateTileLayout: (
    tileId: string,
    updates: Partial<DashboardTile["layout"]>,
  ) => void;
  onUpdateTileTitle: (tileId: string, title: string) => void;
  onUpdateTileAppearance: (
    tileId: string,
    updates: Partial<DashboardTile["appearance"]>,
  ) => void;
  onUpdateElementLayout: (
    elementId: string,
    updates: Partial<DashboardCanvasElement["layout"]>,
  ) => void;
  renderTile: (
    tile: DashboardTile,
    selected: boolean,
    onSelect: () => void,
    onTitleChange: (title: string) => void,
    onTitleAppearanceChange: (
      updates: Partial<DashboardTile["appearance"]>,
    ) => void,
  ) => ReactNode;
  renderElement: (
    element: DashboardCanvasElement,
    selected: boolean,
    onSelect: () => void,
  ) => ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomCallback = useRef(onZoomChange);
  zoomCallback.current = onZoomChange;
  const [storyHintVisible, setStoryHintVisible] = useState(false);
  const canvasSectionRef = useRef<HTMLElement | null>(null);
  const guideFrameRef = useRef<number | null>(null);
  const guideObjectRef = useRef<CompositionGuideObject | null>(null);
  const guideSignatureRef = useRef("");
  const lastGuideUpdateRef = useRef(0);
  const compositionObjectsRef = useRef<CompositionGuideObject[]>([]);
  const [activeGuideState, setActiveGuideState] =
    useState<CompositionGuideState | null>(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const compositionObjects = useMemo(
    () =>
      buildCompositionGuideObjects([
        ...activePage.tiles
          .filter((tile) => !tile.hidden)
          .map((tile) => ({
            id: tile.id,
            type: "tile" as const,
            layout: tile.layout,
          })),
        ...activePage.elements
          .filter((element) => !element.hidden)
          .map((element) => ({
            id: element.id,
            type: "element" as const,
            layout: element.layout,
          })),
      ]),
    [activePage.tiles, activePage.elements],
  );
  compositionObjectsRef.current = compositionObjects;
  const multiSelectionSummary = useMemo(
    () => buildMultiSelectionSummary(activePage, multiSelectedObjects),
    [activePage, multiSelectedObjects],
  );
  const selectedTile = useMemo(
    () => activePage.tiles.find((tile) => tile.id === selectedTileId) ?? null,
    [activePage.tiles, selectedTileId],
  );
  const selectedElement = useMemo(
    () =>
      activePage.elements.find((element) => element.id === selectedElementId) ??
      null,
    [activePage.elements, selectedElementId],
  );
  const visibleElements = useMemo(
    () => activePage.elements.filter((element) => !element.hidden),
    [activePage.elements],
  );
  const visibleTiles = useMemo(
    () => activePage.tiles.filter((tile) => !tile.hidden),
    [activePage.tiles],
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
    [multiSelectionSummary.count, selectedElement, selectedTile],
  );
  const activePageIndex = sortedPages.findIndex(
    (page) => page.id === activePage.id,
  );
  const previousPage =
    activePageIndex > 0 ? sortedPages[activePageIndex - 1] : null;
  const nextPage =
    activePageIndex >= 0 && activePageIndex < sortedPages.length - 1
      ? sortedPages[activePageIndex + 1]
      : null;
  const storyGuidance = useMemo(
    () =>
      buildStoryGuidanceView(
        activePage,
        selectedTile,
        selectedElement,
        sortedPages.length,
      ),
    [activePage, selectedElement, selectedTile, sortedPages.length],
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
    transform: `scale(${canvasScale})`,
  };
  const updateGuideState = useCallback(
    (movingObject: CompositionGuideObject, immediate = false) => {
      guideObjectRef.current = movingObject;
      if (immediate) {
        if (guideFrameRef.current !== null) {
          cancelAnimationFrame(guideFrameRef.current);
          guideFrameRef.current = null;
        }
        lastGuideUpdateRef.current = performance.now();
        const nextGuideState = buildCompositionGuideState({
          movingObject,
          objects: compositionObjectsRef.current,
        });
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
        const nextGuideState = buildCompositionGuideState({
          movingObject: nextObject,
          objects: compositionObjectsRef.current,
        });
        const nextSignature = guideStateSignature(nextGuideState);
        if (nextSignature === guideSignatureRef.current) return;
        guideSignatureRef.current = nextSignature;
        setActiveGuideState(nextGuideState);
      });
    },
    [],
  );
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
      if (guideFrameRef.current !== null)
        cancelAnimationFrame(guideFrameRef.current);
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsCanvasFullscreen(
        document.fullscreenElement === canvasSectionRef.current,
      );
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fit = () => {
      const { width, height } = viewport.getBoundingClientRect();
      const zoom =
        Math.floor(
          (Math.min(
            (width - 80) / canvasWidth,
            (height - 64) / canvasHeight,
            1.2,
          ) *
            100) /
            5,
        ) * 5;
      zoomCallback.current(Math.max(35, zoom));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    fit();
    return () => observer.disconnect();
  }, [fitRequest]);

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
        outcomeMode ? `${outcomeMode}-canvas` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Dashboard canvas"
    >
      <div className="page-header">
        <div className="page-header__identity">
          <p className="eyebrow">Story canvas · Slide {activePage.order}</p>
          <h2>{activePage.title}</h2>
          <small>
            Compose analytical tiles, narrative sections, and reusable report
            blocks.
          </small>
        </div>
        <div className="canvas-toolbar">
          <span className="canvas-element-count">
            {activePage.tiles.length + activePage.elements.length} element
            {activePage.tiles.length + activePage.elements.length === 1
              ? ""
              : "s"}
          </span>
          <div className="zoom-control" aria-label="Canvas zoom">
            <button
              type="button"
              className="mini-button"
              onClick={() => onZoomChange(canvasZoom - 10)}
            >
              -
            </button>
            <input
              type="range"
              min="35"
              max="160"
              step="5"
              value={canvasZoom}
              style={
                {
                  "--range-fill": rangeFill(canvasZoom, 35, 160),
                } as CSSProperties
              }
              onChange={(event) => onZoomChange(Number(event.target.value))}
            />
            <button
              type="button"
              className="mini-button"
              onClick={() => onZoomChange(canvasZoom + 10)}
            >
              +
            </button>
            <strong>{canvasZoom}%</strong>
          </div>
        </div>
      </div>
      <div
        className={
          hasSelection
            ? "floating-format-bar has-selection"
            : "floating-format-bar"
        }
        aria-label="Quick actions"
      >
        <div className="floating-format-bar__context">
          <span>{hasSelection ? "Editing" : "Canvas"}</span>
          <strong>{selectedObjectLabel}</strong>
        </div>
        <button
          type="button"
          className="page-action"
          onClick={onOpenPageDesign}
        >
          Page design
        </button>
        <span className="floating-format-bar__divider" />
        {hasSelection ? (
          <div
            className="selection-action-group"
            aria-label="Selected object actions"
          >
            <button
              type="button"
              className="primary-action"
              onClick={onOpenFormat}
            >
              Format
            </button>
            <button type="button" onClick={onOpenLayout}>
              Position
            </button>
            <button type="button" onClick={onBringForward}>
              Front
            </button>
            <button type="button" onClick={onDuplicateSelection}>
              Duplicate
            </button>
            <button
              type="button"
              className="danger-action"
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          </div>
        ) : (
          <small>Select an object to format it</small>
        )}
      </div>
      {outcomeMode && (
        <div className={`outcome-preview-card ${outcomeMode}`} role="status">
          <span>{outcomeCanvasLabel}</span>
          <strong>
            Slide {activePage.order} of {sortedPages.length}:{" "}
            {storyGuidance.pageRoleLabel}
          </strong>
          <small>{outcomePreviewHelper}</small>
        </div>
      )}
      <div className="canvas-viewport" ref={viewportRef}>
        <div
          className="canvas-zoom-shell"
          style={{
            width: canvasWidth * canvasScale,
            height: canvasHeight * canvasScale,
          }}
        >
          <div
            className="freeform-canvas"
            onDragOver={(event) => {
              if (
                event.dataTransfer.types.includes("application/ecofocus-source")
              ) {
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
            {activePage.tiles.length === 0 &&
              activePage.elements.length === 0 && (
                <div className="empty-canvas-state">
                  <span className="studio-empty-icon">
                    <Table2 size={28} />
                  </span>
                  <strong>Your next insight starts here.</strong>
                  <p>
                    Start with a question. Add an analysis, then shape the story
                    around it.
                  </p>
                  <div>
                    <button type="button" onClick={onOpenDataLibrary}>
                      Create analysis
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={onOpenInsertPanel}
                    >
                      Explore elements
                    </button>
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
                compositionObjectsRef={compositionObjectsRef}
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
                compositionObjectsRef={compositionObjectsRef}
                updateGuideState={updateGuideState}
                clearGuideState={clearGuideState}
                onSelectTile={onSelectTile}
                onUpdateTileLayout={onUpdateTileLayout}
                onUpdateTileTitle={onUpdateTileTitle}
                onUpdateTileAppearance={onUpdateTileAppearance}
                renderTile={renderTile}
              />
            ))}
            {multiSelectionSummary.bounds &&
              multiSelectionSummary.count > 1 && (
                <div
                  className="multi-selection-canvas-bounds"
                  style={{
                    left: multiSelectionSummary.bounds.x,
                    top: multiSelectionSummary.bounds.y,
                    width: multiSelectionSummary.bounds.width,
                    height: multiSelectionSummary.bounds.height,
                  }}
                >
                  <span>
                    {multiSelectionSummary.count} selected ·{" "}
                    {multiSelectionSummary.bounds.width} x{" "}
                    {multiSelectionSummary.bounds.height}
                  </span>
                </div>
              )}
            {activeGuideState &&
              activeGuideState.guides.map((guide) => (
                <div
                  className={`composition-guide ${guide.orientation}`}
                  key={`${guide.orientation}-${guide.position}-${guide.label}`}
                  style={
                    guide.orientation === "vertical"
                      ? { left: guide.position }
                      : { top: guide.position }
                  }
                >
                  <span>{guide.label}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
      {storyHintVisible && (
        <div className="story-arc-pill" role="status">
          <span className="story-arc-pill__icon" aria-hidden="true">
            <Sparkles className="story-arc-icon" strokeWidth={1.9} />
          </span>
          <strong>{storyGuidance.pageRoleLabel} story arc:</strong>
          <span>{storyGuidance.arcLabel}</span>
          <button
            type="button"
            aria-label="Dismiss story suggestion"
            onClick={() => setStoryHintVisible(false)}
          >
            <X
              className="canvas-action-icon"
              aria-hidden="true"
              strokeWidth={2}
            />
          </button>
        </div>
      )}
      <div className="canvas-bottom-bar" aria-label="Story page actions">
        <div className="slide-nav-controls">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous page"
            disabled={!previousPage}
            onClick={() => previousPage && onSetActivePage(previousPage.id)}
          >
            <ChevronLeft
              className="canvas-action-icon"
              aria-hidden="true"
              strokeWidth={2}
            />
          </button>
          <strong>
            Page {activePage.order}
            <span> / {sortedPages.length}</span>
          </strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Next page"
            disabled={!nextPage}
            onClick={() => nextPage && onSetActivePage(nextPage.id)}
          >
            <ChevronRight
              className="canvas-action-icon"
              aria-hidden="true"
              strokeWidth={2}
            />
          </button>
        </div>
        <div className="canvas-insert-actions">
          <button type="button" onClick={onAddPage}>
            <CanvasActionIcon icon="addSlide" />
            New page
          </button>
          <span className="studio-toolbar-divider" />
          <button type="button" onClick={onOpenDataLibrary}>
            <CanvasActionIcon icon="data" />
            Analysis
          </button>
          <button type="button" onClick={() => onAddElement("text")}>
            <CanvasActionIcon icon="text" />
            Text
          </button>
          <button type="button" onClick={onOpenInsertPanel}>
            <CanvasActionIcon icon="shape" />
            More
          </button>
        </div>
        <div className="canvas-bottom-tools">
          <button
            type="button"
            aria-label="Story guidance"
            aria-pressed={storyHintVisible}
            title="Show story guidance"
            onClick={() => setStoryHintVisible((current) => !current)}
          >
            <Sparkles size={16} />
          </button>
          <button
            type="button"
            className="canvas-icon-only-action"
            title="Fullscreen canvas"
            aria-label={
              isCanvasFullscreen
                ? "Exit fullscreen canvas"
                : "Fullscreen canvas"
            }
            onClick={() => void toggleCanvasFullscreen()}
          >
            <CanvasActionIcon icon="fit" />
          </button>
        </div>
      </div>
    </section>
  );
});
