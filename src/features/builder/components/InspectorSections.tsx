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
import type { DashboardPage, PageMasterPreset, PageThemePreset } from "../../../../shared/types/dashboard";

function pageProvenanceView(page: BuilderInspectorProps["activePage"]) {
  if (page.provenance?.status === "template-derived" && page.provenance.templateLabel) {
    return {
      label: "From template",
      message: page.provenance.templateLabel,
      helper: page.provenance.themeLabel ? `Theme: ${page.provenance.themeLabel}` : "Template-derived page"
    };
  }

  if (page.provenance?.themeLabel) {
    return {
      label: "From theme",
      message: page.provenance.themeLabel,
      helper: "Custom page using a saved page theme"
    };
  }

  return {
    label: "Custom page",
    message: "No source template is attached.",
    helper: "Future page-master behavior can build from this provenance."
  };
}

function pageMasterProvenanceView(page: BuilderInspectorProps["activePage"]) {
  if (page.provenance?.masterStatus === "master-based" && page.provenance.masterLabel) {
    return {
      label: "From master",
      message: page.provenance.masterLabel,
      helper: "Master provenance only. This page is not live-linked and inherited regions are not active yet."
    };
  }

  return {
    label: "No master",
    message: "This page is not based on a page master.",
    helper: "Future master-page inheritance can attach to this provenance without changing current page content."
  };
}

function pageMasterProvenanceUpdate(page: DashboardPage, masterId: string, pageMasters: PageMasterPreset[]): Pick<DashboardPage, "provenance"> {
  const baseProvenance = page.provenance ?? { masterStatus: "none" as const, status: "custom" as const };

  if (masterId === "none") {
    return {
      provenance: {
        ...baseProvenance,
        masterId: undefined,
        masterLabel: undefined,
        masterStatus: "none"
      }
    };
  }

  const pageMaster = pageMasters.find((master) => master.id === masterId);
  if (!pageMaster) {
    return { provenance: baseProvenance };
  }

  return {
    provenance: {
      ...baseProvenance,
      masterId: pageMaster.id,
      masterLabel: pageMaster.label,
      masterStatus: "master-based"
    }
  };
}

export function PageInspector(props: BuilderInspectorProps) {
  const {
    settingsView,
    activePage,
    dashboardPageCount,
    updateActivePage,
    duplicateActivePage,
    deleteActivePage,
    pageMasters,
    pageThemes,
    applyPageMasterLayout,
    applyPageTheme,
    setDesignModal
  } = props;
  const provenance = pageProvenanceView(activePage);
  const masterProvenance = pageMasterProvenanceView(activePage);
  const activePageMaster = pageMasters.find((master) => master.id === activePage.provenance?.masterId);

  return (
    <>
          {settingsView === "page" && (
            <>
          <label>
            Page title
            <input value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} />
          </label>
          <div className="page-provenance-cue">
            <strong>{provenance.label}</strong>
            <span>{provenance.message}</span>
            <small>{provenance.helper}</small>
          </div>
          <div className="page-provenance-cue master">
            <strong>{masterProvenance.label}</strong>
            <span>{masterProvenance.message}</span>
            <small>{masterProvenance.helper}</small>
          </div>
          <div className="page-master-reassign-card">
            <div className="explorer-section-header">
              <strong>Page master provenance</strong>
              <small>Metadata only. No live inheritance.</small>
            </div>
            <label>
              Master
              <select
                value={activePage.provenance?.masterStatus === "master-based" ? activePage.provenance.masterId ?? "none" : "none"}
                onChange={(event) => updateActivePage(pageMasterProvenanceUpdate(activePage, event.target.value, pageMasters))}
              >
                <option value="none">No master</option>
                {pageMasters.map((master) => (
                  <option value={master.id} key={master.id}>
                    {master.label}
                  </option>
                ))}
              </select>
            </label>
            <small>
              Changes master provenance only. It does not copy master regions, create locked inherited objects, or sync updates.
            </small>
          </div>
          <div className="page-master-layout-card">
            <div className="explorer-section-header">
              <strong>Master layout preview</strong>
              <small>{activePageMaster ? `${activePageMaster.elements.length} static region${activePageMaster.elements.length === 1 ? "" : "s"}` : "No master selected"}</small>
            </div>
            {activePageMaster ? (
              <>
                <div className="page-master-layout-list">
                  {activePageMaster.elements.map((element) => (
                    <div className="page-master-layout-row" key={`${activePageMaster.id}-${element.name}-${element.layout.x}-${element.layout.y}`}>
                      <strong>{element.name}</strong>
                      <span>{element.content}</span>
                      <small>{Math.round(element.layout.width)}x{Math.round(element.layout.height)} at {Math.round(element.layout.x)}, {Math.round(element.layout.y)}</small>
                    </div>
                  ))}
                </div>
                <button type="button" className="secondary" onClick={() => applyPageMasterLayout(activePageMaster)} disabled={activePageMaster.elements.length === 0}>
                  Apply master layout once
                </button>
                <small>
                  Copies these static elements into the page as editable page content. No live link, inherited locks, or future sync is created.
                </small>
              </>
            ) : (
              <small>Assign a master provenance above to preview and copy its static layout regions.</small>
            )}
          </div>
          <div className="page-theme-rebase-card">
            <div className="explorer-section-header">
              <strong>Rebase page theme</strong>
              <small>Applies theme values now. No live inheritance.</small>
            </div>
            <div className="page-theme-rebase-list">
              {pageThemes.map((theme) => (
                <button type="button" key={theme.id} className="page-theme-rebase-option" onClick={() => applyPageTheme(theme)}>
                  <span className="brand-theme-preview" style={{ background: pageThemePreview(theme) }} />
                  <span>{theme.label}</span>
                  <small>{activePage.provenance?.themeId === theme.id ? "Current provenance" : "Apply theme"}</small>
                </button>
              ))}
            </div>
          </div>
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

function pageThemePreview(theme: PageThemePreset) {
  return theme.backgroundMode === "gradient"
    ? gradientCss(theme.gradientFrom, theme.gradientTo, theme.gradientStops, theme.gradientType, `${theme.gradientAngle}deg`)
    : theme.backgroundMode === "image" && theme.backgroundImage
      ? `center / cover no-repeat url("${theme.backgroundImage.replace(/"/g, '\\"')}")`
      : theme.background;
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
