import type { CSSProperties, DragEvent, ReactNode } from "react";
import { Rnd } from "react-rnd";
import { canvasHeight, canvasWidth } from "../builderConstants";
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
  const canvasStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    background: canvasBackground(activePage),
    backgroundSize: canvasBackgroundSize(activePage),
    backgroundRepeat: canvasBackgroundRepeat(activePage),
    backgroundPosition: canvasBackgroundPosition(activePage),
    transform: `scale(${canvasScale})`
  };

  return (
    <section className="canvas" aria-label="Dashboard canvas">
      <div className="page-header">
        <div>
          <p className="eyebrow">Page {activePage.order}</p>
          <h2>{activePage.title}</h2>
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
        <button type="button" onClick={onOpenPageDesign}>Page design</button>
        <span />
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
              <div className="empty-state">Add charts, tables, text, shapes, or images to start building this page.</div>
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
                }}
                onDragStop={(_, data) => onUpdateElementLayout(element.id, { x: data.x, y: data.y })}
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
                }}
                onDragStop={(_, data) => onUpdateTileLayout(tile.id, { x: data.x, y: data.y })}
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
          </div>
        </div>
      </div>
      <div className="page-strip" aria-label="Dashboard pages">
        {sortedPages.map((page) => (
          <button
            type="button"
            key={page.id}
            className={page.id === activePage.id ? "page-thumb active" : "page-thumb"}
            onClick={() => {
              onSetActivePage(page.id);
              onSelectPage();
            }}
          >
            <span>{page.order}</span>
            <div>
              <strong>{page.title}</strong>
              <small>{page.tiles.length + page.elements.length} items</small>
            </div>
          </button>
        ))}
        <button type="button" className="page-thumb add" onClick={onAddPage}>+</button>
      </div>
    </section>
  );
}
