import { BuilderPanel } from "./BuilderChrome";
import { LayoutInspector, ObjectInspector, PageInspector } from "./InspectorSections";
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
  SavedBanner,
  SavedFilterSet,
  SavedWeightProfile,
  TextStylePreset,
  TileAppearance
} from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, DesignModal, SavedSettingOriginCue, SettingsView } from "../builderTypes";

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
  setDesignModal: (modal: DesignModal) => void;
  changeSelectedLayer: (direction: "front" | "back" | "forward" | "backward") => void;
  alignSelected: (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  applyLayoutPreset: (preset: "hero" | "leftColumn" | "rightColumn" | "footer") => void;
  updateSelectedLayout: (layout: Partial<CanvasLayout>) => void;
  updateSelectedElement: (updates: Partial<DashboardCanvasElement>) => void;
  updateSelectedTile: (updates: Partial<DashboardTile>) => void;
  updateSelectedAppearance: (updates: Partial<TileAppearance>) => void;
  updateSelectedBarStyle: (updates: Partial<TileAppearance["barStyles"][string]>) => void;
  updateSelectedAxisLabel: (value: string) => void;
  applyTextStylePresetToSelection: (preset: TextStylePreset) => void;
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
  completeSavedSettingOriginCue: (tileId: string) => void;
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
  selectedTileQuestion,
  selectedTileFilterDimension,
  selectedChartPart,
  selectedChartPartId,
  setSelectedChartPartId,
  chartStyleTargets,
  textStylePresets,
  designPalettes,
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
  return (
<BuilderPanel className="panel settings" label="Tile settings">
          <div className="panel-title">
            <h2>Settings</h2>
          </div>
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
