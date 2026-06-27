import { useState, type CSSProperties, type ReactNode } from "react";
import { BuilderPanel } from "./BuilderChrome";
import { LayoutInspector, ObjectInspector, PageInspector } from "./InspectorSections";
import { TileAnalysisQuerySection, TileAnalysisResultSection } from "./InspectorTileAnalysisSections";
import { buildMultiSelectionSummary } from "./multiSelectionModel";
import type { MultiSelectionLayoutAction } from "./multiSelectionModel";
import { BarColorField, ColorField, PageBackgroundField, rangeFill } from "../../design-system/DesignControls";
import {
  axisRotationPresets,
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  defaultGridSize,
  effectPresets,
  filterDimensions,
  fontFamilies,
  waveComparisonChartTypes,
  type EffectPreset
} from "../builderConstants";
import { effectShadow, gradientCss } from "../builderHelpers";
import { comparisonSummaryLabel, getAxisLabel, getBarStyle, getPaletteId, tileSourceKindLabel } from "./CanvasRenderers";
import { getChartTypeLabel, getQuestionLabel } from "../../analytics/analyticsDisplay";
import type { BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardPage,
  DashboardTile,
  DesignColorPalette,
  PageMasterPreset,
  PageThemePreset,
  SavedBanner,
  SavedDerivedDefinition,
  SavedFilterSet,
  SavedSegmentProfile,
  SavedVariableSet,
  SavedWeightProfile,
  TextStylePreset,
  TileAppearance
} from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, DerivedDefinitionRecreationCue, DerivedOutputCreationCue, DerivedOutputLibraryActionCue, DerivedOutputRecreationCue, DesignModal, MultiSelectedObject, RelatedObjectNavigationCue, ReportTreeSelectionCue, SavedLibraryInsertionCue, SavedSettingOriginCue, SettingsView } from "../builderTypes";
import type { DerivedOutputConfig, DerivedOutputKind } from "./derivedOutputModel";

type AssistantRailIcon = "templates" | "themes" | "layout" | "widgets" | "text" | "images" | "elements" | "data";

function AssistantIcon({ icon }: { icon: AssistantRailIcon }) {
  const paths: Record<AssistantRailIcon, ReactNode> = {
    templates: <><rect x="4" y="4" width="6" height="16" rx="1.5" /><rect x="14" y="4" width="6" height="7" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
    themes: <><path d="M5 13.5 12 4l7 9.5" /><path d="M7.5 12.5h9l-2 7h-5z" /><circle cx="12" cy="13" r="2" /></>,
    layout: <><rect x="4" y="5" width="7" height="6" rx="1.5" /><rect x="13" y="5" width="7" height="6" rx="1.5" /><rect x="4" y="13" width="16" height="6" rx="1.5" /></>,
    widgets: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
    text: <><path d="M5 6h14" /><path d="M12 6v13" /><path d="M8 19h8" /></>,
    images: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m7 17 4.5-4.5L15 16l2-2 2 3" /></>,
    elements: <><circle cx="8" cy="8" r="3" /><rect x="13" y="5" width="6" height="6" rx="1.5" /><path d="M5 19h14l-7-7z" /></>,
    data: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>
  };

  return (
    <svg className="assistant-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

export type BuilderInspectorProps = {
  settingsView: SettingsView;
  setSettingsView: (view: SettingsView) => void;
  activePage: DashboardPage;
  dashboardPageCount: number;
  updateActivePage: (updates: Partial<DashboardPage>) => void;
  duplicateActivePage: () => void;
  deleteActivePage: () => void;
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  multiSelectedObjects: MultiSelectedObject[];
  setMultiSelectedHidden: (hidden: boolean) => void;
  setMultiSelectedLocked: (locked: boolean) => void;
  alignMultiSelected: (action: MultiSelectionLayoutAction) => void;
  clearMultiSelection: () => void;
  savedBanners: SavedBanner[];
  savedFilters: SavedFilterSet[];
  savedVariableSets: SavedVariableSet[];
  savedWeights: SavedWeightProfile[];
  savedSegmentProfiles: SavedSegmentProfile[];
  savedDerivedDefinitions: SavedDerivedDefinition[];
  selectedTileQuestion: typeof defaultDataset.questions[number] | null;
  selectedTileFilterDimension?: typeof filterDimensions[number];
  selectedChartPart: { id: string; label: string } | null;
  selectedChartPartId: string;
  setSelectedChartPartId: (id: string) => void;
  chartStyleTargets: Array<{ id: string; label: string }>;
  textStylePresets: TextStylePreset[];
  designPalettes: DesignColorPalette[];
  pageMasters: PageMasterPreset[];
  pageThemes: PageThemePreset[];
  applyPageMasterLayout: (pageMaster: PageMasterPreset) => void;
  setDesignModal: (modal: DesignModal) => void;
  changeSelectedLayer: (direction: "front" | "back" | "forward" | "backward") => void;
  alignSelected: (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  applyLayoutPreset: (preset: "hero" | "leftColumn" | "rightColumn" | "footer") => void;
  updateSelectedLayout: (layout: Partial<CanvasLayout>) => void;
  updateSelectedElement: (updates: Partial<DashboardCanvasElement>) => void;
  updateSelectedTile: (updates: Partial<DashboardTile>) => void;
  selectTile: (tileId: string) => void;
  updateSelectedAppearance: (updates: Partial<TileAppearance>) => void;
  updateSelectedBarStyle: (updates: Partial<TileAppearance["barStyles"][string]>) => void;
  updateSelectedAxisLabel: (value: string) => void;
  applyTextStylePresetToSelection: (preset: TextStylePreset) => void;
  applyPageTheme: (theme: PageThemePreset) => void;
  applyPalettePresetToBars: (colors: string[]) => void;
  applyPaletteColorToSelectedBar: (color: string) => void;
  applySolidColorToBars: (color: string) => void;
  clearBarColorOverrides: (nextShared?: Partial<TileAppearance>) => void;
  applySelectedElementEffectPreset: (preset: EffectPreset) => void;
  applySelectedTileEffectPreset: (preset: EffectPreset) => void;
  tileWithVisualization: (tile: DashboardTile, nextVisualization: ChartType) => Partial<DashboardTile>;
  duplicateTileAsVisualization: (tile: DashboardTile, nextVisualization: ChartType) => void;
  duplicateDerivedOutputTile: (tile: DashboardTile) => string | null;
  createDerivedOutputTile: (tile: DashboardTile, kind: DerivedOutputKind, options?: { config?: DerivedOutputConfig }) => string | null;
  recreateDerivedOutputTile: (tile: DashboardTile) => boolean;
  saveDerivedDefinition: (definition: SavedDerivedDefinition) => void;
  rerunTileAnalysis: (tile: DashboardTile, nextQuery: import("../../../../shared/types/analytics").AnalyticsQueryRequest) => Promise<boolean>;
  saveSelectedTileVariableSet: () => void;
  saveSelectedTileAnalyticalTemplate: () => void;
  saveSelectedTileBanner: () => void;
  saveSelectedTileFilter: () => void;
  saveSelectedTileWeight: () => void;
  onViewSavedSettingInLibrary: (view: AnalysisLibraryView, handoff?: { action?: "derivedDefinitionSaved"; itemId?: string }) => void;
  savedSettingOriginCue: SavedSettingOriginCue;
  recordSavedSettingOriginCue: (kind: "banner" | "filter" | "weight", label: string, tileId: string) => void;
  completeSavedSettingOriginCue: (tileId: string) => void;
  relatedObjectNavigationCue: RelatedObjectNavigationCue;
  recordRelatedObjectNavigationCue: (cue: Omit<NonNullable<RelatedObjectNavigationCue>, "createdAt">) => void;
  reportTreeSelectionCue: ReportTreeSelectionCue;
  savedLibraryInsertionCue: SavedLibraryInsertionCue;
  derivedOutputCreationCue: DerivedOutputCreationCue;
  derivedOutputRecreationCue: DerivedOutputRecreationCue;
  derivedDefinitionRecreationCue: DerivedDefinitionRecreationCue;
  derivedOutputLibraryActionCue: DerivedOutputLibraryActionCue;
  deleteSelectedItem: () => void;
  isLoading: boolean;
  comparisonDatasets: DatasetId[];
};

export function BuilderInspector(props: BuilderInspectorProps) {
  const {
  settingsView,
  setSettingsView,
  activePage,
  dashboardPageCount,
  updateActivePage,
  duplicateActivePage,
  deleteActivePage,
  selectedTile,
  selectedElement,
  multiSelectedObjects,
  setMultiSelectedHidden,
  setMultiSelectedLocked,
  alignMultiSelected,
  clearMultiSelection,
  selectedTileQuestion,
  selectedTileFilterDimension,
  selectedChartPart,
  selectedChartPartId,
  setSelectedChartPartId,
  chartStyleTargets,
  textStylePresets,
  designPalettes,
  pageThemes,
  setDesignModal,
  changeSelectedLayer,
  alignSelected,
  applyLayoutPreset,
  updateSelectedLayout,
  updateSelectedElement,
  updateSelectedTile,
  updateSelectedAppearance,
  updateSelectedBarStyle,
  updateSelectedAxisLabel,
  applyTextStylePresetToSelection,
  applyPageTheme,
  applyPalettePresetToBars,
  applyPaletteColorToSelectedBar,
  applySolidColorToBars,
  clearBarColorOverrides,
  applySelectedElementEffectPreset,
  applySelectedTileEffectPreset,
  tileWithVisualization,
  duplicateTileAsVisualization,
  rerunTileAnalysis,
  saveSelectedTileVariableSet,
  saveSelectedTileBanner,
  saveSelectedTileFilter,
  saveSelectedTileWeight,
  onViewSavedSettingInLibrary,
  deleteSelectedItem,
  isLoading,
  comparisonDatasets
  } = props;
  const [inspectorSurface, setInspectorSurface] = useState<"style" | "data" | "insight">("style");
  const multiSelectionSummary = buildMultiSelectionSummary(activePage, multiSelectedObjects);
  const inspectorFocus = multiSelectionSummary.count
    ? {
        label: "Multi-selection",
        title: `${multiSelectionSummary.count} objects selected`,
        helper: `${multiSelectionSummary.tiles.length} tiles and ${multiSelectionSummary.elements.length} elements on ${activePage.title}.`
      }
    : selectedTile
      ? {
          label: "Selected tile",
          title: selectedTile.title || selectedTile.name,
          helper: "Analysis, chart style, layout, and reusable analytical workflows."
        }
      : selectedElement
        ? {
            label: "Selected element",
            title: selectedElement.name,
            helper: "Element styling, layout, layering, and canvas placement."
          }
        : {
            label: "Page focus",
            title: activePage.title,
            helper: "Page design, grid, templates, master provenance, and canvas defaults."
          };
  const insightNotes = selectedTile?.result.notes ?? [];
  const insightWarnings = selectedTile?.result.warnings ?? [];
  const dataContext = selectedTile
    ? {
        source: getQuestionLabel(selectedTile.query.question),
        banner: comparisonSummaryLabel(selectedTile.query),
        chart: getChartTypeLabel(selectedTile.visualization),
        rows: selectedTile.result.table.length,
        columns: selectedTile.result.columns.length
      }
    : null;
  const chartTypeOptions = selectedTile
    ? defaultDataset.chartTypes
        .filter((chartTypeOption) => chartTypeOption.supportedMetrics.includes(selectedTile.query.metric))
        .filter((chartTypeOption) => !chartTypeOption.minSeries || selectedTile.result.columns.length >= chartTypeOption.minSeries)
        .map((chartTypeOption) => chartTypeOption.id)
    : [];
  const activeDesignPaletteId = selectedTile
    ? (designPalettes.find((palette) => palette.colors.join(",") === selectedTile.appearance.palette.join(","))?.id ?? getPaletteId(selectedTile.appearance.palette))
    : "custom";
  const styleQuickCard = selectedTile ? (
    <div className="assistant-style-card">
      <div className="assistant-section-label">Chart</div>
      <label>
        Chart type
        <select
          value={selectedTile.visualization}
          onChange={(event) => updateSelectedTile(tileWithVisualization(selectedTile, event.target.value as ChartType))}
        >
          {chartTypeOptions.map((type) => (
            <option key={type} value={type}>{getChartTypeLabel(type)}</option>
          ))}
        </select>
      </label>
      <label className="toggle-row">
        <span>Show significance markers</span>
        <input
          type="checkbox"
          checked={selectedTile.appearance.showAnnotations}
          onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        <span>Show sample size</span>
        <input
          type="checkbox"
          checked={selectedTile.appearance.showBases}
          onChange={(event) => updateSelectedAppearance({ showBases: event.target.checked })}
        />
      </label>
      <div className="assistant-section-label">Style</div>
      <span className="assistant-field-label">Color theme</span>
      <div className="assistant-palette-row" aria-label="Color theme">
        {designPalettes.slice(0, 5).map((palette) => (
          <button
            type="button"
            key={palette.id}
            className={activeDesignPaletteId === palette.id ? "active" : ""}
            title={palette.label}
            onClick={() => applyPalettePresetToBars(palette.colors)}
            style={{ "--swatch-color": palette.colors[0] } as CSSProperties}
          />
        ))}
      </div>
      <label>
        Number format
        <select value="percentage" onChange={() => undefined}>
          <option value="percentage">Percentage (0%)</option>
          <option value="whole">Whole number</option>
          <option value="decimal">Decimal</option>
        </select>
      </label>
      <label>
        Font
        <select value={selectedTile.appearance.axisFontSize > 12 ? "Inter" : "Inter"} onChange={() => undefined}>
          <option value="Inter">Inter</option>
          <option value="Georgia">Georgia</option>
          <option value="IBM Plex Sans">IBM Plex Sans</option>
        </select>
      </label>
      <label>
        Title style
        <select value="title-case" onChange={() => undefined}>
          <option value="title-case">Title Case</option>
          <option value="sentence">Sentence case</option>
          <option value="compact">Compact label</option>
        </select>
      </label>
      <div className="layout-suggestion-list">
        <div className="assistant-section-header">
          <strong>Layout suggestions</strong>
          <small>See all</small>
        </div>
        <button type="button" className="layout-suggestion active" onClick={() => applyLayoutPreset("leftColumn")}>
          <span className="layout-suggestion-icon"><AssistantIcon icon="layout" /></span>
          <span><strong>Balanced two-column</strong><small>Keep charts side by side</small></span>
          <em>with key insight</em>
        </button>
        <button type="button" className="layout-suggestion" onClick={() => applyLayoutPreset("hero")}>
          <span className="layout-suggestion-icon"><AssistantIcon icon="widgets" /></span>
          <span><strong>KPI strip on top</strong><small>Emphasize KPIs above</small></span>
          <em>main charts</em>
        </button>
        <button type="button" className="layout-suggestion" onClick={() => applyLayoutPreset("footer")}>
          <span className="layout-suggestion-icon"><AssistantIcon icon="templates" /></span>
          <span><strong>Full width hero</strong><small>Make this chart full width</small></span>
          <em>greater impact</em>
        </button>
      </div>
      <div className="assistant-ai-takeaway">
        <div className="assistant-section-header">
          <strong>AI Takeaway ✨</strong>
          <small>Regenerate</small>
        </div>
        <p>Workplace culture is the top priority for employees, outpacing compensation and career growth. With support at work still lagging, organizations have a clear opportunity to build stronger cultures that attract and retain top talent.</p>
        <small>AI-generated content may be inaccurate.</small>
      </div>
    </div>
  ) : null;

  const multiSelectionCard = multiSelectionSummary.count > 0 && (
            <div className="multi-selection-card inspector-primary-card">
              <div className="explorer-section-header">
                <strong>{multiSelectionSummary.count} selected</strong>
                <small>{multiSelectionSummary.tiles.length} tiles · {multiSelectionSummary.elements.length} elements</small>
              </div>
              {multiSelectionSummary.bounds && (
                <div className="multi-selection-bounds" aria-label="Selection bounds">
                  <div>
                    <span>Origin</span>
                    <strong>{multiSelectionSummary.bounds.x}, {multiSelectionSummary.bounds.y}</strong>
                  </div>
                  <div>
                    <span>Footprint</span>
                    <strong>{multiSelectionSummary.bounds.width} x {multiSelectionSummary.bounds.height}</strong>
                  </div>
                  <small>{multiSelectionSummary.footprintLabel}</small>
                  <small>{multiSelectionSummary.horizontalGapLabel}</small>
                  <small>{multiSelectionSummary.verticalGapLabel}</small>
                </div>
              )}
              <div className="multi-selection-list">
                {[...multiSelectionSummary.tiles.map((tile) => ({ id: tile.id, label: tile.title || tile.name, kind: "Tile", hidden: tile.hidden, locked: tile.locked })), ...multiSelectionSummary.elements.map((element) => ({ id: element.id, label: element.name, kind: "Element", hidden: element.hidden, locked: element.locked }))].map((item) => (
                  <div className="multi-selection-row" key={`${item.kind}-${item.id}`}>
                    <span>{item.label}</span>
                    <small>{item.kind} · {item.hidden ? "Hidden" : "Visible"} · {item.locked ? "Locked" : "Unlocked"}</small>
                  </div>
                ))}
              </div>
              <div className="multi-selection-action-group">
                <strong>Visibility</strong>
                <div className="brand-card-actions">
                <button type="button" className="secondary" onClick={() => setMultiSelectedHidden(true)}>Hide</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedHidden(false)}>Show</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedLocked(true)}>Lock</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedLocked(false)}>Unlock</button>
                </div>
              </div>
              <div className="multi-selection-action-group">
                <strong>Align</strong>
                <div className="layout-action-grid">
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("left")} disabled={multiSelectionSummary.count < 2}>Left</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("center")} disabled={multiSelectionSummary.count < 2}>Center</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("right")} disabled={multiSelectionSummary.count < 2}>Right</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("top")} disabled={multiSelectionSummary.count < 2}>Top</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("middle")} disabled={multiSelectionSummary.count < 2}>Middle</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("bottom")} disabled={multiSelectionSummary.count < 2}>Bottom</button>
                </div>
              </div>
              <div className="multi-selection-action-group">
                <strong>Distribute</strong>
                <div className="brand-card-actions">
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("distributeHorizontal")} disabled={multiSelectionSummary.count < 3}>Horizontal</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("distributeVertical")} disabled={multiSelectionSummary.count < 3}>Vertical</button>
                </div>
              </div>
              <button type="button" className="secondary" onClick={clearMultiSelection}>Clear selection</button>
            </div>
          );

  const styleSurface = (
    <>
          {styleQuickCard}
          {multiSelectionCard}
          {settingsView === "home" ? (
            <div className="settings-menu inspector-home">
              <div className="inspector-focus-card">
                <span>{inspectorFocus.label}</span>
                <strong>{inspectorFocus.title}</strong>
                <small>{inspectorFocus.helper}</small>
              </div>
              <button type="button" className="menu-card" onClick={() => setSettingsView("page")}>
                <strong>Page</strong>
                <span>Title, grid, snap, and background</span>
              </button>
              <button type="button" className={selectedTile || selectedElement ? "menu-card primary" : "menu-card"} onClick={() => setSettingsView("layout")} disabled={!selectedTile && !selectedElement}>
                <strong>Arrange</strong>
                <span>Layer order, alignment, size, and position</span>
              </button>
              <button type="button" className={selectedTile || selectedElement ? "menu-card primary" : "menu-card"} onClick={() => setSettingsView(selectedElement ? "element" : "chart")} disabled={!selectedTile && !selectedElement}>
                <strong>{selectedElement ? "Element" : "Tile"}</strong>
                <span>{selectedElement ? "Shape, image, and text styling" : "Chart design and visualization"}</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView("container")} disabled={!selectedTile}>
                <strong>Container</strong>
                <span>Tile background, borders, and notes</span>
              </button>
            </div>
          ) : (
            <details className="advanced-inspector-details">
              <summary>
                <strong>Advanced {settingsView === "page" ? "page" : settingsView === "layout" ? "layout" : settingsView === "container" ? "container" : selectedElement ? "element" : "chart"} editing</strong>
                <span>Open detailed controls</span>
              </summary>
              <div className="panel-title with-action">
                <h2>{settingsView === "page" ? "Page" : settingsView === "layout" ? "Arrange" : settingsView === "container" ? "Container" : selectedElement ? "Element" : "Chart"}</h2>
                <button type="button" className="mini-button" onClick={() => setSettingsView("home")}>Back</button>
              </div>
          <PageInspector {...props} />
          <LayoutInspector {...props} />
          <ObjectInspector {...props} />
            </details>
          )}
    </>
  );
  const dataSurface = selectedTile ? (
    <>
      <div className="inspector-story-card">
        <span>Selected analysis</span>
        <strong>{dataContext?.source}</strong>
        <small>{dataContext?.chart} · {dataContext?.banner}</small>
        <div className="inspector-context-chips">
          <span>{dataContext?.rows} rows</span>
          <span>{dataContext?.columns} columns</span>
          <span>{selectedTile.query.weight ? "Weighted" : "Unweighted"}</span>
        </div>
      </div>
      <TileAnalysisResultSection {...props} />
      <TileAnalysisQuerySection {...props} />
    </>
  ) : (
    <div className="inspector-story-card quiet">
      <span>Data context</span>
      <strong>No analytical tile selected</strong>
      <small>Select a chart or table to review query, source, result, and live-provider context.</small>
    </div>
  );
  const insightSurface = (
    <>
      <div className="inspector-story-card">
        <span>Story context</span>
        <strong>{inspectorFocus.title}</strong>
        <small>{inspectorFocus.helper}</small>
      </div>
      {selectedTile ? (
        <>
          <div className="inspector-story-card quiet">
            <span>Interpretation cues</span>
            <strong>{selectedTile.result.statistics.significance.status === "tested" ? "Tested comparisons available" : "Review analytical context"}</strong>
            <small>{selectedTile.result.statistics.significance.comparisonBasis} basis · {Math.round(selectedTile.result.statistics.confidenceLevel * 100)}% confidence</small>
            <div className="inspector-context-chips">
              <span>{selectedTile.result.weighting.applied ? "Weighted" : "Unweighted"}</span>
              <span>{selectedTile.result.statistics.significance.method}</span>
            </div>
          </div>
          {(insightWarnings.length > 0 || insightNotes.length > 0) && (
            <div className="inspector-story-card quiet">
              <span>Result notes</span>
              <strong>{insightWarnings.length > 0 ? `${insightWarnings.length} warning${insightWarnings.length === 1 ? "" : "s"}` : "No provider warnings"}</strong>
              {[...insightWarnings, ...insightNotes].slice(0, 4).map((note) => (
                <small key={note}>{note}</small>
              ))}
            </div>
          )}
          <button type="button" className="menu-card" onClick={() => {
            setInspectorSurface("style");
            setSettingsView("container");
          }}>
            <strong>Open provenance and lifecycle</strong>
            <span>Review saved settings, derived-output, template, and segment context.</span>
          </button>
        </>
      ) : (
        <div className="inspector-story-card quiet">
          <span>Insight surface</span>
          <strong>Select an analytical tile</strong>
          <small>Tile notes, warnings, provenance, and story handoff cues will appear here.</small>
        </div>
      )}
    </>
  );

  return (
<BuilderPanel className="panel settings story-inspector" label="Design and insight inspector">
          <div className="assistant-side-rail" aria-label="Assistant tools">
            {[
              ["templates", "Templates"],
              ["themes", "Themes"],
              ["layout", "Layout"],
              ["widgets", "Widgets"],
              ["text", "Text"],
              ["images", "Images"],
              ["elements", "Elements"],
              ["data", "Data"]
            ].map(([icon, label], index) => (
              <button type="button" className={index === 0 ? "active" : ""} key={label}>
                <AssistantIcon icon={icon as AssistantRailIcon} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="inspector-shell-title">
            <h2><span aria-hidden="true">✣</span> Design + Insight Assistant</h2>
          </div>
          <div className="inspector-surface-tabs" role="tablist" aria-label="Inspector surfaces">
            <button type="button" role="tab" aria-selected={inspectorSurface === "style"} className={inspectorSurface === "style" ? "active" : ""} onClick={() => setInspectorSurface("style")}>Style</button>
            <button type="button" role="tab" aria-selected={inspectorSurface === "data"} className={inspectorSurface === "data" ? "active" : ""} onClick={() => setInspectorSurface("data")}>Data</button>
            <button type="button" role="tab" aria-selected={inspectorSurface === "insight"} className={inspectorSurface === "insight" ? "active" : ""} onClick={() => setInspectorSurface("insight")}>Insight</button>
          </div>
          {inspectorSurface === "style" && styleSurface}
          {inspectorSurface === "data" && dataSurface}
          {inspectorSurface === "insight" && insightSurface}
        </BuilderPanel>
  );
}
