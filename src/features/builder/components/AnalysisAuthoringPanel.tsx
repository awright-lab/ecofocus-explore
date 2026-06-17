import { BuilderPanel } from "./BuilderChrome";
import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  defaultQuestion,
  filterDimensions
} from "../builderConstants";
import { defaultVariableSetRows, rowKindLabel } from "../../document/documentSeeds";
import { defaultVisualizationForQuestion, getChartTypeLabel } from "../../analytics/analyticsDisplay";
import { gradientCss, themePreviewBackground } from "../builderHelpers";
import type { BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, DesignColorPalette, PageTemplatePreset, PageThemePreset, SavedBanner, SavedFilterSet, SavedVariableSet, SavedWeightProfile, TextBlockPreset, TextStylePreset } from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, ExploreView, LayerItem, LeftPanelView, SourceLibraryView } from "../builderTypes";

export type AnalysisAuthoringPanelProps = {
  leftPanelView: LeftPanelView;
  setLeftPanelView: (view: LeftPanelView) => void;
  layerItems: LayerItem[];
  selectedTileId: string | null;
  selectedElementId: string | null;
  chooseLayer: (item: LayerItem) => void;
  updateTile: (tileId: string, updates: Partial<DashboardTile>) => void;
  updateElement: (elementId: string, updates: Partial<DashboardCanvasElement>) => void;
  sortedPages: DashboardPage[];
  activePage: DashboardPage;
  setActivePageId: (pageId: string) => void;
  selectPage: () => void;
  addPage: (template?: PageTemplatePreset) => void;
  duplicateActivePage: () => void;
  pageTemplates: PageTemplatePreset[];
  pageThemes: PageThemePreset[];
  selectedTextElement: DashboardCanvasElement | null;
  selectedTile: DashboardTile | null;
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
  updateVariableSetRow: (rowId: string, updates: Partial<SavedVariableSet["rows"][number]>) => void;
  reorderVariableSetRow: (rowId: string, direction: "up" | "down") => void;
  removeVariableSetRow: (rowId: string) => void;
  saveCurrentVariableSet: (createNew?: boolean) => void;
  deleteVariableSet: (variableSetId: string) => void;
  savedBanners: SavedBanner[];
  savedFilters: SavedFilterSet[];
  savedWeights: SavedWeightProfile[];
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
  setComparisonDatasets: React.Dispatch<React.SetStateAction<DatasetId[]>>;
  setVariableSetRows: React.Dispatch<React.SetStateAction<SavedVariableSet["rows"]>>;
  setVariableSetOptionSelection: React.Dispatch<React.SetStateAction<string[]>>;
  addCanvasElement: (type: DashboardCanvasElement["type"]) => void;
  addTileFromQuery: () => void;
  addTileFromSourceWithVisualization: (chartType: ChartType) => void;
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

export function AnalysisAuthoringPanel({
  leftPanelView,
  setLeftPanelView,
  layerItems,
  selectedTileId,
  selectedElementId,
  chooseLayer,
  updateTile,
  updateElement,
  sortedPages,
  activePage,
  setActivePageId,
  selectPage,
  addPage,
  duplicateActivePage,
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
}: AnalysisAuthoringPanelProps) {
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
                <>
              <div className="panel-title">
                <h2>Pages</h2>
              </div>
              <div className="page-list">
                {sortedPages.map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    className={page.id === activePage.id ? "page-tab active" : "page-tab"}
                    onClick={() => {
                      setActivePageId(page.id);
                      selectPage();
                    }}
                  >
                    <span>{page.order}</span>
                    {page.title}
                  </button>
                ))}
              </div>
              <div className="brand-card-actions">
                <button type="button" className="secondary" onClick={() => addPage()}>
                New page
                </button>
                <button type="button" className="secondary" onClick={duplicateActivePage}>
                  Duplicate page
                </button>
              </div>
              <div className="explorer-section-card">
                <div className="explorer-section-header">
                  <strong>Page templates</strong>
                  <small>{pageTemplates.length} ready to use</small>
                </div>
                <div className="brand-theme-list">
                  {pageTemplates.map((template) => (
                    <button type="button" key={template.id} className="brand-theme-card" onClick={() => addPage(template)}>
                      <span
                        className="brand-theme-preview"
                        style={{ background: themePreviewBackground(pageThemes.find((theme) => theme.id === template.pageThemeId)) }}
                      />
                      <div>
                        <strong>{template.label}</strong>
                        <small>{template.description}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              </>
              )}

              {leftPanelView === "insert" && (
                <>
              <div className="panel-title">
                <h2>Insert</h2>
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

              {leftPanelView === "data" && (
                <>
              <div className="panel-title">
                <h2>Explore</h2>
              </div>
              <div className="data-explorer">
                <div className="color-summary-card">
                  <div>
                    <span>Dataset</span>
                    <strong>{defaultDataset.label}</strong>
                  </div>
                  <small>{defaultDataset.description}</small>
                </div>
                <div className="explore-flow-tabs">
                  <button type="button" className={exploreView === "source" ? "active" : ""} onClick={() => setExploreView("source")}>
                    1. Source
                  </button>
                  <button type="button" className={exploreView === "analyze" ? "active" : ""} onClick={() => setExploreView("analyze")}>
                    2. Analyze
                  </button>
                  <button type="button" className={exploreView === "library" ? "active" : ""} onClick={() => setExploreView("library")}>
                    3. Library
                  </button>
                </div>
                <div className="explore-step-card">
                  {exploreView === "source" && (
                    <>
                      <div>
                        <span>Step 1</span>
                        <strong>Choose a source</strong>
                      </div>
                      <small>Pick a saved variable set or question. You can click to load it or drag it straight onto the canvas.</small>
                    </>
                  )}
                  {exploreView === "analyze" && (
                    <>
                      <div>
                        <span>Step 2</span>
                        <strong>Shape the analysis</strong>
                      </div>
                      <small>Adjust banner, metric, weight, filter, and chart type for the currently selected source before adding a tile.</small>
                    </>
                  )}
                  {exploreView === "library" && (
                    <>
                      <div>
                        <span>Step 3</span>
                        <strong>Save reusable objects</strong>
                      </div>
                      <small>Turn the current setup into reusable variable sets, banners, filters, or weights for faster reporting.</small>
                    </>
                  )}
                </div>

                {exploreView === "source" && (
                  <>
                    <div className="color-summary-card compact">
                      <div>
                        <span>Current source</span>
                        <strong>{selectedVariableSet ? selectedVariableSet.label : selectedQuestion.shortLabel}</strong>
                      </div>
                      <small>{selectedVariableSet ? selectedVariableSet.description : selectedQuestion.topic}</small>
                    </div>
                    <label>
                      Search sources
                      <input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Search questions or variable sets" />
                    </label>
                    <div className="explore-subtabs">
                      <button type="button" className={sourceLibraryView === "variableSets" ? "active" : ""} onClick={() => setSourceLibraryView("variableSets")}>
                        Variable sets
                      </button>
                      <button type="button" className={sourceLibraryView === "questions" ? "active" : ""} onClick={() => setSourceLibraryView("questions")}>
                        Questions
                      </button>
                    </div>
                    {sourceLibraryView === "variableSets" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Variable sets</strong>
                        <small>{filteredVariableSets.length} shown</small>
                      </div>
                      <div className="explorer-item-list">
                        {filteredVariableSets.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            draggable
                            className={selectedDataSource.kind === "variableSet" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                            onClick={() => applyVariableSetSelection(item)}
                            onDragStart={(event) => startDataSourceDrag({ kind: "variableSet", id: item.id }, event)}
                          >
                            <strong>{item.label}</strong>
                            <span>{item.topic} · Drag to canvas</span>
                          </button>
                        ))}
                        {filteredVariableSets.length === 0 && <div className="empty-state compact">No variable sets match that search.</div>}
                      </div>
                    </div>
                    )}
                    {sourceLibraryView === "questions" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Questions</strong>
                        <small>{filteredQuestions.length} shown</small>
                      </div>
                      <div className="explorer-item-list">
                        {filteredQuestions.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            draggable
                            className={selectedDataSource.kind === "question" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                            onClick={() => applyQuestionSelection(item)}
                            onDragStart={(event) => startDataSourceDrag({ kind: "question", id: item.id }, event)}
                          >
                            <strong>{item.shortLabel}</strong>
                            <span>{item.topic} · Drag to canvas</span>
                          </button>
                        ))}
                        {filteredQuestions.length === 0 && <div className="empty-state compact">No questions match that search.</div>}
                      </div>
                    </div>
                    )}
                  </>
                )}

                {exploreView === "analyze" && (
                  <>
                    <div className="explorer-section-card compact">
                      <div className="explorer-section-header">
                        <strong>Analysis summary</strong>
                        <small>Current setup</small>
                      </div>
                      <div className="explorer-chip-row">
                        <span className="explorer-chip">Banner: {bannerDimensions.find((item) => item.id === breakBy)?.label ?? breakBy}</span>
                        <span className="explorer-chip">
                          Compare: {comparisonMode === "wave"
                            ? comparisonDatasetOptions
                                .filter((dataset) => comparisonDatasets.includes(dataset.id))
                                .map((dataset) => dataset.wave)
                                .join(" vs ") || "Choose wave(s)"
                            : "None"}
                        </span>
                        <span className="explorer-chip">Metric: {defaultDataset.metrics.find((item) => item.id === metric)?.label ?? metric}</span>
                        <span className="explorer-chip">Weight: {weight ? defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight : "Unweighted"}</span>
                        <span className="explorer-chip">
                          Filter: {selectedFilterDimension && filterValue !== "all"
                            ? selectedFilterDimension.values.find((item) => item.id === filterValue)?.label ?? filterValue
                            : "None"}
                        </span>
                      </div>
                    </div>
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Analysis settings</strong>
                        <small>Current query</small>
                      </div>
                      <label>
                        Banner
                        <select value={breakBy} onChange={(event) => setBreakBy(event.target.value as BreakById)} disabled={comparisonMode === "wave"}>
                          {bannerDimensions
                            .filter((item) => selectedQuestion.allowedBreakBys.includes(item.id as BreakById))
                            .map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="compact-grid">
                        <label>
                          Cells
                          <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
                            {selectedQuestion.allowedMetrics.map((item) => (
                              <option value={item} key={item}>
                                {defaultDataset.metrics.find((metricItem) => metricItem.id === item)?.label ?? item}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Weight
                          <select value={weight ?? "none"} onChange={(event) => setWeight(event.target.value === "none" ? null : (event.target.value as WeightId))}>
                            <option value="none">Unweighted</option>
                            {defaultDataset.weights.map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="compact-grid">
                        <label>
                          Filter field
                          <select value={filterField ?? "none"} onChange={(event) => setFilterField(event.target.value === "none" ? null : (event.target.value as FilterFieldId))}>
                            <option value="none">No filter</option>
                            {filterDimensions.map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedFilterDimension ? (
                          <label>
                            Filter value
                            <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
                              <option value="all">All {selectedFilterDimension.label.toLowerCase()}s</option>
                              {selectedFilterDimension.values.map((item) => (
                                <option value={item.id} key={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <div className="explorer-meta-block">
                            <span>No filter selected</span>
                          </div>
                        )}
                      </div>
                      <div className="compact-grid">
                        <label>
                          Comparison
                          <select
                            value={comparisonMode}
                            onChange={(event) => {
                              const nextMode = event.target.value as ComparisonMode;
                              setComparisonMode(nextMode);
                              if (nextMode === "none") {
                                setComparisonDatasets([]);
                              }
                            }}
                          >
                            <option value="none">None</option>
                            <option value="wave">Wave comparison</option>
                          </select>
                        </label>
                        {comparisonMode === "wave" ? (
                          <div className="explorer-meta-block">
                            <span>Wave comparisons use Summary as the banner.</span>
                          </div>
                        ) : (
                          <div className="explorer-meta-block">
                            <span>Use comparisons to trend the same question across waves.</span>
                          </div>
                        )}
                      </div>
                      {comparisonMode === "wave" && (
                        <div className="explorer-section-card compact nested">
                          <div className="explorer-section-header">
                            <strong>Comparison waves</strong>
                            <small>Select one or more historical datasets</small>
                          </div>
                          <div className="explorer-chip-row comparison-chip-row">
                            {comparisonDatasetOptions.map((dataset) => (
                              <button
                                type="button"
                                key={dataset.id}
                                className={comparisonDatasets.includes(dataset.id) ? "explorer-chip-button active" : "explorer-chip-button secondary-chip"}
                                onClick={() => toggleComparisonDataset(dataset.id)}
                              >
                                {dataset.wave}
                              </button>
                            ))}
                          </div>
                          <small className="explorer-helper-copy">
                            Compare the active dataset against one or more prior waves using the same question and summary breakout.
                          </small>
                        </div>
                      )}
                      <label>
                        Output
                        <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
                          {selectedChartTypes.map((item) => (
                            <option value={item} key={item}>
                              {defaultDataset.chartTypes.find((chartItem) => chartItem.id === item)?.label ?? item}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="explorer-output-card">
                        <div className="explorer-section-header">
                          <strong>Create output</strong>
                          <small>Start with a table or place a chart directly</small>
                        </div>
                        <div className="explorer-output-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => addTileFromSourceWithVisualization("table")}
                            disabled={isLoading || !selectedChartTypes.includes("table")}
                          >
                            {isLoading && chartType === "table" ? "Adding..." : "Add table"}
                          </button>
                          <button
                            type="button"
                            onClick={() => addTileFromSourceWithVisualization(chartType === "table" ? (selectedChartTypes.find((item) => item !== "table") ?? "vertical_bar") : chartType)}
                            disabled={isLoading}
                          >
                            {isLoading && chartType !== "table" ? "Adding..." : `Add ${getChartTypeLabel(chartType === "table" ? (selectedChartTypes.find((item) => item !== "table") ?? "vertical_bar") : chartType)}`}
                          </button>
                        </div>
                        <small className="explorer-helper-copy">
                          Tables are the analytical starting point. You can convert them into charts after placement.
                        </small>
                      </div>
                    </div>
                  </>
                )}

                {exploreView === "library" && (
                  <>
                    <div className="explore-subtabs library">
                      <button type="button" className={analysisLibraryView === "variableSets" ? "active" : ""} onClick={() => setAnalysisLibraryView("variableSets")}>
                        Variable sets
                      </button>
                      <button type="button" className={analysisLibraryView === "banners" ? "active" : ""} onClick={() => setAnalysisLibraryView("banners")}>
                        Banners
                      </button>
                      <button type="button" className={analysisLibraryView === "filters" ? "active" : ""} onClick={() => setAnalysisLibraryView("filters")}>
                        Filters
                      </button>
                      <button type="button" className={analysisLibraryView === "weights" ? "active" : ""} onClick={() => setAnalysisLibraryView("weights")}>
                        Weights
                      </button>
                    </div>
                    {analysisLibraryView === "variableSets" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Variable set editor</strong>
                        <small>Save and update reusable sources</small>
                      </div>
                      <label>
                        Variable set name
                        <input value={variableSetDraftName} onChange={(event) => setVariableSetDraftName(event.target.value)} placeholder="Name this saved set" />
                      </label>
                      <label>
                        Description
                        <input value={variableSetDescription} onChange={(event) => setVariableSetDescription(event.target.value)} placeholder="Describe this variable set" />
                      </label>
                      <label>
                        Primary question
                        <select
                          value={question}
                          onChange={(event) => {
                            const nextQuestion = defaultDataset.questions.find((item) => item.id === event.target.value) ?? defaultQuestion;
                            setQuestion(nextQuestion.id);
                            setBreakBy(nextQuestion.allowedBreakBys[0]);
                            setMetric(nextQuestion.defaultMetric);
                            setChartType(defaultVisualizationForQuestion(nextQuestion));
                            setVariableSetRows(defaultVariableSetRows(nextQuestion.id));
                            setVariableSetOptionSelection([]);
                          }}
                        >
                          {variableSetQuestionIds.map((questionId) => {
                            const item = defaultDataset.questions.find((entry) => entry.id === questionId);
                            if (!item) return null;
                            return (
                              <option value={item.id} key={item.id}>
                                {item.shortLabel}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <div className="explorer-question-picker">
                        <span>Included questions</span>
                        <div className="explorer-question-list">
                          {defaultDataset.questions.map((item) => (
                            <label key={item.id} className={variableSetQuestionIds.includes(item.id) ? "explorer-question-option active" : "explorer-question-option"}>
                              <input
                                type="checkbox"
                                checked={variableSetQuestionIds.includes(item.id)}
                                onChange={() => toggleVariableSetQuestion(item.id)}
                              />
                              <div>
                                <strong>{item.shortLabel}</strong>
                                <span>{item.topic}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="explorer-section-card compact nested">
                        <div className="explorer-section-header">
                          <strong>Variable logic</strong>
                          <small>Author visible rows, nets, and boxes</small>
                        </div>
                        <div className="explorer-chip-row">
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={resetVariableSetRows}>
                            Reset rows
                          </button>
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={revealAllVariableSetRows}>
                            Reveal all
                          </button>
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={markVariableSetRowsAsDetails}>
                            Mark all detail
                          </button>
                        </div>
                        <div className="explorer-question-list compact">
                          {selectedQuestion.options.map((option) => {
                            const included = variableSetRows.some((row) => row.kind === "option" && row.sourceOptionIds[0] === option.id);
                            const selectedForNet = variableSetOptionSelection.includes(option.id);
                            return (
                              <label key={option.id} className={included || selectedForNet ? "explorer-question-option active" : "explorer-question-option"}>
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={() => toggleVariableSetOptionRow(option.id, option.label)}
                                />
                                <div>
                                  <strong>{option.label}</strong>
                                  <span>
                                    <button type="button" className={selectedForNet ? "mini-button active" : "mini-button"} onClick={() => toggleVariableSetOptionSelection(option.id)}>
                                      {selectedForNet ? "Selected for net" : "Select for net"}
                                    </button>
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="compact-grid">
                          <button type="button" className="secondary" onClick={() => addVariableSetNet("net")}>
                            Add net
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => addVariableSetNet("top")}
                            disabled={selectedQuestion.type !== "single_select"}
                          >
                            Add top 2 box
                          </button>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => addVariableSetNet("bottom")}
                          disabled={selectedQuestion.type !== "single_select"}
                        >
                          Add bottom 2 box
                        </button>
                        <div className="explorer-item-list compact">
                          {variableSetRows
                            .slice()
                            .sort((a, b) => a.rowOrder - b.rowOrder)
                            .map((row, index) => (
                              <div key={row.id} className="explorer-item active variable-set-row">
                                <div className="variable-set-row__top">
                                  <strong>{rowKindLabel(row.kind)}</strong>
                                  <span>{row.sourceOptionIds.join(", ")}</span>
                                </div>
                                <div className="explorer-chip-row variable-set-row__chips">
                                  <span className="explorer-chip">{row.emphasis === "summary" ? "Summary row" : "Detail row"}</span>
                                  <span className="explorer-chip">{row.visible ? "Visible" : "Hidden"}</span>
                                </div>
                                <input value={row.label} onChange={(event) => updateVariableSetRow(row.id, { label: event.target.value })} />
                                <div className="compact-grid">
                                  <label>
                                    Row style
                                    <select
                                      value={row.emphasis}
                                      onChange={(event) => updateVariableSetRow(row.id, { emphasis: event.target.value as "detail" | "summary" })}
                                    >
                                      <option value="detail">Detail</option>
                                      <option value="summary">Summary</option>
                                    </select>
                                  </label>
                                  <label>
                                    Visibility
                                    <select
                                      value={row.visible ? "visible" : "hidden"}
                                      onChange={(event) => updateVariableSetRow(row.id, { visible: event.target.value === "visible" })}
                                    >
                                      <option value="visible">Visible</option>
                                      <option value="hidden">Hidden</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="variable-set-row__actions">
                                  <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "up")} disabled={index === 0}>
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => reorderVariableSetRow(row.id, "down")}
                                    disabled={index === variableSetRows.length - 1}
                                  >
                                    Down
                                  </button>
                                  <button type="button" className="secondary" onClick={() => removeVariableSetRow(row.id)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="compact-grid">
                        <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(!selectedVariableSet)}>
                          {selectedVariableSet ? "Update set" : "Save set"}
                        </button>
                        <button type="button" className="secondary" disabled={!selectedVariableSet} onClick={() => selectedVariableSet && deleteVariableSet(selectedVariableSet.id)}>
                          Delete set
                        </button>
                      </div>
                    </div>
                    )}
                    {analysisLibraryView === "banners" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved banners</strong>
                        <small>{savedBanners.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedBanners.map((item) => (
                          <button type="button" key={item.id} className={item.breakBy === breakBy ? "explorer-item active" : "explorer-item"} onClick={() => applySavedBanner(item)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <div className="compact-grid">
                        <input value={bannerDraftName} onChange={(event) => setBannerDraftName(event.target.value)} placeholder="Save current banner" />
                        <button type="button" className="secondary" onClick={saveCurrentBanner}>Save banner</button>
                      </div>
                    </div>
                    )}
                    {analysisLibraryView === "filters" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved filters</strong>
                        <small>{savedFilters.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedFilters.map((item) => (
                          <button type="button" key={item.id} className={item.filterField === filterField && item.filterValue === filterValue ? "explorer-item active" : "explorer-item"} onClick={() => applySavedFilter(item)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <div className="compact-grid">
                        <input value={filterDraftName} onChange={(event) => setFilterDraftName(event.target.value)} placeholder="Save current filter" />
                        <button type="button" className="secondary" onClick={saveCurrentFilter}>Save filter</button>
                      </div>
                    </div>
                    )}
                    {analysisLibraryView === "weights" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved weights</strong>
                        <small>{savedWeights.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedWeights.map((item) => (
                          <button type="button" key={item.id} className={item.weight === weight ? "explorer-item active" : "explorer-item"} onClick={() => applySavedWeight(item)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <div className="compact-grid">
                        <input value={weightDraftName} onChange={(event) => setWeightDraftName(event.target.value)} placeholder="Save current weight" />
                        <button type="button" className="secondary" onClick={saveCurrentWeight}>Save weight</button>
                      </div>
                    </div>
                    )}
                  </>
                )}
              </div>
              {error && <div className="error">{error}</div>}
              </>
              )}
            </>
          )}
        </BuilderPanel>
  );
}
