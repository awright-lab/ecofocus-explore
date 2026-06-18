import { useState } from "react";
import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  filterDimensions
} from "../builderConstants";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { BreakById, ChartType, ComparisonMode, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import {
  groupQuestionsByTopic,
  groupVariableSetsByTopic,
  questionMetadataChips,
  variableSetMetadataChips
} from "./sourceExplorerModel";
import { SourceDetailPanel } from "./SourceDetailPanel";
import { VariableSetMetadataSection, VariableSetRowListSection, VariableSetRowLogicSection } from "./VariableSetEditorSections";
import {
  bannerReuseState,
  buildSavedSettingApplyFeedback,
  filterReuseState,
  savedLibraryItemClass,
  type SavedSettingApplyFeedback,
  variableSetChartAction,
  weightReuseState
} from "./libraryReuseModel";
import { updateTileBanner, updateTileFilterField, updateTileFilterValue, updateTileWeight } from "./inspectorTileQueryModel";

export function SourcePickerSection(props: AnalysisAuthoringPanelProps) {
  const {
    sourceLibraryView,
    setSourceLibraryView,
    sourceSearch,
    setSourceSearch,
    filteredVariableSets,
    filteredQuestions,
    selectedDataSource,
    applyVariableSetSelection,
    applyQuestionSelection,
    startDataSourceDrag,
    selectedVariableSet,
    selectedQuestion,
    variableSetRows,
    updateVariableSetRow,
    reorderVariableSetRow,
    saveCurrentVariableSet,
    variableSetDraftName,
    variableSetDescription,
    variableSetQuestionIds,
    breakBy,
    metric,
    chartType,
    comparisonMode,
    comparisonDatasets,
    weight,
    filterField,
    filterValue,
    selectedChartTypes,
    addTileFromSourceWithVisualization,
    isLoading,
    activePage
  } = props;
  const variableSetGroups = groupVariableSetsByTopic(filteredVariableSets);
  const questionGroups = groupQuestionsByTopic(filteredQuestions);

  return (
                  <>
                    <div className="color-summary-card compact">
                      <div>
                        <span>Current source</span>
                        <strong>{selectedVariableSet ? selectedVariableSet.label : selectedQuestion.shortLabel}</strong>
                      </div>
                      <small>
                        {selectedVariableSet
                          ? `${selectedVariableSet.description} · ${selectedVariableSet.rows.length} rows`
                          : `${selectedQuestion.label} · ${selectedQuestion.options.length} options · ${defaultDataset.wave}`}
                      </small>
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
                      <div className="explorer-item-list source-group-list">
                        {variableSetGroups.map((group) => (
                          <div className="source-group" key={group.id}>
                            <div className="source-group-header">
                              <strong>{group.label}</strong>
                              <span>{group.items.length} sets</span>
                            </div>
                            {group.items.map((item) => (
                              <button
                                type="button"
                                key={item.id}
                                draggable
                                className={selectedDataSource.kind === "variableSet" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                                onClick={() => applyVariableSetSelection(item)}
                                onDragStart={(event) => startDataSourceDrag({ kind: "variableSet", id: item.id }, event)}
                              >
                                <strong>{item.label}</strong>
                                <span>{item.description}</span>
                                <div className="source-metadata-row">
                                  {variableSetMetadataChips(item).map((chip) => (
                                    <span className="explorer-chip" key={chip}>
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            ))}
                          </div>
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
                      <div className="explorer-item-list source-group-list">
                        {questionGroups.map((group) => (
                          <div className="source-group" key={group.id}>
                            <div className="source-group-header">
                              <strong>{group.label}</strong>
                              <span>{group.items.length} questions</span>
                            </div>
                            {group.items.map((item) => (
                              <button
                                type="button"
                                key={item.id}
                                draggable
                                className={selectedDataSource.kind === "question" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                                onClick={() => applyQuestionSelection(item)}
                                onDragStart={(event) => startDataSourceDrag({ kind: "question", id: item.id }, event)}
                              >
                                <strong>{item.shortLabel}</strong>
                                <span>{item.label}</span>
                                <div className="source-metadata-row">
                                  {questionMetadataChips(item).map((chip) => (
                                    <span className="explorer-chip" key={chip}>
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                        {filteredQuestions.length === 0 && <div className="empty-state compact">No questions match that search.</div>}
                      </div>
                    </div>
                    )}
                    <SourceDetailPanel
                      selectedDataSource={selectedDataSource}
                      selectedQuestion={selectedQuestion}
                      selectedVariableSet={selectedVariableSet}
                      variableSetRows={variableSetRows}
                      updateVariableSetRow={updateVariableSetRow}
                      reorderVariableSetRow={reorderVariableSetRow}
                      saveCurrentVariableSet={saveCurrentVariableSet}
                      variableSetDraftName={variableSetDraftName}
                      variableSetDescription={variableSetDescription}
                      variableSetQuestionIds={variableSetQuestionIds}
                      breakBy={breakBy}
                      metric={metric}
                      chartType={chartType}
                      comparisonMode={comparisonMode}
                      comparisonDatasets={comparisonDatasets}
                      weight={weight}
                      filterField={filterField}
                      filterValue={filterValue}
                      selectedChartTypes={selectedChartTypes}
                      addTileFromSourceWithVisualization={addTileFromSourceWithVisualization}
                      isLoading={isLoading}
                      activePageTitle={activePage.title}
                    />
                  </>
  );
}

export function QueryEditorSection(props: AnalysisAuthoringPanelProps) {
  const {
    selectedQuestion,
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
    addTileFromSourceWithVisualization,
    isLoading
  } = props;

  return (
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
  );
}

export function AnalysisLibrarySection(props: AnalysisAuthoringPanelProps) {
  const { analysisLibraryView, setAnalysisLibraryView } = props;

  return (
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
      {analysisLibraryView === "variableSets" && <VariableSetEditorSection {...props} />}
      {analysisLibraryView === "banners" && <SavedBannersSection {...props} />}
      {analysisLibraryView === "filters" && <SavedFiltersSection {...props} />}
      {analysisLibraryView === "weights" && <SavedWeightsSection {...props} />}
    </>
  );
}

export function VariableSetEditorSection(props: AnalysisAuthoringPanelProps) {
  const {
    selectedDataSource,
    selectedVariableSet,
    savedLibraryHandoff,
    savedVariableSets,
    applyVariableSetSelection,
    addTileFromVariableSet,
    isLoading,
    saveCurrentVariableSet,
    deleteVariableSet
  } = props;
  const highlightNewestSet = savedLibraryHandoff?.view === "variableSets";

  return (
    <div className="explorer-section-card">
      <div className="explorer-section-header">
        <strong>Variable set editor</strong>
        <small>Save and update reusable sources</small>
      </div>
      <div className="explorer-section-card compact nested">
        <div className="explorer-section-header">
          <strong>Saved variable sets</strong>
          <small>{savedVariableSets.length} saved</small>
        </div>
        <div className="explorer-item-list compact">
          {savedVariableSets.map((item, index) => {
            const chartAction = variableSetChartAction(item);
            return (
            <div
              key={item.id}
              className={savedLibraryItemClass(selectedDataSource.kind === "variableSet" && selectedDataSource.id === item.id, highlightNewestSet && index === 0)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              {highlightNewestSet && index === 0 && <small className="recently-saved-label">Recently saved</small>}
              <div className="library-reuse-actions">
                <button type="button" className="secondary" onClick={() => applyVariableSetSelection(item)}>Load source</button>
                <button type="button" className="secondary" onClick={() => void addTileFromVariableSet(item, "table")} disabled={isLoading}>Create table</button>
                <button type="button" className="secondary" onClick={() => void addTileFromVariableSet(item, chartAction.chartType)} disabled={isLoading}>
                  Create {chartAction.label}
                </button>
              </div>
            </div>
          );
          })}
        </div>
      </div>
      <VariableSetMetadataSection {...props} />
      <VariableSetRowLogicSection {...props} />
      <VariableSetRowListSection {...props} />
      <div className="compact-grid">
        <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(!selectedVariableSet)}>
          {selectedVariableSet ? "Update set" : "Save set"}
        </button>
        <button type="button" className="secondary" disabled={!selectedVariableSet} onClick={() => selectedVariableSet && deleteVariableSet(selectedVariableSet.id)}>
          Delete set
        </button>
      </div>
    </div>
  );
}

export function SavedBannersSection(props: AnalysisAuthoringPanelProps) {
  const { savedBanners, breakBy, applySavedBanner, bannerDraftName, setBannerDraftName, saveCurrentBanner, savedLibraryHandoff, selectedTile, updateTile } = props;
  const [applyFeedback, setApplyFeedback] = useState<SavedSettingApplyFeedback | null>(null);
  const highlightNewestBanner = savedLibraryHandoff?.view === "banners";
  const selectedTileQuestion = selectedTile ? defaultDataset.questions.find((item) => item.id === selectedTile.query.question) ?? null : null;

  return (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved banners</strong>
                        <small>{savedBanners.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedBanners.map((item, index) => {
                          const reuse = bannerReuseState(selectedTile, selectedTileQuestion, item);
                          const feedback = applyFeedback?.itemId === item.id ? applyFeedback : null;
                          return (
                          <div key={item.id} className={savedLibraryItemClass(item.breakBy === breakBy, highlightNewestBanner && index === 0)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                            {highlightNewestBanner && index === 0 && <small className="recently-saved-label">Recently saved</small>}
                            <small className="library-reuse-helper">{reuse.helper}</small>
                            <div className="library-reuse-actions">
                              <button type="button" className="secondary" onClick={() => applySavedBanner(item)}>Load in authoring</button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={!reuse.enabled}
                                onClick={() => {
                                  if (!selectedTile) return;
                                  const updates = updateTileBanner(selectedTile, item.breakBy);
                                  updateTile(selectedTile.id, updates);
                                  setApplyFeedback(buildSavedSettingApplyFeedback("banner", item.id, item.label, { ...selectedTile, ...updates }));
                                }}
                              >
                                Apply to selected tile
                              </button>
                            </div>
                            {feedback && <SavedSettingApplyStatus feedback={feedback} />}
                          </div>
                        );
                        })}
                      </div>
                      <div className="compact-grid">
                        <input value={bannerDraftName} onChange={(event) => setBannerDraftName(event.target.value)} placeholder="Save current banner" />
                        <button type="button" className="secondary" onClick={saveCurrentBanner}>Save banner</button>
                      </div>
                    </div>
  );
}

export function SavedFiltersSection(props: AnalysisAuthoringPanelProps) {
  const { savedFilters, filterField, filterValue, applySavedFilter, filterDraftName, setFilterDraftName, saveCurrentFilter, savedLibraryHandoff, selectedTile, updateTile } = props;
  const [applyFeedback, setApplyFeedback] = useState<SavedSettingApplyFeedback | null>(null);
  const highlightNewestFilter = savedLibraryHandoff?.view === "filters";

  return (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved filters</strong>
                        <small>{savedFilters.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedFilters.map((item, index) => {
                          const reuse = filterReuseState(selectedTile, item);
                          const feedback = applyFeedback?.itemId === item.id ? applyFeedback : null;
                          return (
                          <div key={item.id} className={savedLibraryItemClass(item.filterField === filterField && item.filterValue === filterValue, highlightNewestFilter && index === 0)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                            {highlightNewestFilter && index === 0 && <small className="recently-saved-label">Recently saved</small>}
                            <small className="library-reuse-helper">{reuse.helper}</small>
                            <div className="library-reuse-actions">
                              <button type="button" className="secondary" onClick={() => applySavedFilter(item)}>Load in authoring</button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={!reuse.enabled}
                                onClick={() => {
                                  if (!selectedTile) return;
                                  const fieldUpdate = updateTileFilterField(selectedTile, item.filterField);
                                  const nextTile = { ...selectedTile, ...fieldUpdate };
                                  const updates =
                                    item.filterField && item.filterValue !== "all"
                                      ? updateTileFilterValue(nextTile, item.filterField, item.filterValue)
                                      : fieldUpdate;
                                  updateTile(selectedTile.id, updates);
                                  setApplyFeedback(buildSavedSettingApplyFeedback("filter", item.id, item.label, { ...selectedTile, ...updates }));
                                }}
                              >
                                Apply to selected tile
                              </button>
                            </div>
                            {feedback && <SavedSettingApplyStatus feedback={feedback} />}
                          </div>
                        );
                        })}
                      </div>
                      <div className="compact-grid">
                        <input value={filterDraftName} onChange={(event) => setFilterDraftName(event.target.value)} placeholder="Save current filter" />
                        <button type="button" className="secondary" onClick={saveCurrentFilter}>Save filter</button>
                      </div>
                    </div>
  );
}

export function SavedWeightsSection(props: AnalysisAuthoringPanelProps) {
  const { savedWeights, weight, applySavedWeight, weightDraftName, setWeightDraftName, saveCurrentWeight, savedLibraryHandoff, selectedTile, updateTile } = props;
  const [applyFeedback, setApplyFeedback] = useState<SavedSettingApplyFeedback | null>(null);
  const highlightNewestWeight = savedLibraryHandoff?.view === "weights";

  return (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved weights</strong>
                        <small>{savedWeights.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedWeights.map((item, index) => {
                          const reuse = weightReuseState(selectedTile, item);
                          const feedback = applyFeedback?.itemId === item.id ? applyFeedback : null;
                          return (
                          <div key={item.id} className={savedLibraryItemClass(item.weight === weight, highlightNewestWeight && index === 0)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                            {highlightNewestWeight && index === 0 && <small className="recently-saved-label">Recently saved</small>}
                            <small className="library-reuse-helper">{reuse.helper}</small>
                            <div className="library-reuse-actions">
                              <button type="button" className="secondary" onClick={() => applySavedWeight(item)}>Load in authoring</button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={!reuse.enabled}
                                onClick={() => {
                                  if (!selectedTile) return;
                                  const updates = updateTileWeight(selectedTile, item.weight);
                                  updateTile(selectedTile.id, updates);
                                  setApplyFeedback(buildSavedSettingApplyFeedback("weight", item.id, item.label, { ...selectedTile, ...updates }));
                                }}
                              >
                                Apply to selected tile
                              </button>
                            </div>
                            {feedback && <SavedSettingApplyStatus feedback={feedback} />}
                          </div>
                        );
                        })}
                      </div>
                      <div className="compact-grid">
                        <input value={weightDraftName} onChange={(event) => setWeightDraftName(event.target.value)} placeholder="Save current weight" />
                        <button type="button" className="secondary" onClick={saveCurrentWeight}>Save weight</button>
                      </div>
                    </div>
  );
}

function SavedSettingApplyStatus({ feedback }: { feedback: SavedSettingApplyFeedback }) {
  return (
    <div className={feedback.needsRefresh ? "library-reuse-confirmation pending" : "library-reuse-confirmation"} role="status">
      <strong>{feedback.label}</strong>
      <span>{feedback.message}</span>
      <small>{feedback.statusLabel}: {feedback.statusDescription}</small>
    </div>
  );
}
