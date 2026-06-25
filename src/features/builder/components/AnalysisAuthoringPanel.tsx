import { useState } from "react";
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
import {
  buildCompositionBlockLibraryView,
  buildCompositionStarterLibraryView,
  compositionBlockCategoryOptions,
  editorialTextBlockRole,
  editorialTextStyleRole
} from "./compositionBlockModel";
import type { BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, DesignColorPalette, PageTemplatePreset, PageThemePreset, SavedAnalyticalTemplate, SavedBanner, SavedCompositionBlock, SavedDerivedDefinition, SavedDesignAsset, SavedFilterSet, SavedSegmentProfile, SavedVariableSet, SavedWeightProfile, TextBlockPreset, TextStylePreset } from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, DerivedOutputLibraryActionCue, ExploreView, LayerItem, LeftPanelView, MultiSelectedObject, ReportTreeSelectionCue, SavedLibraryHandoff, SavedLibraryInsertionCue, SourceLibraryView } from "../builderTypes";

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
  recordDerivedOutputLibraryActionCue: (cue: Omit<NonNullable<DerivedOutputLibraryActionCue>, "createdAt">) => void;
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
  compositionStarters: SavedCompositionBlock[];
  savedCompositionBlocks: SavedCompositionBlock[];
  designAssets: SavedDesignAsset[];
  saveCompositionBlockFromSelection: () => SavedCompositionBlock | null;
  updateCompositionBlockMetadata: (blockId: string, updates: Pick<SavedCompositionBlock, "label" | "description" | "category">) => void;
  insertCompositionBlock: (block: SavedCompositionBlock) => boolean;
  insertCompositionStarter: (starter: SavedCompositionBlock) => boolean;
  deleteCompositionBlock: (blockId: string) => void;
  insertDesignAsset: (asset: SavedDesignAsset) => void;
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
  savedSegmentProfiles: SavedSegmentProfile[];
  savedWeights: SavedWeightProfile[];
  savedAnalyticalTemplates: SavedAnalyticalTemplate[];
  savedDerivedDefinitions: SavedDerivedDefinition[];
  saveAnalyticalTemplate: (template: SavedAnalyticalTemplate) => void;
  deleteAnalyticalTemplate: (templateId: string) => void;
  saveDerivedDefinition: (definition: SavedDerivedDefinition) => void;
  deleteDerivedDefinition: (definitionId: string) => void;
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
  addTileFromSegmentProfile: (segment: SavedSegmentProfile) => Promise<string | null>;
  duplicateDerivedOutputFromLibrary: (pageId: string, tileId: string) => string | null;
  createDerivedOutputFromDefinition: (definition: SavedDerivedDefinition) => string | null;
  isLoading: boolean;
  applySavedBanner: (banner: SavedBanner) => void;
  bannerDraftName: string;
  setBannerDraftName: (value: string) => void;
  saveCurrentBanner: () => void;
  applySavedFilter: (filter: SavedFilterSet) => void;
  filterDraftName: string;
  setFilterDraftName: (value: string) => void;
  saveCurrentFilter: () => void;
  saveCurrentSegmentProfile: () => void;
  applySegmentProfile: (segment: SavedSegmentProfile) => void;
  deleteSegmentProfile: (segmentId: string) => void;
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
  compositionStarters,
  savedCompositionBlocks,
  designAssets,
  saveCompositionBlockFromSelection,
  updateCompositionBlockMetadata,
  insertCompositionBlock,
  insertCompositionStarter,
  deleteCompositionBlock,
  insertDesignAsset,
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
  const [editingCompositionBlockId, setEditingCompositionBlockId] = useState<string | null>(null);
  const [compositionBlockDraft, setCompositionBlockDraft] = useState({
    label: "",
    description: "",
    category: "custom" as SavedCompositionBlock["category"]
  });
  const [compositionBlockCue, setCompositionBlockCue] = useState<{
    blockId?: string;
    label: string;
    action: "saved" | "updated" | "inserted" | "deleted";
  } | null>(null);
  const [compositionStarterCue, setCompositionStarterCue] = useState<{ starterId: string; label: string } | null>(null);

  function startEditingCompositionBlock(block: SavedCompositionBlock) {
    setEditingCompositionBlockId(block.id);
    setCompositionBlockDraft({
      label: block.label,
      description: block.description,
      category: block.category
    });
  }

  function saveCompositionBlockDraft(block: SavedCompositionBlock) {
    updateCompositionBlockMetadata(block.id, compositionBlockDraft);
    setCompositionBlockCue({ blockId: block.id, label: compositionBlockDraft.label.trim() || block.label, action: "updated" });
    setEditingCompositionBlockId(null);
  }

  function saveSelectionAsCompositionBlock() {
    const block = saveCompositionBlockFromSelection();
    if (block) {
      setCompositionBlockCue({ blockId: block.id, label: block.label, action: "saved" });
    }
  }

  function insertSavedCompositionBlock(block: SavedCompositionBlock) {
    if (insertCompositionBlock(block)) {
      setCompositionBlockCue({ blockId: block.id, label: block.label, action: "inserted" });
    }
  }

  function insertCuratedCompositionStarter(starter: SavedCompositionBlock) {
    if (insertCompositionStarter(starter)) {
      setCompositionStarterCue({ starterId: starter.id, label: starter.label });
    }
  }

  function removeSavedCompositionBlock(block: SavedCompositionBlock) {
    deleteCompositionBlock(block.id);
    setCompositionBlockCue({ label: block.label, action: "deleted" });
  }

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
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={saveSelectionAsCompositionBlock}
                    disabled={!selectedTile && !selectedTextElement && !selectedElementId && multiSelectedObjects.length === 0}
                  >
                    Save selection as block
                  </button>
                </div>
                <div className="explorer-section-card composition-starter-library-card">
                  <div className="explorer-section-header">
                    <strong>Start with a section</strong>
                    <small>{compositionStarters.length} curated</small>
                  </div>
                  <small className="composition-library-helper">
                    Insert a ready-made report section, then edit the text, visuals, and layout like normal page objects.
                  </small>
                  {compositionStarterCue && (
                    <div className="composition-block-feedback starter">
                      <strong>Starter inserted</strong>
                      <small>{compositionStarterCue.label}</small>
                    </div>
                  )}
                  <div className="composition-starter-list">
                    {compositionStarters.map((starter) => {
                      const starterView = buildCompositionStarterLibraryView(starter);
                      const isRecent = compositionStarterCue?.starterId === starter.id;

                      return (
                        <button
                          type="button"
                          className={isRecent ? "composition-starter-card recent" : "composition-starter-card"}
                          key={starter.id}
                          onClick={() => insertCuratedCompositionStarter(starter)}
                        >
                          <span className={`composition-starter-preview ${starterView.previewTone}`}>
                            <span>{starter.summary.objectCount}</span>
                            <small>{starterView.categoryLabel}</small>
                          </span>
                          <span className="composition-starter-body">
                            <span className="composition-starter-kicker">{starterView.starterLabel}</span>
                            <strong>{starter.label}</strong>
                            <small>{starter.description}</small>
                            <span className="composition-starter-meta">
                              {starterView.roleHelper} · {starterView.dimensions}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="explorer-section-card composition-library-card">
                  <div className="explorer-section-header">
                    <strong>Composition blocks</strong>
                    <small>{savedCompositionBlocks.length} saved</small>
                  </div>
                  <small className="composition-library-helper">
                    Save selected objects as reusable, editable page-building blocks. Inserted blocks are copies, not live-linked instances.
                  </small>
                  {compositionBlockCue && (
                    <div className={`composition-block-feedback ${compositionBlockCue.action}`}>
                      <strong>
                        {compositionBlockCue.action === "saved"
                          ? "Block saved"
                          : compositionBlockCue.action === "updated"
                            ? "Block details updated"
                            : compositionBlockCue.action === "inserted"
                              ? "Block inserted"
                              : "Block deleted"}
                      </strong>
                      <small>{compositionBlockCue.label}</small>
                    </div>
                  )}
                  <div className="composition-block-list">
                    {savedCompositionBlocks.length === 0 ? (
                      <div className="composition-block-empty">
                        <strong>Start with a reusable story pattern.</strong>
                        <small>Select a title area, callout, chart plus commentary, or image caption group, then save it as a block.</small>
                      </div>
                    ) : (
                      savedCompositionBlocks.map((block) => {
                        const blockView = buildCompositionBlockLibraryView(block);
                        const isEditing = editingCompositionBlockId === block.id;
                        const isRecent = compositionBlockCue?.blockId === block.id;

                        return (
                          <div className={isRecent ? "composition-block-card recent" : "composition-block-card"} key={block.id}>
                            <div className={`composition-block-preview ${blockView.previewTone}`}>
                              <span>{block.summary.objectCount}</span>
                              <small>{blockView.categoryLabel}</small>
                            </div>
                            <div className="composition-block-body">
                              {isEditing ? (
                                <div className="composition-block-edit">
                                  <label>
                                    Block name
                                    <input value={compositionBlockDraft.label} onChange={(event) => setCompositionBlockDraft((current) => ({ ...current, label: event.target.value }))} />
                                  </label>
                                  <label>
                                    Editorial role
                                    <select
                                      value={compositionBlockDraft.category}
                                      onChange={(event) => setCompositionBlockDraft((current) => ({ ...current, category: event.target.value as SavedCompositionBlock["category"] }))}
                                    >
                                      {compositionBlockCategoryOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    Description
                                    <textarea value={compositionBlockDraft.description} onChange={(event) => setCompositionBlockDraft((current) => ({ ...current, description: event.target.value }))} />
                                  </label>
                                  <div className="brand-card-actions">
                                    <button type="button" className="secondary" onClick={() => saveCompositionBlockDraft(block)}>Save details</button>
                                    <button type="button" className="secondary" onClick={() => setEditingCompositionBlockId(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="composition-block-heading">
                                    <span>{blockView.categoryLabel}</span>
                                    <strong>{block.label}</strong>
                                  </div>
                                  <small>{blockView.structureLabel} · {blockView.mix || blockView.objectSummary} · {blockView.dimensions}</small>
                                  <p>{block.description || blockView.roleHelper}</p>
                                  <div className="composition-block-meta-row">
                                    <span>{blockView.roleHelper}</span>
                                    <small>{blockView.recency}</small>
                                  </div>
                                  <div className="brand-card-actions">
                                    <button type="button" className="secondary" onClick={() => insertSavedCompositionBlock(block)}>Insert</button>
                                    <button type="button" className="secondary" onClick={() => startEditingCompositionBlock(block)}>Edit</button>
                                    <button type="button" className="secondary" onClick={() => removeSavedCompositionBlock(block)}>Delete</button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Image assets</strong>
                    <small>{designAssets.length} local assets</small>
                  </div>
                  <div className="design-asset-list">
                    {designAssets.map((asset) => (
                      <button type="button" className="design-asset-card" key={asset.id} onClick={() => insertDesignAsset(asset)}>
                        <span className="design-asset-preview" style={{ backgroundImage: `url("${asset.url}")` }} />
                        <div>
                          <strong>{asset.label}</strong>
                          <small>{asset.category} · {asset.description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
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
                        <span>{editorialTextStyleRole(preset.id)}</span>
                        <strong
                          style={{
                            fontFamily: preset.fontFamily,
                            fontSize: Math.min(preset.fontSize, 22),
                            fontWeight: preset.fontWeight,
                            color: preset.textColor,
                            textAlign: preset.textAlign
                          }}
                        >
                          {preset.label}
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
                          <span>{editorialTextBlockRole(block.id)}</span>
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
