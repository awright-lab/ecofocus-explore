import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
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
  const paths: Record<CanvasActionIconName, ReactNode> = {
    addSlide: <><rect x="5" y="6" width="14" height="12" rx="2" /><path d="M12 9v6M9 12h6" /></>,
    data: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    text: <><path d="M5 6h14M12 6v12M9 18h6" /></>,
    shape: <rect x="6" y="6" width="12" height="12" rx="2" />,
    image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m6.5 17 4.2-4.2 2.6 2.6 2.1-2.1 2.1 3.7" /></>,
    comment: <><path d="M5 6h14v9H9l-4 4z" /><path d="M8 10h8M8 13h5" /></>,
    notes: <><path d="M6 4h10l2 2v14H6z" /><path d="M16 4v4h4M9 12h6M9 15h6" /></>,
    fit: <><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" /><path d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5" /></>
  };

  return (
    <svg className="canvas-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

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
          { icon: "◎", value: "84%", label: "Care About Workplace Culture", helper: "vs. 78% in 2024 ↑", tone: "teal" },
          { icon: "♡", value: "41%", label: "Feel Supported at Work", helper: "vs. 35% in 2024 ↑", tone: "indigo" },
          { icon: "↗", value: "2x", label: "Growth in Job-Seeker Influence", helper: "vs. 2024 ↑", tone: "coral" }
        ].map((item) => (
          <article className={`mockup-kpi-card ${item.tone}`} key={item.value}>
            <span>{item.icon}</span>
            <strong>{item.value}</strong>
            <p>{item.label}</p>
            <small>{item.helper}</small>
          </article>
        ))}
      </div>

      <section className="mockup-chart-card mockup-selected-chart">
        <div className="mockup-object-toolbar" aria-hidden="true">
          <button type="button">✥</button>
          <button type="button">⚙</button>
          <button type="button">▣</button>
          <button type="button">⌫</button>
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
  const selectedObjectLabel =
    multiSelectionSummary.count > 1
      ? `${multiSelectionSummary.count} objects selected`
      : selectedTileId
        ? activePage.tiles.find((tile) => tile.id === selectedTileId)?.title ?? "Tile selected"
        : selectedElementId
          ? activePage.elements.find((element) => element.id === selectedElementId)?.name ?? "Element selected"
          : "Page canvas";
  const activePageIndex = sortedPages.findIndex((page) => page.id === activePage.id);
  const previousPage = activePageIndex > 0 ? sortedPages[activePageIndex - 1] : null;
  const nextPage = activePageIndex >= 0 && activePageIndex < sortedPages.length - 1 ? sortedPages[activePageIndex + 1] : null;
  const showMockupStorySurface = false;
  const storyGuidance = buildStoryGuidanceView(
    activePage,
    activePage.tiles.find((tile) => tile.id === selectedTileId) ?? null,
    activePage.elements.find((element) => element.id === selectedElementId) ?? null,
    sortedPages.length
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
            {activePage.elements.filter((element) => !element.hidden).map((element) => (
              <Rnd
                key={element.id}
                className={element.id === selectedElementId ? "canvas-draggable-frame selected" : "canvas-draggable-frame"}
                bounds="parent"
                scale={canvasScale}
                size={{ width: element.layout.width, height: element.layout.height }}
                position={{ x: element.layout.x, y: element.layout.y }}
                style={{ zIndex: element.layout.zIndex }}
                dragGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                resizeGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
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
                {renderElement(element, element.id === selectedElementId, () => onSelectElement(element.id))}
                {element.id === selectedElementId && <CanvasSelectionHandles />}
              </Rnd>
            ))}
            {activePage.tiles.filter((tile) => !tile.hidden).map((tile) => (
              <Rnd
                key={tile.id}
                className={tile.id === selectedTileId ? "canvas-draggable-frame selected" : "canvas-draggable-frame"}
                bounds="parent"
                scale={canvasScale}
                dragHandleClassName="tile-drag-handle"
                minWidth={320}
                minHeight={220}
                size={{ width: tile.layout.width, height: tile.layout.height }}
                position={{ x: tile.layout.x, y: tile.layout.y }}
                style={{ zIndex: tile.layout.zIndex }}
                dragGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                resizeGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
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
                  tile.id === selectedTileId,
                  () => onSelectTile(tile.id),
                  (title) => onUpdateTileTitle(tile.id, title),
                  (updates) => onUpdateTileAppearance(tile.id, updates)
                )}
                {tile.id === selectedTileId && <CanvasSelectionHandles />}
              </Rnd>
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
        <span className="story-arc-pill__icon" aria-hidden="true">✦</span>
        <strong>{storyGuidance.pageRoleLabel} story arc:</strong>
        <span>{storyGuidance.arcLabel}</span>
        <button type="button" aria-label="Dismiss story suggestion">×</button>
      </div>
      <div className="canvas-bottom-bar" aria-label="Story page actions">
        <div className="slide-nav-controls">
          <button type="button" className="icon-button" disabled={!previousPage} onClick={() => previousPage && onSetActivePage(previousPage.id)}>‹</button>
          <strong>Slide {activePage.order} of {sortedPages.length}</strong>
          <button type="button" className="icon-button" disabled={!nextPage} onClick={() => nextPage && onSetActivePage(nextPage.id)}>›</button>
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
