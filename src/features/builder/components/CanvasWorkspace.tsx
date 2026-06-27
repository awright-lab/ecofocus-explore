import { useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { canvasHeight, canvasWidth } from "../builderConstants";
import { buildCompositionGuideObjects, buildCompositionGuideState, type CompositionGuideObject, type CompositionGuideState } from "./compositionGuidesModel";
import { buildMultiSelectionSummary } from "./multiSelectionModel";
import type { MultiSelectedObject } from "../builderTypes";
import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";

function rangeFill(value: number | string, min: number, max: number) {
  const numericValue = Number(value);
  const percentage = ((numericValue - min) / (max - min)) * 100;
  return `${Math.min(100, Math.max(0, percentage))}%`;
}

export function CanvasWorkspace({
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
  onOpenLayout,
  onBringForward,
  onDuplicateSelection,
  onDeleteSelection,
  onAddPage,
  onSetActivePage,
  onUpdateTileLayout,
  onUpdateElementLayout,
  renderTile,
  renderElement
}: {
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
  onOpenLayout: () => void;
  onBringForward: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onAddPage: () => void;
  onSetActivePage: (pageId: string) => void;
  onUpdateTileLayout: (tileId: string, updates: Partial<DashboardTile["layout"]>) => void;
  onUpdateElementLayout: (elementId: string, updates: Partial<DashboardCanvasElement["layout"]>) => void;
  renderTile: (tile: DashboardTile, selected: boolean, onSelect: () => void) => ReactNode;
  renderElement: (element: DashboardCanvasElement, selected: boolean, onSelect: () => void) => ReactNode;
}) {
  const [activeGuideState, setActiveGuideState] = useState<CompositionGuideState | null>(null);
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
  const canvasStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    background: canvasBackground(activePage),
    backgroundSize: canvasBackgroundSize(activePage),
    backgroundRepeat: canvasBackgroundRepeat(activePage),
    backgroundPosition: canvasBackgroundPosition(activePage),
    transform: `scale(${canvasScale})`
  };
  const updateGuideState = (movingObject: CompositionGuideObject) => {
    setActiveGuideState(buildCompositionGuideState({ movingObject, objects: compositionObjects }));
  };
  const clearGuideState = () => setActiveGuideState(null);

  return (
    <section className="canvas" aria-label="Dashboard canvas">
      <div className="page-header">
        <div>
          <p className="eyebrow">Story canvas · Slide {activePage.order}</p>
          <h2>{activePage.title}</h2>
          <small>Compose analytical tiles, narrative sections, and reusable report blocks.</small>
        </div>
        <div className="canvas-toolbar">
          <span>{activePage.tiles.length + activePage.elements.length} element{activePage.tiles.length + activePage.elements.length === 1 ? "" : "s"}</span>
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
        <button type="button" onClick={onOpenPageDesign}>Page design</button>
        <span className="floating-format-bar__divider" />
        {hasSelection ? (
          <div className="selection-action-group" aria-label="Selected object actions">
            <button type="button" onClick={onOpenLayout}>Position</button>
            <button type="button" onClick={onBringForward}>Front</button>
            <button type="button" onClick={onDuplicateSelection}>Duplicate</button>
            <button type="button" onClick={onDeleteSelection}>Delete</button>
          </div>
        ) : (
          <small>Select an object for quick actions</small>
        )}
      </div>
      <div className="canvas-viewport">
        <div className="canvas-zoom-shell" style={{ width: canvasWidth * canvasScale, height: canvasHeight * canvasScale }}>
          <div
            className="freeform-canvas"
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
            {activePage.tiles.length === 0 && activePage.elements.length === 0 && (
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
                bounds="parent"
                scale={canvasScale}
                size={{ width: element.layout.width, height: element.layout.height }}
                position={{ x: element.layout.x, y: element.layout.y }}
                style={{ zIndex: element.layout.zIndex }}
                dragGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                resizeGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                disableDragging={element.locked}
                enableResizing={!element.locked}
                onDragStart={() => {
                  onSelectElement(element.id);
                  updateGuideState({ id: element.id, type: "element", layout: element.layout });
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
              </Rnd>
            ))}
            {activePage.tiles.filter((tile) => !tile.hidden).map((tile) => (
              <Rnd
                key={tile.id}
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
                disableDragging={tile.locked}
                enableResizing={!tile.locked}
                onDragStart={() => {
                  onSelectTile(tile.id);
                  updateGuideState({ id: tile.id, type: "tile", layout: tile.layout });
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
                {renderTile(tile, tile.id === selectedTileId, () => onSelectTile(tile.id))}
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
        <strong>Suggested story arc:</strong>
        <span>Demand is rising → Opportunity → Implications</span>
        <button type="button" aria-label="Dismiss story suggestion">×</button>
      </div>
      <div className="canvas-bottom-bar" aria-label="Story page actions">
        <div className="slide-nav-controls">
          <button type="button" className="icon-button" disabled={!previousPage} onClick={() => previousPage && onSetActivePage(previousPage.id)}>‹</button>
          <strong>Slide {activePage.order} of {sortedPages.length}</strong>
          <button type="button" className="icon-button" disabled={!nextPage} onClick={() => nextPage && onSetActivePage(nextPage.id)}>›</button>
        </div>
        <div className="canvas-insert-actions">
          <button type="button" onClick={onAddPage}>＋ Add slide</button>
          <button type="button">▤ Add data</button>
          <button type="button">T Add text</button>
          <button type="button">□ Add shape</button>
          <button type="button">▧ Add image</button>
          <button type="button">○ Comment</button>
        </div>
        <div className="canvas-bottom-tools">
          <button type="button">Notes</button>
          <button type="button" aria-label="Fit to screen">⤢</button>
        </div>
      </div>
    </section>
  );
}
