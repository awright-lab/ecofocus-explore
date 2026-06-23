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
  buildInsertionContextView,
  type InsertionContextView
} from "./insertionContextModel";
import {
  groupQuestionsByTopic,
  groupVariableSetsByTopic,
  questionMetadataChips,
  variableSetMetadataChips
} from "./sourceExplorerModel";
import { SourceDetailPanel } from "./SourceDetailPanel";
import { VariableSetMetadataSection, VariableSetRowListSection, VariableSetRowLogicSection } from "./VariableSetEditorSections";
import { buildDerivedOutputLibraryItems } from "./derivedOutputModel";
import {
  analyticalTemplateSummaryChips,
  analyticalTemplateDifferenceLabels,
  buildAnalyticalTemplateCompatibilityView,
  buildAnalyticalTemplateFromTile,
  buildSavedAnalyticalTemplateInsertionFeedback,
  bannerReuseState,
  buildSavedVariableSetInsertionFeedback,
  buildSavedSettingApplyFeedback,
  filterReuseState,
  savedLibraryItemClass,
  type AnalyticalTemplateReuseContext,
  type SavedAnalyticalTemplateInsertionFeedback,
  type SavedSettingApplyFeedback,
  type SavedVariableSetInsertionFeedback,
  variableSetChartAction,
  weightReuseState
} from "./libraryReuseModel";
import { updateTileBanner, updateTileFilterField, updateTileFilterValue, updateTileWeight } from "./inspectorTileQueryModel";
import type { VariableSetCoverageOption } from "./variableSetValidationModel";

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
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId
  } = props;
  const variableSetGroups = groupVariableSetsByTopic(filteredVariableSets);
  const questionGroups = groupQuestionsByTopic(filteredQuestions);
  const insertionContext = buildInsertionContextView({
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId,
    objectKind: "analytical"
  });

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
                      addRowsForUncoveredOptions={props.addRowsForUncoveredOptions}
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
                      insertionContext={insertionContext}
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
    isLoading,
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId
  } = props;
  const insertionContext: InsertionContextView = buildInsertionContextView({
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId,
    objectKind: "analytical"
  });

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
                          <small>{insertionContext.targetPageLabel} · {insertionContext.placementLabel}</small>
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
                          {insertionContext.helperText} Tables are the analytical starting point.
                        </small>
                        {insertionContext.dropHelperText && <small className="explorer-helper-copy">{insertionContext.dropHelperText}</small>}
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
        <button type="button" className={analysisLibraryView === "templates" ? "active" : ""} onClick={() => setAnalysisLibraryView("templates")}>
          Templates
        </button>
        <button type="button" className={analysisLibraryView === "derivedOutputs" ? "active" : ""} onClick={() => setAnalysisLibraryView("derivedOutputs")}>
          Derived
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
      {analysisLibraryView === "templates" && <AnalyticalTemplateLibrarySection {...props} />}
      {analysisLibraryView === "derivedOutputs" && <DerivedOutputLibrarySection {...props} />}
      {analysisLibraryView === "banners" && <SavedBannersSection {...props} />}
      {analysisLibraryView === "filters" && <SavedFiltersSection {...props} />}
      {analysisLibraryView === "weights" && <SavedWeightsSection {...props} />}
    </>
  );
}

function currentFilterLabel(filterField: typeof filterDimensions[number]["id"] | null, filterValue: string) {
  if (!filterField || filterValue === "all") return "No filter";
  const field = filterDimensions.find((item) => item.id === filterField);
  const value = field?.values.find((item) => item.id === filterValue);
  return `${field?.label ?? filterField}: ${value?.label ?? filterValue}`;
}

function currentWeightLabel(weight: AnalysisAuthoringPanelProps["weight"]) {
  return weight ? defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight : "Unweighted";
}

function currentComparisonLabel(comparisonMode: AnalysisAuthoringPanelProps["comparisonMode"], comparisonDatasets: AnalysisAuthoringPanelProps["comparisonDatasets"]) {
  if (comparisonMode !== "wave") return "No wave comparison";
  if (comparisonDatasets.length === 0) return "Wave comparison";
  return `Wave comparison: ${comparisonDatasets.map((datasetId) => comparisonDatasetOptions.find((item) => item.id === datasetId)?.label ?? datasetId).join(", ")}`;
}

export function AnalyticalTemplateLibrarySection(props: AnalysisAuthoringPanelProps) {
  const {
    savedAnalyticalTemplates,
    saveAnalyticalTemplate,
    deleteAnalyticalTemplate,
    savedLibraryHandoff,
    addTileFromAnalyticalTemplate,
    selectedTile,
    selectedVariableSet,
    selectedQuestion,
    query,
    chartType,
    breakBy,
    weight,
    filterField,
    filterValue,
    comparisonMode,
    comparisonDatasets,
    isLoading,
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId,
    recordSavedLibraryInsertionCue
  } = props;
  const [insertionFeedback, setInsertionFeedback] = useState<SavedAnalyticalTemplateInsertionFeedback | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; label: string; description: string } | null>(null);
  const [managementFeedback, setManagementFeedback] = useState<{
    templateId: string | null;
    label: string;
    message: string;
  } | null>(null);
  const [recentlyChangedTemplateId, setRecentlyChangedTemplateId] = useState<string | null>(null);
  const highlightNewestTemplate = savedLibraryHandoff?.view === "templates";
  const insertionContext = buildInsertionContextView({
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId,
    objectKind: "analytical"
  });
  const currentSource = selectedVariableSet
    ? { kind: "variableSet" as const, id: selectedVariableSet.id, label: selectedVariableSet.label }
    : { kind: "question" as const, id: selectedQuestion.id, label: selectedQuestion.shortLabel };
  const currentTemplateContext: AnalyticalTemplateReuseContext = {
    source: currentSource,
    query,
    visualization: chartType,
    summary: {
      bannerLabel: bannerDimensions.find((item) => item.id === breakBy)?.label ?? breakBy,
      filterLabel: currentFilterLabel(filterField, filterValue),
      weightLabel: currentWeightLabel(weight),
      confidenceLabel: `${Math.round((query.confidenceLevel ?? 0.95) * 100)}% confidence`,
      comparisonLabel: currentComparisonLabel(comparisonMode, comparisonDatasets)
    }
  };

  async function createTemplateObject(template: typeof savedAnalyticalTemplates[number], compatibility: ReturnType<typeof buildAnalyticalTemplateCompatibilityView>) {
    const createdTileId = await addTileFromAnalyticalTemplate(template);
    if (!createdTileId) return;
    setInsertionFeedback(buildSavedAnalyticalTemplateInsertionFeedback(template, insertionContext));
    recordSavedLibraryInsertionCue({
      tileId: createdTileId,
      sourceKind: "analyticalTemplate",
      sourceLabel: template.label,
      objectLabel: template.visualization === "table" ? "table" : getChartTypeLabel(template.visualization).toLowerCase(),
      sourceSummary: `${template.summary.sourceLabel} · ${template.summary.confidenceLabel}`,
      templateDifferenceLabels: analyticalTemplateDifferenceLabels(compatibility)
    });
  }

  function updateTemplateFromSelectedTile(template: typeof savedAnalyticalTemplates[number]) {
    if (!selectedTile) return;
    const nextTemplate = buildAnalyticalTemplateFromTile(selectedTile, {
      id: template.id,
      label: template.label
    });
    saveAnalyticalTemplate(nextTemplate);
    setRecentlyChangedTemplateId(template.id);
    setManagementFeedback({
      templateId: template.id,
      label: "Template content updated",
      message: "Saved source, query, visual, and defaults from the selected tile."
    });
  }

  function startEditingTemplate(template: typeof savedAnalyticalTemplates[number]) {
    setEditingTemplate({
      id: template.id,
      label: template.label,
      description: template.description
    });
    setManagementFeedback(null);
  }

  function saveTemplateMetadata(template: typeof savedAnalyticalTemplates[number]) {
    if (!editingTemplate || editingTemplate.id !== template.id) return;
    const nextLabel = editingTemplate.label.trim();
    if (!nextLabel) {
      setManagementFeedback({
        templateId: template.id,
        label: "Metadata not saved",
        message: "Template name is required."
      });
      return;
    }
    saveAnalyticalTemplate({
      ...template,
      label: nextLabel,
      description: editingTemplate.description.trim()
    });
    setEditingTemplate(null);
    setRecentlyChangedTemplateId(template.id);
    setManagementFeedback({
      templateId: template.id,
      label: "Template metadata saved",
      message: "Updated the template name and description."
    });
  }

  function deleteTemplate(template: typeof savedAnalyticalTemplates[number]) {
    if (!window.confirm(`Delete analytical template "${template.label}"?`)) return;
    deleteAnalyticalTemplate(template.id);
    setInsertionFeedback((current) => (current?.itemId === template.id ? null : current));
    setManagementFeedback({
      templateId: null,
      label: "Template deleted",
      message: `"${template.label}" was removed from the template library.`
    });
    setRecentlyChangedTemplateId(null);
    setEditingTemplate((current) => (current?.id === template.id ? null : current));
    setExpandedTemplateId((current) => (current === template.id ? null : current));
  }

  return (
    <div className="explorer-section-card">
      <div className="explorer-section-header">
        <strong>Analytical templates</strong>
        <small>{savedAnalyticalTemplates.length} saved · {insertionContext.targetPageLabel} · {insertionContext.placementLabel}</small>
      </div>
      <div className="library-insertion-context">
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
      {managementFeedback?.templateId === null && (
        <div className="template-management-feedback deleted" role="status">
          <strong>{managementFeedback.label}</strong>
          <span>{managementFeedback.message}</span>
        </div>
      )}
      {savedAnalyticalTemplates.length === 0 ? (
        <div className="empty-state compact">No analytical templates saved yet.</div>
      ) : (
        <div className="explorer-item-list compact">
          {savedAnalyticalTemplates.map((template, index) => {
            const compatibility = buildAnalyticalTemplateCompatibilityView(template, currentTemplateContext);
            const expanded = expandedTemplateId === template.id;
            const editing = editingTemplate?.id === template.id;
            const recentlyChanged = recentlyChangedTemplateId === template.id;
            return (
              <div key={template.id} className={savedLibraryItemClass(false, (highlightNewestTemplate && index === 0) || recentlyChanged)}>
                <strong>{template.label}</strong>
                <span>{template.description}</span>
                {highlightNewestTemplate && index === 0 && <small className="recently-saved-label">Recently saved</small>}
                {recentlyChanged && <small className="recently-saved-label changed">Recently changed</small>}
                {editing && (
                  <div className="template-edit-card">
                    <label>
                      Name
                      <input
                        value={editingTemplate.label}
                        onChange={(event) => setEditingTemplate((current) => current ? { ...current, label: event.target.value } : current)}
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        value={editingTemplate.description}
                        onChange={(event) => setEditingTemplate((current) => current ? { ...current, description: event.target.value } : current)}
                        rows={3}
                      />
                    </label>
                    <div className="library-reuse-actions">
                      <button type="button" className="secondary" onClick={() => saveTemplateMetadata(template)}>
                        Save metadata
                      </button>
                      <button type="button" className="secondary" onClick={() => setEditingTemplate(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="explorer-chip-row">
                  {analyticalTemplateSummaryChips(template).map((chip) => (
                    <span className="explorer-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                <div className={compatibility.status === "differs" ? "template-compatibility differs" : "template-compatibility"}>
                  <strong>{compatibility.label}</strong>
                  <small>{compatibility.helper}</small>
                  {compatibility.differences.length > 0 && (
                    <div className="template-compatibility-grid">
                      {compatibility.differences.slice(0, 4).map((difference) => (
                        <span key={difference.id}>
                          {difference.label}: {difference.templateValue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {expanded && (
                  <div className="template-detail-card">
                    <span>Source: {template.summary.sourceLabel}</span>
                    <span>Visual: {getChartTypeLabel(template.visualization)}</span>
                    <span>Banner: {template.summary.bannerLabel}</span>
                    <span>Filter: {template.summary.filterLabel}</span>
                    <span>Weight: {template.summary.weightLabel}</span>
                    <span>Confidence: {template.summary.confidenceLabel}</span>
                    <span>Comparison: {template.summary.comparisonLabel}</span>
                  </div>
                )}
                <div className="library-reuse-actions">
                  <button type="button" className="secondary" onClick={() => setExpandedTemplateId(expanded ? null : template.id)}>
                    {expanded ? "Hide details" : "Details"}
                  </button>
                  <button type="button" className="secondary" onClick={() => editing ? setEditingTemplate(null) : startEditingTemplate(template)}>
                    {editing ? "Close edit" : "Edit metadata"}
                  </button>
                  <button type="button" className="secondary" onClick={() => void createTemplateObject(template, compatibility)} disabled={isLoading}>
                    Create from template
                  </button>
                  <button type="button" className="secondary" onClick={() => updateTemplateFromSelectedTile(template)} disabled={!selectedTile}>
                    Update from selected tile
                  </button>
                  <button type="button" className="secondary danger-action" onClick={() => deleteTemplate(template)}>
                    Delete
                  </button>
                </div>
                {managementFeedback?.templateId === template.id && (
                  <div className="template-management-feedback" role="status">
                    <strong>{managementFeedback.label}</strong>
                    <span>{managementFeedback.message}</span>
                  </div>
                )}
                {insertionFeedback?.itemId === template.id && (
                  <div className="source-insertion-confirmation" role="status">
                    <strong>{insertionFeedback.label}</strong>
                    <span>{insertionFeedback.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DerivedOutputLibrarySection(props: AnalysisAuthoringPanelProps) {
  const {
    sortedPages,
    activePage,
    setActivePageId,
    selectTile,
    duplicateDerivedOutputFromLibrary,
    saveAnalyticalTemplate
  } = props;
  const [feedback, setFeedback] = useState<{
    itemId: string;
    label: string;
    message: string;
  } | null>(null);
  const derivedOutputs = buildDerivedOutputLibraryItems(sortedPages);

  function findTile(pageId: string, tileId: string) {
    const page = sortedPages.find((item) => item.id === pageId);
    return page?.tiles.find((tile) => tile.id === tileId) ?? null;
  }

  function locateOutput(pageId: string, tileId: string) {
    setActivePageId(pageId);
    selectTile(tileId);
    setFeedback({
      itemId: `${pageId}:${tileId}`,
      label: "Derived output selected",
      message: "Opened the derived output in the report so its inspector details can be reviewed."
    });
  }

  function duplicateOutput(pageId: string, tileId: string) {
    const duplicateId = duplicateDerivedOutputFromLibrary(pageId, tileId);
    if (!duplicateId) return;
    setFeedback({
      itemId: `${pageId}:${tileId}`,
      label: "Derived output duplicated",
      message: "Created a separate copy on the same page and selected it for inspection."
    });
  }

  function saveOutputAsTemplate(pageId: string, tileId: string) {
    const tile = findTile(pageId, tileId);
    if (!tile) return;
    saveAnalyticalTemplate(buildAnalyticalTemplateFromTile(tile));
    setFeedback({
      itemId: `${pageId}:${tileId}`,
      label: "Template saved",
      message: "Saved this derived output's analytical setup to the template library."
    });
  }

  return (
    <div className="explorer-section-card">
      <div className="explorer-section-header">
        <strong>Derived outputs</strong>
        <small>{derivedOutputs.length} in report · Current page: {activePage.title}</small>
      </div>
      <small className="library-reuse-helper">
        Derived outputs are managed report artifacts. They are not live-linked; recreate from the inspector when a source result should be reflected.
      </small>
      {derivedOutputs.length === 0 ? (
        <div className="empty-state compact">No derived outputs in this report yet.</div>
      ) : (
        <div className="explorer-item-list compact">
          {derivedOutputs.map((item) => (
            <div key={item.id} className={savedLibraryItemClass(false, feedback?.itemId === item.id)}>
              <strong>{item.title}</strong>
              <span>{item.label} · {item.pageTitle}</span>
              <small className="library-reuse-helper">Source: {item.sourceLabel} · {item.structuralSummary}</small>
              <div className="explorer-chip-row">
                {item.chips.map((chip) => (
                  <span className="explorer-chip" key={chip}>{chip}</span>
                ))}
              </div>
              <div className="template-detail-card">
                <span>Source status: {item.sourceStatusLabel}</span>
                <span>Readiness: {item.readinessLabel}</span>
                <span>Structure: {item.structuralSummary}</span>
              </div>
              <div className="library-reuse-actions">
                <button type="button" className="secondary" onClick={() => locateOutput(item.pageId, item.tileId)}>
                  Locate in report
                </button>
                <button type="button" className="secondary" onClick={() => duplicateOutput(item.pageId, item.tileId)}>
                  Duplicate copy
                </button>
                <button type="button" className="secondary" onClick={() => saveOutputAsTemplate(item.pageId, item.tileId)}>
                  Save as template
                </button>
              </div>
              {feedback?.itemId === item.id && (
                <div className="template-management-feedback" role="status">
                  <strong>{feedback.label}</strong>
                  <span>{feedback.message}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
    deleteVariableSet,
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId,
    recordSavedLibraryInsertionCue
  } = props;
  const highlightNewestSet = savedLibraryHandoff?.view === "variableSets";
  const [insertionFeedback, setInsertionFeedback] = useState<SavedVariableSetInsertionFeedback | null>(null);
  const [showRowsNeedingReview, setShowRowsNeedingReview] = useState(false);
  const [focusedSourceOption, setFocusedSourceOption] = useState<VariableSetCoverageOption | null>(null);
  const insertionContext = buildInsertionContextView({
    activePage,
    layerItems,
    selectedTileId,
    selectedElementId,
    objectKind: "analytical"
  });

  async function createSavedVariableSetObject(variableSet: typeof savedVariableSets[number], chartType: ChartType, objectLabel: string) {
    const createdTileId = await addTileFromVariableSet(variableSet, chartType);
    if (!createdTileId) return;
    setInsertionFeedback(buildSavedVariableSetInsertionFeedback(variableSet, objectLabel, insertionContext));
    recordSavedLibraryInsertionCue({
      tileId: createdTileId,
      sourceKind: "variableSet",
      sourceLabel: variableSet.label,
      objectLabel
    });
  }

  return (
    <div className="explorer-section-card">
      <div className="explorer-section-header">
        <strong>Variable set editor</strong>
        <small>Save and update reusable sources</small>
      </div>
      <div className="explorer-section-card compact nested">
        <div className="explorer-section-header">
          <strong>Saved variable sets</strong>
          <small>{savedVariableSets.length} saved · {insertionContext.targetPageLabel} · {insertionContext.placementLabel}</small>
        </div>
        <div className="library-insertion-context">
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
                <button type="button" className="secondary" onClick={() => void createSavedVariableSetObject(item, "table", "table")} disabled={isLoading}>Create table</button>
                <button type="button" className="secondary" onClick={() => void createSavedVariableSetObject(item, chartAction.chartType, chartAction.label)} disabled={isLoading}>
                  Create {chartAction.label}
                </button>
              </div>
              {insertionFeedback?.itemId === item.id && (
                <div className="source-insertion-confirmation" role="status">
                  <strong>{insertionFeedback.label}</strong>
                  <span>{insertionFeedback.message}</span>
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>
      <VariableSetMetadataSection {...props} />
      <VariableSetRowLogicSection
        {...props}
        showRowsNeedingReview={showRowsNeedingReview}
        onToggleRowsNeedingReview={() => setShowRowsNeedingReview((current) => !current)}
        focusedSourceOption={focusedSourceOption}
        onFocusSourceOption={(option) => {
          setFocusedSourceOption(option);
          setShowRowsNeedingReview(false);
        }}
      />
      <VariableSetRowListSection
        {...props}
        showRowsNeedingReview={showRowsNeedingReview}
        focusedSourceOption={focusedSourceOption}
        onClearFocusedSourceOption={() => setFocusedSourceOption(null)}
      />
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
  const { savedBanners, breakBy, applySavedBanner, bannerDraftName, setBannerDraftName, saveCurrentBanner, savedLibraryHandoff, selectedTile, focusSelectedTileInspector, recordSavedSettingOriginCue, updateTile } = props;
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
                                  recordSavedSettingOriginCue("banner", item.label, selectedTile.id);
                                  setApplyFeedback(buildSavedSettingApplyFeedback("banner", item.id, item.label, { ...selectedTile, ...updates }));
                                }}
                              >
                                Apply to selected tile
                              </button>
                            </div>
                            {feedback && <SavedSettingApplyStatus feedback={feedback} onOpenInspector={focusSelectedTileInspector} />}
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
  const { savedFilters, filterField, filterValue, applySavedFilter, filterDraftName, setFilterDraftName, saveCurrentFilter, savedLibraryHandoff, selectedTile, focusSelectedTileInspector, recordSavedSettingOriginCue, updateTile } = props;
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
                                  recordSavedSettingOriginCue("filter", item.label, selectedTile.id);
                                  setApplyFeedback(buildSavedSettingApplyFeedback("filter", item.id, item.label, { ...selectedTile, ...updates }));
                                }}
                              >
                                Apply to selected tile
                              </button>
                            </div>
                            {feedback && <SavedSettingApplyStatus feedback={feedback} onOpenInspector={focusSelectedTileInspector} />}
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
  const { savedWeights, weight, applySavedWeight, weightDraftName, setWeightDraftName, saveCurrentWeight, savedLibraryHandoff, selectedTile, focusSelectedTileInspector, recordSavedSettingOriginCue, updateTile } = props;
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
                                  recordSavedSettingOriginCue("weight", item.label, selectedTile.id);
                                  setApplyFeedback(buildSavedSettingApplyFeedback("weight", item.id, item.label, { ...selectedTile, ...updates }));
                                }}
                              >
                                Apply to selected tile
                              </button>
                            </div>
                            {feedback && <SavedSettingApplyStatus feedback={feedback} onOpenInspector={focusSelectedTileInspector} />}
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

function SavedSettingApplyStatus({ feedback, onOpenInspector }: { feedback: SavedSettingApplyFeedback; onOpenInspector: () => void }) {
  return (
    <div className={feedback.needsRefresh ? "library-reuse-confirmation pending" : "library-reuse-confirmation"} role="status">
      <strong>{feedback.label}</strong>
      <span>{feedback.message}</span>
      <small>{feedback.statusLabel}: {feedback.statusDescription}</small>
      <button type="button" className="inline-action" onClick={onOpenInspector} title={feedback.handoffDescription}>
        {feedback.handoffLabel}
      </button>
    </div>
  );
}
