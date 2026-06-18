import { BuilderPanel } from "./BuilderChrome";
import { LayoutInspector, ObjectInspector, PageInspector } from "./InspectorSections";
import { buildMultiSelectionSummary } from "./multiSelectionModel";
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
import { getChartTypeLabel, getCompatibleChartTypes, getQuestionLabel } from "../../analytics/analyticsDisplay";
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
  SavedFilterSet,
  SavedWeightProfile,
  TextStylePreset,
  TileAppearance
} from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, DesignModal, MultiSelectedObject, RelatedObjectNavigationCue, ReportTreeSelectionCue, SavedLibraryInsertionCue, SavedSettingOriginCue, SettingsView } from "../builderTypes";

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
  alignMultiSelected: (edge: "left" | "top") => void;
  clearMultiSelection: () => void;
  savedBanners: SavedBanner[];
  savedFilters: SavedFilterSet[];
  savedWeights: SavedWeightProfile[];
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
  rerunTileAnalysis: (tile: DashboardTile, nextQuery: import("../../../../shared/types/analytics").AnalyticsQueryRequest) => Promise<boolean>;
  saveSelectedTileVariableSet: () => void;
  saveSelectedTileBanner: () => void;
  saveSelectedTileFilter: () => void;
  saveSelectedTileWeight: () => void;
  onViewSavedSettingInLibrary: (view: AnalysisLibraryView) => void;
  savedSettingOriginCue: SavedSettingOriginCue;
  recordSavedSettingOriginCue: (kind: "banner" | "filter" | "weight", label: string, tileId: string) => void;
  completeSavedSettingOriginCue: (tileId: string) => void;
  relatedObjectNavigationCue: RelatedObjectNavigationCue;
  recordRelatedObjectNavigationCue: (cue: Omit<NonNullable<RelatedObjectNavigationCue>, "createdAt">) => void;
  reportTreeSelectionCue: ReportTreeSelectionCue;
  savedLibraryInsertionCue: SavedLibraryInsertionCue;
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
  isLoading
  } = props;
  const multiSelectionSummary = buildMultiSelectionSummary(activePage, multiSelectedObjects);

  return (
<BuilderPanel className="panel settings" label="Tile settings">
          <div className="panel-title">
            <h2>Settings</h2>
          </div>
          {multiSelectionSummary.count > 0 && (
            <div className="multi-selection-card">
              <div className="explorer-section-header">
                <strong>{multiSelectionSummary.count} selected</strong>
                <small>{multiSelectionSummary.tiles.length} tiles · {multiSelectionSummary.elements.length} elements</small>
              </div>
              {multiSelectionSummary.bounds && (
                <div className="multi-selection-bounds" aria-label="Selection bounds">
                  <div>
                    <span>X/Y</span>
                    <strong>{multiSelectionSummary.bounds.x}, {multiSelectionSummary.bounds.y}</strong>
                  </div>
                  <div>
                    <span>Size</span>
                    <strong>{multiSelectionSummary.bounds.width}x{multiSelectionSummary.bounds.height}</strong>
                  </div>
                  <small>{multiSelectionSummary.spreadLabel}</small>
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
              <div className="brand-card-actions">
                <button type="button" className="secondary" onClick={() => setMultiSelectedHidden(true)}>Hide</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedHidden(false)}>Show</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedLocked(true)}>Lock</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedLocked(false)}>Unlock</button>
              </div>
              <div className="brand-card-actions">
                <button type="button" className="secondary" onClick={() => alignMultiSelected("left")} disabled={multiSelectionSummary.count < 2}>Align left</button>
                <button type="button" className="secondary" onClick={() => alignMultiSelected("top")} disabled={multiSelectionSummary.count < 2}>Align top</button>
              </div>
              <button type="button" className="secondary" onClick={clearMultiSelection}>Clear selection</button>
            </div>
          )}
          {settingsView === "home" ? (
            <div className="settings-menu">
              <button type="button" className="menu-card" onClick={() => setSettingsView("page")}>
                <strong>Page</strong>
                <span>Title, grid, snap, and background</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView("layout")} disabled={!selectedTile && !selectedElement}>
                <strong>Arrange</strong>
                <span>Layer order, alignment, size, and position</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView(selectedElement ? "element" : "chart")} disabled={!selectedTile && !selectedElement}>
                <strong>{selectedElement ? "Element" : "Tile"}</strong>
                <span>{selectedElement ? "Shape, image, and text styling" : "Chart design and visualization"}</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView("container")} disabled={!selectedTile}>
                <strong>Container</strong>
                <span>Tile background, borders, and notes</span>
              </button>
            </div>
          ) : (
            <>
              <div className="panel-title with-action">
                <h2>{settingsView === "page" ? "Page" : settingsView === "layout" ? "Arrange" : settingsView === "container" ? "Container" : selectedElement ? "Element" : "Chart"}</h2>
                <button type="button" className="mini-button" onClick={() => setSettingsView("home")}>Back</button>
              </div>
          <PageInspector {...props} />
          <LayoutInspector {...props} />
          <ObjectInspector {...props} />
            </>
          )}
        </BuilderPanel>
  );
}
