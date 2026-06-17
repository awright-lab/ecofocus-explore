import { ColorField, rangeFill } from "../../design-system/DesignControls";
import {
  axisRotationPresets,
  defaultGridSize,
  effectPresets,
  type EffectPreset
} from "../builderConstants";
import { effectShadow, gradientCss } from "../builderHelpers";
import { getBarStyle, getPaletteId } from "./CanvasRenderers";
import { ElementInspector, TileAnalysisInspector, TileContainerInspector } from "./InspectorObjectSections";
import type { BuilderInspectorProps } from "./BuilderInspector";

export function PageInspector(props: BuilderInspectorProps) {
  const {
    settingsView,
    activePage,
    dashboardPageCount,
    updateActivePage,
    duplicateActivePage,
    deleteActivePage,
    setDesignModal
  } = props;

  return (
    <>
          {settingsView === "page" && (
            <>
          <label>
            Page title
            <input value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} />
          </label>
          <div className="panel-title subtle">
            <h2>Canvas</h2>
          </div>
          <label>
            Grid size
            <input
              type="number"
              min="8"
              max="96"
              step="4"
              value={activePage.gridSize}
              onChange={(event) => updateActivePage({ gridSize: Math.min(96, Math.max(8, Number(event.target.value) || defaultGridSize)) })}
            />
          </label>
          <div className="toggle-list">
            <label>
              <input type="checkbox" checked={activePage.showCanvasGrid} onChange={(event) => updateActivePage({ showCanvasGrid: event.target.checked })} /> Show grid
            </label>
            <label>
              <input type="checkbox" checked={activePage.snapToGrid} onChange={(event) => updateActivePage({ snapToGrid: event.target.checked })} /> Snap to grid
            </label>
          </div>
          <button type="button" className="design-popover-button" onClick={() => setDesignModal("pageBackground")}>
            <span
              className="gradient-button-preview"
              style={{
                background:
                  activePage.backgroundMode === "image" && activePage.backgroundImage
                    ? `center / cover no-repeat url("${activePage.backgroundImage.replace(/"/g, '\\"')}")`
                    : activePage.backgroundMode === "gradient"
                      ? gradientCss(activePage.gradientFrom, activePage.gradientTo, activePage.gradientStops, activePage.gradientType, `${activePage.gradientAngle}deg`)
                      : activePage.background
              }}
            />
            <span>Background</span>
            <small>{activePage.backgroundMode === "image" ? "Image" : activePage.backgroundMode[0].toUpperCase() + activePage.backgroundMode.slice(1)}</small>
          </button>
          <div className="brand-card-actions">
            <button type="button" className="secondary" onClick={duplicateActivePage}>
              Duplicate page
            </button>
          <button type="button" className="secondary" onClick={deleteActivePage} disabled={dashboardPageCount <= 1}>
            Delete page
          </button>
          </div>
            </>
          )}

    </>
  );
}

export function LayoutInspector(props: BuilderInspectorProps) {
  const {
    settingsView,
    selectedTile,
    selectedElement,
    changeSelectedLayer,
    alignSelected,
    applyLayoutPreset,
    updateSelectedLayout
  } = props;

  return (
    <>
          {settingsView === "layout" && (selectedTile || selectedElement) && (
            <>
              <div className="panel-title subtle">
                <h2>Layers</h2>
              </div>
              <div className="layer-grid">
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("front")}>Front</button>
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("forward")}>Forward</button>
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("backward")}>Backward</button>
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("back")}>Back</button>
              </div>
              <div className="panel-title subtle">
                <h2>Arrange</h2>
              </div>
              <div className="layer-grid">
                <button type="button" className="secondary" onClick={() => alignSelected("left")}>Left</button>
                <button type="button" className="secondary" onClick={() => alignSelected("center")}>Center</button>
                <button type="button" className="secondary" onClick={() => alignSelected("right")}>Right</button>
                <button type="button" className="secondary" onClick={() => alignSelected("top")}>Top</button>
                <button type="button" className="secondary" onClick={() => alignSelected("middle")}>Middle</button>
                <button type="button" className="secondary" onClick={() => alignSelected("bottom")}>Bottom</button>
              </div>
              <div className="panel-title subtle">
                <h2>Quick layouts</h2>
              </div>
              <div className="settings-menu">
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("hero")}>
                  <strong>Hero frame</strong>
                  <span>Wide placement near the top for lead stories and opening statements.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("leftColumn")}>
                  <strong>Left column</strong>
                  <span>Anchor the selected item into a narrow left reading column.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("rightColumn")}>
                  <strong>Right column</strong>
                  <span>Move the selected item into a right-side comparison or support slot.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("footer")}>
                  <strong>Footer note</strong>
                  <span>Place the selected item low on the canvas for sources or supporting notes.</span>
                </button>
              </div>
              <div className="layout-grid">
                <label>
                  X
                  <input type="number" value={selectedTile?.layout.x ?? selectedElement?.layout.x ?? 0} onChange={(event) => updateSelectedLayout({ x: Number(event.target.value) })} />
                </label>
                <label>
                  Y
                  <input type="number" value={selectedTile?.layout.y ?? selectedElement?.layout.y ?? 0} onChange={(event) => updateSelectedLayout({ y: Number(event.target.value) })} />
                </label>
                <label>
                  W
                  <input type="number" value={selectedTile?.layout.width ?? selectedElement?.layout.width ?? 0} onChange={(event) => updateSelectedLayout({ width: Number(event.target.value) })} />
                </label>
                <label>
                  H
                  <input type="number" value={selectedTile?.layout.height ?? selectedElement?.layout.height ?? 0} onChange={(event) => updateSelectedLayout({ height: Number(event.target.value) })} />
                </label>
              </div>
            </>
          )}

    </>
  );
}



export function ObjectInspector(props: BuilderInspectorProps) {
  const { settingsView, selectedElement, selectedTile } = props;

  if (settingsView !== "element" && settingsView !== "chart" && settingsView !== "container") {
    return null;
  }

  return (
    <>
      <div className="panel-title subtle">
        <h2>{selectedElement ? "Element" : "Tile"}</h2>
      </div>
      {selectedElement ? (
        <ElementInspector {...props} />
      ) : !selectedTile ? (
        <div className="empty-state compact">Select a canvas item to edit its display.</div>
      ) : settingsView === "container" ? (
        <TileContainerInspector {...props} />
      ) : (
        <TileAnalysisInspector {...props} />
      )}
    </>
  );
}
