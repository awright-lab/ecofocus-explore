import { BuilderPanel } from "./BuilderChrome";
import { DataExplorerPanel } from "./DataExplorerPanel";
import { ReportPageTree } from "./ReportPageTree";
import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  defaultQuestion,
  filterDimensions
} from "../builderConstants";
import { defaultVariableSetRows, rowKindLabel } from "../../document/documentSeeds";
import { defaultVisualizationForQuestion, getChartTypeLabel } from "../../analytics/analyticsDisplay";
import { gradientCss } from "../builderHelpers";
import { buildInsertionContextView } from "./insertionContextModel";
import type { BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, DesignColorPalette, PageTemplatePreset, PageThemePreset, SavedAnalyticalTemplate, SavedBanner, SavedFilterSet, SavedVariableSet, SavedWeightProfile, TextBlockPreset, TextStylePreset } from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, ExploreView, LayerItem, LeftPanelView, MultiSelectedObject, ReportTreeSelectionCue, SavedLibraryHandoff, SavedLibraryInsertionCue, SourceLibraryView } from "../builderTypes";

export type AnalysisAuthoringPanelProps = {
  leftPanelView: LeftPanelView;
  setLeftPanelView: (view: LeftPanelView) => void;
  layerItems: LayerItem[];
  selectedTileId: string | null;
  selectedElementId: string | null;
  multiSelectedObjects: MultiSelectedObject[];
  toggleMultiSelectedObject: (item: MultiSelectedObject) => void;
  clearMultiSelection: () => void;
  chooseLayer: (item: LayerItem) => void;
  selectTile: (tileId: string) => void;
  selectElement: (elementId: string) => void;
  recordReportTreeSelectionCue: (cue: Omit<NonNullable<ReportTreeSelectionCue>, "createdAt">) => void;
  recordSavedLibraryInsertionCue: (cue: Omit<NonNullable<SavedLibraryInsertionCue>, "createdAt">) => void;
  updateTile: (tileId: string, updates: Partial<DashboardTile>) => void;
  updateElement: (elementId: string, updates: Partial<DashboardCanvasElement>) => void;
  sortedPages: DashboardPage[];
  activePage: DashboardPage;
  setActivePageId: (pageId: string) => void;
  selectPage: () => void;
  renamePage: (pageId: string, title: string) => void;
  addPage: (template?: PageTemplatePreset) => void;
  duplicateActivePage: () => void;
  duplicatePageById: (pageId: string) => void;
  deleteActivePage: () => void;
  deletePageById: (pageId: string) => void;
  movePage: (pageId: string, direction: "up" | "down") => void;
  pageTemplates: PageTemplatePreset[];
  pageThemes: PageThemePreset[];
  selectedTextElement: DashboardCanvasElement | null;
  selectedTile: DashboardTile | null;
  focusSelectedTileInspector: () => void;
  recordSavedSettingOriginCue: (kind: "banner" | "filter" | "weight", label: string, tileId: string) => void;
  designPalettes: DesignColorPalette[];
  applyPaletteToTile: (palette: DesignColorPalette, scope?: "selected" | "all") => void;
  textStylePresets: TextStylePreset[];
  applyTextStylePresetToSelection: (preset: TextStylePreset) => void;
  textBlockPresets: TextBlockPreset[];
  addTextBlockPreset: (block: TextBlockPreset) => void;
  applyPageTheme: (theme: PageThemePreset) => void;
  exploreView: ExploreView;
  setExploreView: (view: ExploreView) => void;
  sourceLibraryView: SourceLibraryView;
  setSourceLibraryView: (view: SourceLibraryView) => void;
  analysisLibraryView: AnalysisLibraryView;
  setAnalysisLibraryView: (view: AnalysisLibraryView) => void;
  savedLibraryHandoff: SavedLibraryHandoff;
  sourceSearch: string;
  setSourceSearch: (value: string) => void;
  filteredVariableSets: SavedVariableSet[];
  filteredQuestions: typeof defaultDataset.questions;
  selectedDataSource: { kind: "question" | "variableSet"; id: string };
  applyVariableSetSelection: (variableSet: SavedVariableSet) => void;
  applyQuestionSelection: (question: typeof defaultDataset.questions[number]) => void;
  startDataSourceDrag: (source: { kind: "question" | "variableSet"; id: string }, event: React.DragEvent<HTMLElement>) => void;
  selectedVariableSet: SavedVariableSet | null;
  question: QuestionId;
  setQuestion: (questionId: QuestionId) => void;
  variableSetDraftName: string;
  setVariableSetDraftName: (value: string) => void;
  variableSetDescription: string;
  setVariableSetDescription: (value: string) => void;
  variableSetQuestionIds: QuestionId[];
  toggleVariableSetQuestion: (questionId: QuestionId) => void;
  selectedQuestion: typeof defaultDataset.questions[number];
  resetVariableSetRows: () => void;
  revealAllVariableSetRows: () => void;
  markVariableSetRowsAsDetails: () => void;
  variableSetRows: SavedVariableSet["rows"];
  variableSetOptionSelection: string[];
  toggleVariableSetOptionRow: (optionId: string, label: string) => void;
  toggleVariableSetOptionSelection: (optionId: string) => void;
  addVariableSetNet: (kind: "net" | "top" | "bottom") => void;
  addRowsForUncoveredOptions: () => void;
  updateVariableSetRow: (rowId: string, updates: Partial<SavedVariableSet["rows"][number]>) => void;
  reorderVariableSetRow: (rowId: string, direction: "up" | "down") => void;
  removeVariableSetRow: (rowId: string) => void;
  saveCurrentVariableSet: (createNew?: boolean) => void;
  deleteVariableSet: (variableSetId: string) => void;
  savedBanners: SavedBanner[];
  savedFilters: SavedFilterSet[];
  savedWeights: SavedWeightProfile[];
  savedAnalyticalTemplates: SavedAnalyticalTemplate[];
  savedVariableSets: SavedVariableSet[];
  breakBy: BreakById;
  setBreakBy: (breakBy: BreakById) => void;
  metric: Metric;
  setMetric: (metric: Metric) => void;
  chartType: ChartType;
  setChartType: (chartType: ChartType) => void;
  weight: WeightId | null;
  setWeight: (weight: WeightId | null) => void;
  filterField: FilterFieldId | null;
  setFilterField: (field: FilterFieldId | null) => void;
  filterValue: string;
  setFilterValue: (value: string) => void;
  comparisonMode: ComparisonMode;
  setComparisonMode: (mode: ComparisonMode) => void;
  comparisonDatasets: DatasetId[];
  toggleComparisonDataset: (datasetId: DatasetId) => void;
  selectedFilterDimension?: typeof filterDimensions[number];
  selectedChartTypes: ChartType[];
  query: import("../../../../shared/types/analytics").AnalyticsQueryRequest;
  setComparisonDatasets: React.Dispatch<React.SetStateAction<DatasetId[]>>;
  setVariableSetRows: React.Dispatch<React.SetStateAction<SavedVariableSet["rows"]>>;
  setVariableSetOptionSelection: React.Dispatch<React.SetStateAction<string[]>>;
  addCanvasElement: (type: DashboardCanvasElement["type"]) => void;
  addTileFromQuery: () => void;
  addTileFromSourceWithVisualization: (chartType: ChartType) => Promise<string | null>;
  addTileFromVariableSet: (variableSet: SavedVariableSet, chartType: ChartType) => Promise<string | null>;
  addTileFromAnalyticalTemplate: (template: SavedAnalyticalTemplate) => Promise<string | null>;
  isLoading: boolean;
  applySavedBanner: (banner: SavedBanner) => void;
  bannerDraftName: string;
  setBannerDraftName: (value: string) => void;
  saveCurrentBanner: () => void;
  applySavedFilter: (filter: SavedFilterSet) => void;
  filterDraftName: string;
  setFilterDraftName: (value: string) => void;
  saveCurrentFilter: () => void;
  applySavedWeight: (weight: SavedWeightProfile) => void;
  weightDraftName: string;
  setWeightDraftName: (value: string) => void;
  saveCurrentWeight: () => void;
  error: string | null;
};

export function AnalysisAuthoringPanel(props: AnalysisAuthoringPanelProps) {
  const {
  leftPanelView,
  setLeftPanelView,
  layerItems,
  selectedTileId,
  selectedElementId,
  multiSelectedObjects,
  toggleMultiSelectedObject,
  clearMultiSelection,
  chooseLayer,
  selectTile,
  selectElement,
  recordReportTreeSelectionCue,
  recordSavedLibraryInsertionCue,
  updateTile,
  updateElement,
  sortedPages,
  activePage,
  setActivePageId,
  selectPage,
  renamePage,
  addPage,
  duplicateActivePage,
  duplicatePageById,
  deleteActivePage,
  deletePageById,
  movePage,
  pageTemplates,
  pageThemes,
  selectedTextElement,
  selectedTile,
  designPalettes,
  applyPaletteToTile,
  textStylePresets,
  applyTextStylePresetToSelection,
  textBlockPresets,
  addTextBlockPreset,
  applyPageTheme,
  exploreView,
  setExploreView,
  sourceLibraryView,
  setSourceLibraryView,
  analysisLibraryView,
  setAnalysisLibraryView,
  savedLibraryHandoff,
  sourceSearch,
  setSourceSearch,
  filteredVariableSets,
  filteredQuestions,
  selectedDataSource,
  applyVariableSetSelection,
  applyQuestionSelection,
  startDataSourceDrag,
  selectedVariableSet,
  question,
  setQuestion,
  variableSetDraftName,
  setVariableSetDraftName,
  variableSetDescription,
  setVariableSetDescription,
  variableSetQuestionIds,
  toggleVariableSetQuestion,
  selectedQuestion,
  resetVariableSetRows,
  revealAllVariableSetRows,
  markVariableSetRowsAsDetails,
  variableSetRows,
  variableSetOptionSelection,
  toggleVariableSetOptionRow,
  toggleVariableSetOptionSelection,
  addVariableSetNet,
  addRowsForUncoveredOptions,
  updateVariableSetRow,
  reorderVariableSetRow,
  removeVariableSetRow,
  saveCurrentVariableSet,
  deleteVariableSet,
  savedBanners,
  savedFilters,
  savedWeights,
  breakBy,
  setBreakBy,
  metric,
  setMetric,
  chartType,
  setChartType,
  weight,
  setWeight,
  filterField,
  setFilterField,
  filterValue,
  setFilterValue,
  comparisonMode,
  setComparisonMode,
  comparisonDatasets,
  setComparisonDatasets,
  toggleComparisonDataset,
  selectedFilterDimension,
  selectedChartTypes,
  setVariableSetRows,
  setVariableSetOptionSelection,
  addCanvasElement,
  addTileFromQuery,
  addTileFromSourceWithVisualization,
  addTileFromVariableSet,
  isLoading,
  applySavedBanner,
  bannerDraftName,
  setBannerDraftName,
  saveCurrentBanner,
  applySavedFilter,
  filterDraftName,
  setFilterDraftName,
  saveCurrentFilter,
  applySavedWeight,
  weightDraftName,
  setWeightDraftName,
  saveCurrentWeight,
  error
  } = props;
  const insertionContext = buildInsertionContextView({ activePage, layerItems, selectedTileId, selectedElementId });

  return (
<BuilderPanel className="panel controls" label="Data controls">
          {leftPanelView === "layers" ? (
            <>
              <div className="panel-title with-action">
                <h2>Layers</h2>
                <button type="button" className="mini-button" onClick={() => setLeftPanelView("pages")}>Close</button>
              </div>
              <div className="layers-list expanded">
                {layerItems.length === 0 ? (
                  <div className="empty-state compact">No layers yet.</div>
                ) : (
                  layerItems.map((item) => (
                    <div
                      className={(item.type === "tile" && item.id === selectedTileId) || (item.type === "element" && item.id === selectedElementId) ? "layer-row active" : "layer-row"}
                      key={`${item.type}-${item.id}`}
                    >
                      <button type="button" className="layer-name" onClick={() => chooseLayer(item)}>
                        <span>{item.type === "tile" ? "Chart" : "Item"}</span>
                        {item.name}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => (item.type === "tile" ? updateTile(item.id, { hidden: !item.hidden }) : updateElement(item.id, { hidden: !item.hidden }))}
                      >
                        {item.hidden ? "Show" : "Hide"}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => (item.type === "tile" ? updateTile(item.id, { locked: !item.locked }) : updateElement(item.id, { locked: !item.locked }))}
                      >
                        {item.locked ? "Unlock" : "Lock"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {leftPanelView === "pages" && (
                <ReportPageTree
                  sortedPages={sortedPages}
                  activePage={activePage}
                  selectedTileId={selectedTileId}
                  selectedElementId={selectedElementId}
                  multiSelectedObjects={multiSelectedObjects}
                  toggleMultiSelectedObject={toggleMultiSelectedObject}
                  clearMultiSelection={clearMultiSelection}
                  pageTemplates={pageTemplates}
                  pageThemes={pageThemes}
                  setActivePageId={setActivePageId}
                  selectPage={selectPage}
                  selectTile={selectTile}
                  selectElement={selectElement}
                  recordReportTreeSelectionCue={recordReportTreeSelectionCue}
                  updateTile={updateTile}
                  updateElement={updateElement}
                  renamePage={renamePage}
                  addPage={addPage}
                  duplicateActivePage={duplicateActivePage}
                  duplicatePageById={duplicatePageById}
                  deleteActivePage={deleteActivePage}
                  deletePageById={deletePageById}
                  movePage={movePage}
                />
              )}

              {leftPanelView === "insert" && (
                <>
              <div className="panel-title">
                <h2>Insert</h2>
              </div>
              <div className="insertion-context-card">
                <div className="insertion-context-card__header">
                  <span>Insertion target</span>
                  <strong>{insertionContext.targetPageLabel}</strong>
                </div>
                <div className="insertion-context-grid">
                  <div>
                    <span>Selection</span>
                    <strong>{insertionContext.selectedObjectLabel}</strong>
                  </div>
                  <div>
                    <span>Placement</span>
                    <strong>{insertionContext.placementLabel}</strong>
                  </div>
                </div>
                <small>{insertionContext.helperText}</small>
              </div>
              <div className="insert-grid">
                <button type="button" className="secondary" onClick={() => addCanvasElement("text")}>Text</button>
                <button type="button" className="secondary" onClick={() => addCanvasElement("rectangle")}>Rectangle</button>
                <button type="button" className="secondary" onClick={() => addCanvasElement("circle")}>Circle</button>
                <button type="button" className="secondary" onClick={() => addCanvasElement("image")}>Image</button>
              </div>
              </>
              )}

              {leftPanelView === "brand" && (
                <>
              <div className="panel-title">
                <h2>Brand</h2>
              </div>
              <div className="brand-panel">
                <div className="color-summary-card">
                  <div>
                    <span>Design library</span>
                    <strong>EcoFocus system</strong>
                  </div>
                  <small>Reusable palettes, typography presets, and page themes for faster report building.</small>
                </div>
                <div className="brand-context-card">
                  <span>Current focus</span>
                  <strong>
                    {selectedTextElement
                      ? "Selected text block"
                      : selectedTile
                      ? selectedTile.title
                      : "Active page"}
                  </strong>
                  <small>
                    {selectedTextElement
                      ? "Apply text styles directly to the selected text element."
                      : selectedTile
                      ? "Apply a palette to the selected chart tile or across all chart tiles."
                      : "Apply page themes to the active canvas while you build."}
                  </small>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Palettes</strong>
                    <small>{designPalettes.length} saved</small>
                  </div>
                  <div className="brand-palette-list">
                    {designPalettes.map((palette) => (
                      <div key={palette.id} className="brand-palette-card">
                        <div className="brand-palette-header">
                          <div>
                            <strong>{palette.label}</strong>
                            <small>{palette.description}</small>
                          </div>
                          <div className="brand-swatch-row">
                            {palette.colors.map((color) => (
                              <span key={color} className="brand-swatch" style={{ background: color }} />
                            ))}
                          </div>
                        </div>
                        <div className="brand-card-actions">
                          <button type="button" className="secondary" onClick={() => applyPaletteToTile(palette, "selected")} disabled={!selectedTile}>
                            Apply to tile
                          </button>
                          <button type="button" className="secondary" onClick={() => applyPaletteToTile(palette, "all")}>
                            Apply to all charts
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Text styles</strong>
                    <small>{textStylePresets.length} presets</small>
                  </div>
                  <div className="brand-style-list">
                    {textStylePresets.map((preset) => (
                      <button type="button" key={preset.id} className="brand-text-style-card" onClick={() => applyTextStylePresetToSelection(preset)} disabled={!selectedTextElement}>
                        <span>{preset.label}</span>
                        <strong
                          style={{
                            fontFamily: preset.fontFamily,
                            fontSize: Math.min(preset.fontSize, 22),
                            fontWeight: preset.fontWeight,
                            color: preset.textColor,
                            textAlign: preset.textAlign
                          }}
                        >
                          EcoFocus
                        </strong>
                        <small>{preset.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Content blocks</strong>
                    <small>{textBlockPresets.length} ready to place</small>
                  </div>
                  <div className="brand-block-list">
                    {textBlockPresets.map((block) => (
                      <button type="button" key={block.id} className="brand-block-card" onClick={() => addTextBlockPreset(block)}>
                        <div className="brand-block-card__header">
                          <strong>{block.label}</strong>
                          <small>{block.description}</small>
                        </div>
                        <p>{block.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Page themes</strong>
                    <small>{pageThemes.length} saved</small>
                  </div>
                  <div className="brand-theme-list">
                    {pageThemes.map((theme) => (
                      <button type="button" key={theme.id} className="brand-theme-card" onClick={() => applyPageTheme(theme)}>
                        <span
                          className="brand-theme-preview"
                          style={{
                            background:
                              theme.backgroundMode === "gradient"
                                ? gradientCss(theme.gradientFrom, theme.gradientTo, theme.gradientStops, theme.gradientType, `${theme.gradientAngle}deg`)
                                : theme.background
                          }}
                        />
                        <div>
                          <strong>{theme.label}</strong>
                          <small>{theme.description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              </>
              )}

              <DataExplorerPanel {...props} />
              {error && <div className="error">{error}</div>}
              </>
              )}
        </BuilderPanel>
  );
}
