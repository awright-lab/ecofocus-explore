import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  defaultQuestion,
  filterDimensions
} from "../builderConstants";
import { defaultVisualizationForQuestion, getChartTypeLabel } from "../../analytics/analyticsDisplay";
import { defaultVariableSetRows, rowKindLabel } from "../../document/documentSeeds";
import type { BreakById, ChartType, ComparisonMode, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";

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
    selectedQuestion
  } = props;

  return (
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
    setBreakBy,
    setMetric,
    setChartType,
    setVariableSetRows,
    setVariableSetOptionSelection,
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
    deleteVariableSet
  } = props;

  return (
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
  );
}

export function SavedBannersSection(props: AnalysisAuthoringPanelProps) {
  const { savedBanners, breakBy, applySavedBanner, bannerDraftName, setBannerDraftName, saveCurrentBanner } = props;

  return (
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
  );
}

export function SavedFiltersSection(props: AnalysisAuthoringPanelProps) {
  const { savedFilters, filterField, filterValue, applySavedFilter, filterDraftName, setFilterDraftName, saveCurrentFilter } = props;

  return (
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
  );
}

export function SavedWeightsSection(props: AnalysisAuthoringPanelProps) {
  const { savedWeights, weight, applySavedWeight, weightDraftName, setWeightDraftName, saveCurrentWeight } = props;

  return (
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
  );
}
