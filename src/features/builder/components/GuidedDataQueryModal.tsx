import { useMemo, useState } from "react";
import { bannerDimensions, comparisonDatasetOptions, defaultDataset, filterDimensions } from "../builderConstants";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import {
  buildImportedDatasetStructureSummary,
  importedFieldAnswerChoices,
  importedFieldAnswerChoiceSummary,
  importedBannerPlainLabel,
  importedDatasetMetadataQualityLabel,
  importedFieldDisplayLabel,
  importedFieldRawNameLabel,
  importedFieldTypeLabel
} from "../../data/datasetModelingModel";
import { importedSurveyQuestionPrompt } from "../../data/importedSurveyLabelModel";
import {
  buildImportedFieldSuitability,
  buildImportedQueryRecommendations,
  firstImportedDimensionField,
  firstImportedMeasureField,
  getImportedDatasetQuerySupport as getImportedExecutionSupport,
  isImportedFieldAnalysisCandidate,
  importedFieldValues
} from "../../data/importedDatasetAnalytics";
import type { AnalysisAuthoringPanelProps, GuidedDataQueryLaunchOptions } from "./AnalysisAuthoringPanel";
import type { BreakById, ChartType, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";

type GuidedOutputMode = "table" | "chart";
type ImportedQueryMode = "categorical" | "measure";

function supportedChartType(chartTypes: ChartType[]) {
  return chartTypes.find((item) => item !== "table") ?? "vertical_bar";
}

export function GuidedDataQueryModal({
  props,
  initialOutputMode = "table",
  launchContext,
  onClose
}: {
  props: AnalysisAuthoringPanelProps;
  initialOutputMode?: GuidedOutputMode;
  launchContext?: GuidedDataQueryLaunchOptions;
  onClose: () => void;
}) {
  const {
    importedDatasets,
    selectedQuestion,
    selectedVariableSet,
    filteredQuestions,
    question,
    setQuestion,
    applyQuestionSelection,
    breakBy,
    setBreakBy,
    metric,
    setMetric,
    weight,
    setWeight,
    filterField,
    setFilterField,
    filterValue,
    setFilterValue,
    comparisonMode,
    comparisonDatasets,
    setComparisonMode,
    setComparisonDatasets,
    toggleComparisonDataset,
    selectedFilterDimension,
    selectedChartTypes,
    chartType,
    setChartType,
    addTileFromSourceWithVisualization,
    addTileFromImportedDatasetField,
    isLoading
  } = props;
  const launchDatasetBase = importedDatasets.find((dataset) => dataset.id === launchContext?.importedDatasetId) ?? importedDatasets[0] ?? null;
  const launchDataset = launchDatasetBase && launchContext?.importedFieldSnapshot && !launchDatasetBase.fields.some((field) => field.id === launchContext.importedFieldSnapshot?.id)
    ? { ...launchDatasetBase, fields: [launchContext.importedFieldSnapshot, ...launchDatasetBase.fields] }
    : launchDatasetBase;
  const launchField = launchContext?.importedFieldSnapshot ?? launchDataset?.fields.find((field) => field.id === launchContext?.importedFieldId) ?? null;
  const launchFieldSuitability = launchField ? buildImportedFieldSuitability(launchField) : null;
  const launchFieldCanDriveAnalysis = isImportedFieldAnalysisCandidate(launchField);
  const launchPrimaryField = launchFieldCanDriveAnalysis && launchFieldSuitability?.recommendedQueryMode === "categorical"
    ? launchField
    : firstImportedDimensionField(launchDataset);
  const launchMeasureField = launchFieldCanDriveAnalysis && launchFieldSuitability?.recommendedQueryMode === "measure"
    ? launchField
    : firstImportedMeasureField(launchDataset);
  const launchQueryMode: ImportedQueryMode = launchFieldCanDriveAnalysis && launchFieldSuitability?.recommendedQueryMode === "measure" ? "measure" : "categorical";
  const [datasetMode, setDatasetMode] = useState<"seeded" | "imported">(launchContext?.importedDatasetId || importedDatasets.length ? "imported" : "seeded");
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState(launchDataset?.id ?? "");
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState(launchPrimaryField?.id ?? "");
  const [selectedImportedBannerFieldId, setSelectedImportedBannerFieldId] = useState("none");
  const [selectedImportedFilterFieldId, setSelectedImportedFilterFieldId] = useState("none");
  const [selectedImportedFilterValue, setSelectedImportedFilterValue] = useState("all");
  const [importedMetric, setImportedMetric] = useState<Metric>(launchQueryMode === "measure" ? "average" : "percent_selected");
  const [importedQueryMode, setImportedQueryMode] = useState<ImportedQueryMode>(launchQueryMode);
  const [selectedImportedMeasureFieldId, setSelectedImportedMeasureFieldId] = useState(launchMeasureField?.id ?? "none");
  const [outputMode, setOutputMode] = useState<GuidedOutputMode>(initialOutputMode);
  const importedDatasetBase = importedDatasets.find((dataset) => dataset.id === selectedImportedDatasetId) ?? importedDatasets[0] ?? null;
  const importedDataset = importedDatasetBase && launchContext?.importedFieldSnapshot && importedDatasetBase.id === launchContext.importedDatasetId && !importedDatasetBase.fields.some((field) => field.id === launchContext.importedFieldSnapshot?.id)
    ? { ...importedDatasetBase, fields: [launchContext.importedFieldSnapshot, ...importedDatasetBase.fields] }
    : importedDatasetBase;
  const importedSummary = buildImportedDatasetStructureSummary(importedDataset);
  const importedPrimaryFieldCandidates = importedSummary.fields.filter((field) =>
    (field.type === "categorical" || field.modelingRole === "candidate_dimension") && isImportedFieldAnalysisCandidate(field)
  );
  const importedPrimaryFields = importedPrimaryFieldCandidates.length
    ? importedPrimaryFieldCandidates
    : importedSummary.fields.filter((field) => field.type === "categorical" || field.modelingRole === "candidate_dimension");
  const importedField = importedPrimaryFields.find((field) => field.id === selectedImportedFieldId) ?? importedPrimaryFields[0] ?? null;
  const importedAnswerChoices = importedFieldAnswerChoices(importedField);
  const importedAnswerChoiceSummary = importedFieldAnswerChoiceSummary(importedField);
  const importedQuestionPrompt = importedSurveyQuestionPrompt(importedField);
  const importedMeasureFieldCandidates = importedSummary.fields.filter((field) =>
    (field.type === "numeric" || field.modelingRole === "candidate_measure") && isImportedFieldAnalysisCandidate(field)
  );
  const importedMeasureFields = importedMeasureFieldCandidates.length
    ? importedMeasureFieldCandidates
    : importedSummary.fields.filter((field) => field.type === "numeric" || field.modelingRole === "candidate_measure");
  const importedBannerFields = importedSummary.banners.filter((field) => field.id !== importedField?.id);
  const importedFilterFields = importedSummary.filters;
  const importedBannerField = importedBannerFields.find((field) => field.id === selectedImportedBannerFieldId) ?? null;
  const importedFilterField = importedFilterFields.find((field) => field.id === selectedImportedFilterFieldId) ?? null;
  const importedFilterValues = importedFieldValues(importedDataset, importedFilterField);
  const importedFilter =
    importedFilterField && selectedImportedFilterValue !== "all"
      ? { field: importedFilterField, value: selectedImportedFilterValue }
      : null;
  const importedMeasureField = importedMeasureFields.find((field) => field.id === selectedImportedMeasureFieldId) ?? null;
  const importedFieldSuitability = importedField ? buildImportedFieldSuitability(importedField) : null;
  const importedRecommendations = buildImportedQueryRecommendations(importedDataset, importedField, {
    selectedQueryMode: importedQueryMode,
    measureField: importedMeasureField,
    bannerFields: importedBannerFields
  });
  const effectiveImportedMetric: Metric =
    importedQueryMode === "measure"
      ? importedMetric === "sum" ? "sum" : "average"
      : importedMetric === "count" ? "count" : "percent_selected";
  const questionOptions = useMemo(() => filteredQuestions.slice(0, 60), [filteredQuestions]);
  const selectedChart = outputMode === "table"
    ? "table"
    : (importedBannerField || importedQueryMode === "measure") && chartType === "donut"
      ? "vertical_bar"
      : chartType === "table"
        ? supportedChartType(selectedChartTypes)
        : chartType;
  const importedSupport = getImportedExecutionSupport(importedDataset, importedField, {
    bannerField: importedBannerField,
    filter: importedFilter,
    measureField: importedQueryMode === "measure" ? importedMeasureField : null,
    metric: effectiveImportedMetric,
    chartType: selectedChart
  });
  const canCreate = datasetMode === "seeded" || importedSupport.executable;
  const importedDatasetHasRows = Boolean(importedDataset && ((importedDataset.rows?.length ?? 0) > 0 || (importedDataset.previewRows?.length ?? 0) > 0));
  const importedGroupingLabel = importedFieldDisplayLabel(importedField);
  const importedMeasureLabel = importedFieldDisplayLabel(importedMeasureField);
  const importedRowCount = importedDataset?.rowCount ?? importedDataset?.rows?.length ?? 0;
  const importedOutputLabel = outputMode === "table" ? "table" : `${getChartTypeLabel(selectedChart)} chart`;
  const importedValuesLabel =
    effectiveImportedMetric === "average" ? "Average"
      : effectiveImportedMetric === "sum" ? "Total"
        : effectiveImportedMetric === "count" ? "Number of responses"
          : "% of responses";
  const importedQueryLabel = importedQueryMode === "measure" && importedMeasureField
    ? `${effectiveImportedMetric === "sum" ? "Total" : "Average"} ${importedMeasureLabel} by ${importedGroupingLabel}`
    : importedBannerField
      ? `Count responses for ${importedGroupingLabel}, broken out by ${importedFieldDisplayLabel(importedBannerField)}`
      : `Count responses for ${importedGroupingLabel}`;
  const querySummary =
    datasetMode === "seeded"
      ? `${outputMode === "table" ? "Create a table" : `Create a ${getChartTypeLabel(selectedChart)} chart`} for ${selectedQuestion.shortLabel}`
      : importedSupport.executable
        ? `${outputMode === "table" ? "Create a table" : `Create a ${getChartTypeLabel(selectedChart)} chart`} for ${importedQueryLabel} from ${importedDataset?.title ?? "imported data"}`
      : !importedDatasetHasRows
        ? "This SAV import contains labels and field metadata, but no respondent rows to analyze yet."
        : `${importedFieldDisplayLabel(importedField)} needs a supported grouping, measure, filter, or chart setup before it can be created.`;
  const modalTitle =
    datasetMode === "imported" && importedDataset
      ? importedSupport.executable
        ? `Create a ${importedOutputLabel} from ${importedDataset.title}`
        : importedField
          ? `Build analysis from ${importedFieldDisplayLabel(importedField)}`
          : "Build analysis from imported data"
      : launchContext?.launchSource === "field" && launchField
        ? `Building analysis from: ${importedFieldDisplayLabel(launchField)}`
        : "Start with a table, then design the view.";
  const modalHelper =
    datasetMode === "imported"
      ? importedField
        ? importedSupport.executable
          ? `${importedQueryLabel}. You can adjust the setup before placing it on the canvas.`
          : importedFieldSuitability?.helperText ?? "Choose a supported imported data setup."
        : "Choose a field to analyze."
      : "Choose the data source and analytical shape before placing it on the canvas.";
  const filterSummary =
    selectedFilterDimension && filterValue !== "all"
      ? `${selectedFilterDimension.label}: ${selectedFilterDimension.values.find((item) => item.id === filterValue)?.label ?? filterValue}`
      : "No filter";
  const bannerSummary = bannerDimensions.find((item) => item.id === breakBy)?.label ?? breakBy;
  const metricSummary = defaultDataset.metrics.find((item) => item.id === metric)?.label ?? metric;
  const weightSummary = weight ? defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight : "Unweighted";

  async function createOutput(mode: GuidedOutputMode) {
    if (!canCreate) return;
    const nextChartType = mode === "table" ? "table" : selectedChart;
    if (datasetMode === "imported") {
      if (!importedDataset || !importedField) return;
      const created = await addTileFromImportedDatasetField(importedDataset, importedField, nextChartType, effectiveImportedMetric, {
        measureField: importedQueryMode === "measure" ? importedMeasureField : null,
        bannerField: importedBannerField,
        filter: importedFilter
      });
      if (created) onClose();
      return;
    }
    const created = await addTileFromSourceWithVisualization(nextChartType);
    if (created) onClose();
  }

  function selectSeededQuestion(questionId: QuestionId) {
    const nextQuestion = defaultDataset.questions.find((item) => item.id === questionId);
    setQuestion(questionId);
    if (nextQuestion) applyQuestionSelection(nextQuestion);
  }

  function applyImportedRecommendation(recommendation: typeof importedRecommendations[number]) {
    setImportedQueryMode(recommendation.id === "measure" ? "measure" : "categorical");
    setImportedMetric(recommendation.metric);
    setSelectedImportedBannerFieldId(recommendation.bannerFieldId ?? "none");
    setSelectedImportedMeasureFieldId(recommendation.measureFieldId ?? "none");
    setOutputMode("chart");
    setChartType(recommendation.chartType);
  }

  return (
    <div className="guided-query-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="guided-query-modal" role="dialog" aria-modal="true" aria-label="Create data object" onMouseDown={(event) => event.stopPropagation()}>
        <header className="guided-query-header">
          <div>
            <p className="workspace-home-kicker">Guided Data Query</p>
            <h2>{modalTitle}</h2>
            <small>{modalHelper}</small>
          </div>
          <button type="button" className="guided-query-close" onClick={onClose} aria-label="Close guided data query">×</button>
        </header>

        <div className="guided-query-body">
          <section className="guided-query-step">
            <div className="guided-query-step__header">
              <span>1</span>
              <strong>Choose dataset</strong>
            </div>
            <div className="guided-query-choice-grid">
              <button type="button" className={datasetMode === "seeded" ? "active" : ""} onClick={() => setDatasetMode("seeded")}>
                <strong>EcoFocus study library</strong>
                <small>Fully queryable demo metadata with charts, tables, banners, filters, and weights.</small>
              </button>
              <button type="button" className={datasetMode === "imported" ? "active" : ""} onClick={() => setDatasetMode("imported")} disabled={!importedDatasets.length}>
                <strong>Imported workspace datasets</strong>
                <small>{importedDatasets.length ? `${importedDatasets.length} imported dataset${importedDatasets.length === 1 ? "" : "s"} available. SAV labels appear when the source file provides them.` : "Import CSV, XLSX, or SAV data to start modeling fields."}</small>
              </button>
            </div>
            {datasetMode === "imported" && importedDatasets.length > 0 && (
              <label>
                Imported dataset
                <select
                  value={importedDataset?.id ?? ""}
                  onChange={(event) => {
                    const dataset = importedDatasets.find((item) => item.id === event.target.value);
                    const primaryField = firstImportedDimensionField(dataset);
                    const measureField = firstImportedMeasureField(dataset);
                    setSelectedImportedDatasetId(event.target.value);
                    setSelectedImportedFieldId(primaryField?.id ?? "");
                    setSelectedImportedBannerFieldId("none");
                    setSelectedImportedFilterFieldId("none");
                    setSelectedImportedFilterValue("all");
                    setSelectedImportedMeasureFieldId(measureField?.id ?? "none");
                  }}
                >
                  {importedDatasets.map((dataset) => (
                    <option value={dataset.id} key={dataset.id}>{dataset.title}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section className="guided-query-step">
            <div className="guided-query-step__header">
              <span>2</span>
              <strong>Choose variable</strong>
            </div>
            {datasetMode === "seeded" ? (
              <label>
                Question / variable
                <select value={question} onChange={(event) => selectSeededQuestion(event.target.value as QuestionId)}>
                  {questionOptions.map((item) => (
                    <option value={item.id} key={item.id}>{item.shortLabel}</option>
                  ))}
                </select>
              </label>
            ) : importedDataset ? (
              <>
                <label>
                  Group responses by
                  <select
                    value={importedField?.id ?? ""}
                    onChange={(event) => {
                      setSelectedImportedFieldId(event.target.value);
                      if (event.target.value === selectedImportedBannerFieldId) setSelectedImportedBannerFieldId("none");
                    }}
                  >
                    {importedPrimaryFields.map((field) => (
                      <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                    ))}
                  </select>
                </label>
                {importedField && (
                  <div className="guided-query-variable-card">
                    <strong>{importedFieldDisplayLabel(importedField)}</strong>
                    <span>
                      {importedAnswerChoiceSummary ?? importedFieldSuitability?.readiness.bestUse ?? "Use this field for imported analysis."}
                    </span>
                    {importedFieldSuitability && (
                      <small>{importedFieldSuitability.readiness.reason}</small>
                    )}
                    {importedQuestionPrompt && (
                      <small className="guided-query-question-prompt">Question prompt: {importedQuestionPrompt}</small>
                    )}
                    {importedAnswerChoices.length > 0 && (
                      <div className="guided-query-answer-choices compact" aria-label="Imported answer choice preview">
                        <div>
                          {importedAnswerChoices.slice(0, 5).map((choice) => (
                            <span key={choice.value}>{choice.label}</span>
                          ))}
                        </div>
                        {importedAnswerChoices.length > 5 && <small>{(importedAnswerChoices.length - 5).toLocaleString()} more choices</small>}
                      </div>
                    )}
                    <details className="guided-query-field-details">
                      <summary>Field details</summary>
                      <div>
                        <small>{importedFieldTypeLabel(importedField.type)} · {importedField.distinctCount.toLocaleString()} answer value{importedField.distinctCount === 1 ? "" : "s"} · {importedDatasetMetadataQualityLabel(importedDataset)}</small>
                        {importedFieldRawNameLabel(importedField) && <small>{importedFieldRawNameLabel(importedField)}</small>}
                        <small>{importedSummary.filterLabel}. {importedSummary.bannerLabel}.</small>
                        {importedAnswerChoices.length > 0 && (
                          <div className="guided-query-answer-choices" aria-label="Imported answer choices">
                            <strong>Answer choices</strong>
                            <div>
                              {importedAnswerChoices.slice(0, 8).map((choice) => (
                                <span key={choice.value}>{choice.label}</span>
                              ))}
                            </div>
                            {importedAnswerChoices.length > 8 && <small>{(importedAnswerChoices.length - 8).toLocaleString()} more answer choices</small>}
                          </div>
                        )}
                        {importedFieldSuitability && (
                          <div className="guided-query-mini-chips">
                            {importedFieldSuitability.badges.map((badge) => (
                              <span key={badge}>{badge}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </>
            ) : (
              <div className="guided-query-unsupported">
                <strong>No imported dataset selected</strong>
                <small>Import a CSV from the workspace home or Data Library first.</small>
              </div>
            )}
          </section>

          <section className="guided-query-step">
            <div className="guided-query-step__header">
              <span>3</span>
              <strong>Shape analysis</strong>
            </div>
            <div className="guided-query-output-toggle" aria-label="Output type">
              <button type="button" className={outputMode === "table" ? "active" : ""} onClick={() => setOutputMode("table")}>Table first</button>
              <button type="button" className={outputMode === "chart" ? "active" : ""} onClick={() => setOutputMode("chart")}>Chart view</button>
            </div>
            {datasetMode === "seeded" ? (
              <>
                <div className="guided-query-field-grid">
                  <label>
                    Banner
                    <select value={breakBy} onChange={(event) => setBreakBy(event.target.value as BreakById)} disabled={comparisonMode === "wave"}>
                      {bannerDimensions
                        .filter((item) => selectedQuestion.allowedBreakBys.includes(item.id as BreakById))
                        .map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Metric
                    <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
                      {selectedQuestion.allowedMetrics.map((item) => (
                        <option value={item} key={item}>{defaultDataset.metrics.find((metricItem) => metricItem.id === item)?.label ?? item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Filter field
                    <select value={filterField ?? "none"} onChange={(event) => setFilterField(event.target.value === "none" ? null : (event.target.value as FilterFieldId))}>
                      <option value="none">No filter</option>
                      {filterDimensions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  {selectedFilterDimension ? (
                    <label>
                      Filter value
                      <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
                        <option value="all">All {selectedFilterDimension.label.toLowerCase()}s</option>
                        {selectedFilterDimension.values.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label>
                      Weight
                      <select value={weight ?? "none"} onChange={(event) => setWeight(event.target.value === "none" ? null : (event.target.value as WeightId))}>
                        <option value="none">Unweighted</option>
                        {defaultDataset.weights.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <div className="guided-query-field-grid">
                  <label>
                    Comparison
                    <select
                      value={comparisonMode}
                      onChange={(event) => {
                        const nextMode = event.target.value as "none" | "wave";
                        setComparisonMode(nextMode);
                        if (nextMode === "none") setComparisonDatasets([]);
                      }}
                    >
                      <option value="none">None</option>
                      <option value="wave">Wave comparison</option>
                    </select>
                  </label>
                  {outputMode === "chart" && (
                    <label>
                      Chart type
                      <select value={selectedChart} onChange={(event) => setChartType(event.target.value as ChartType)}>
                        {selectedChartTypes.filter((item) => item !== "table").map((item) => (
                          <option value={item} key={item}>{getChartTypeLabel(item)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {comparisonMode === "wave" && (
                  <div className="guided-query-chip-row">
                    {comparisonDatasetOptions.map((dataset) => (
                      <button
                        type="button"
                        key={dataset.id}
                        className={comparisonDatasets.includes(dataset.id) ? "active" : ""}
                        onClick={() => toggleComparisonDataset(dataset.id)}
                      >
                        {dataset.wave}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {importedField ? (
                  <>
                    {importedRecommendations.length > 0 && (
                      <div className="guided-query-recommendations" aria-label="Imported query recommendations">
                        <div className="guided-query-step__header compact">
                          <span>★</span>
                          <strong>Suggested setup</strong>
                        </div>
                        {importedRecommendations.map((recommendation) => (
                          <button
                            type="button"
                            className={recommendation.recommended && (recommendation.id === importedQueryMode || (recommendation.id === "categorical_breakout" && importedQueryMode === "categorical")) ? "guided-query-recommendation active" : "guided-query-recommendation"}
                            key={recommendation.id}
                            onClick={() => applyImportedRecommendation(recommendation)}
                          >
                            <div>
                              <strong>{recommendation.label}</strong>
                              <small>{recommendation.description}</small>
                            </div>
                            <span>{recommendation.actionLabel}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!importedDatasetHasRows && (
                      <div className="guided-query-unsupported">
                        <strong>Labels imported, but no response rows are available</strong>
                        <small>
                          {[
                            importedDataset.importStatus?.detail,
                            importedDataset.importMetadata?.parserNotes.at(-1),
                            "You can review/model the fields, but charts and tables need respondent rows. Try exporting the file as CSV/XLSX, or re-save the SAV with standard SPSS compression if this file uses an unsupported SAV variant."
                          ].filter(Boolean).join(" ")}
                        </small>
                      </div>
                    )}
                    <div className="guided-query-field-grid">
                      <label>
                        What do you want to show?
                        <select
                          value={importedQueryMode}
                          onChange={(event) => {
                            const nextMode = event.target.value as ImportedQueryMode;
                            setImportedQueryMode(nextMode);
                            setImportedMetric(nextMode === "measure" ? "average" : "percent_selected");
                            if (nextMode === "measure") setSelectedImportedMeasureFieldId(importedMeasureFields[0]?.id ?? "none");
                          }}
                        >
                          <option value="categorical">Responses for this field</option>
                          <option value="measure">Average or sum a number</option>
                        </select>
                      </label>
                      {importedQueryMode === "measure" && (
                        <label>
                          Number to average or sum
                          <select value={selectedImportedMeasureFieldId} onChange={(event) => setSelectedImportedMeasureFieldId(event.target.value)}>
                            <option value="none">Choose a numeric field...</option>
                            {importedMeasureFields.map((field) => (
                              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Optional breakout
                        <select value={selectedImportedBannerFieldId} onChange={(event) => setSelectedImportedBannerFieldId(event.target.value)}>
                          <option value="none">No breakout - all respondents</option>
                          {importedBannerFields.map((field) => (
                            <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Result values
                        <select value={effectiveImportedMetric} onChange={(event) => setImportedMetric(event.target.value as Metric)}>
                          {importedQueryMode === "measure" ? (
                            <>
                              <option value="average">Average</option>
                              <option value="sum">Sum</option>
                            </>
                          ) : (
                            <>
                            <option value="percent_selected">% of responses</option>
                            <option value="count">Number of responses</option>
                            </>
                          )}
                        </select>
                      </label>
                      {outputMode === "chart" && (
                        <label>
                          Chart type
                          <select value={selectedChart} onChange={(event) => setChartType(event.target.value as ChartType)}>
                            <option value="vertical_bar">Column</option>
                            <option value="horizontal_bar">Horizontal bar</option>
                            {!importedBannerField && importedQueryMode === "categorical" && <option value="donut">Donut</option>}
                            {importedBannerField && <option value="grouped_bar">Grouped bar</option>}
                            {importedBannerField && <option value="stacked_bar">Stacked bar</option>}
                            {importedBannerField && <option value="line_chart">Line chart</option>}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="guided-query-field-grid">
                      <label>
                        Limit to
                        <select
                          value={selectedImportedFilterFieldId}
                          onChange={(event) => {
                            setSelectedImportedFilterFieldId(event.target.value);
                            setSelectedImportedFilterValue("all");
                          }}
                        >
                          <option value="none">No filter</option>
                          {importedFilterFields.map((field) => (
                            <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                          ))}
                        </select>
                      </label>
                      {importedFilterField && (
                        <label>
                          Keep responses where
                          <select value={selectedImportedFilterValue} onChange={(event) => setSelectedImportedFilterValue(event.target.value)}>
                            <option value="all">Choose value...</option>
                            {importedFilterValues.map((value) => (
                              <option value={value} key={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className={importedSupport.executable ? "guided-query-supported" : "guided-query-unsupported"}>
                      <strong>{importedSupport.executable ? "Ready to create" : importedSupport.reason}</strong>
                      <small>{importedSupport.executable ? "This will create a normal editable table or chart on the current slide." : "Adjust the field, measure, breakout, filter, or chart type above."}</small>
                    </div>
                  </>
                ) : (
                  <div className="guided-query-unsupported">
                    <strong>Modeled-only for now.</strong>
                    <small>{importedSupport.reason}</small>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="guided-query-summary">
            <span>Summary</span>
            <strong>{querySummary}</strong>
            <ul>
              {datasetMode === "imported" && importedDataset && <li>Dataset: {importedDataset.title}</li>}
              {datasetMode === "imported" && importedQueryMode === "measure" && importedMeasureField && <li>Number: {importedMeasureLabel}</li>}
              {datasetMode === "imported" && <li>Grouped by: {importedGroupingLabel}</li>}
              {datasetMode === "imported" && <li>Values: {importedValuesLabel}</li>}
              {datasetMode === "imported" && importedBannerField && <li>{importedBannerPlainLabel(importedBannerField)}</li>}
              {datasetMode === "imported" && importedFilter && <li>Filter: {importedFieldDisplayLabel(importedFilter.field)} is {importedFilter.value}</li>}
              {datasetMode === "imported" && <li>Rows: {importedRowCount.toLocaleString()}</li>}
              {datasetMode === "seeded" && <li>Breakout: {bannerSummary}</li>}
              {datasetMode === "seeded" && <li>Filter: {filterSummary}</li>}
              {datasetMode === "seeded" && <li>Values: {metricSummary}</li>}
              {datasetMode === "seeded" && <li>Weight: {weightSummary}</li>}
            </ul>
          </aside>
        </div>

        <footer className="guided-query-footer">
          <small>{canCreate ? "The table/chart will be placed on the current slide and selected for editing." : importedSupport.reason}</small>
          <div>
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="secondary" onClick={() => void createOutput("table")} disabled={!canCreate || isLoading}>
              {isLoading && outputMode === "table" ? "Creating..." : "Create table"}
            </button>
            <button type="button" onClick={() => void createOutput("chart")} disabled={!canCreate || isLoading}>
              {isLoading && outputMode === "chart" ? "Creating..." : "Create chart"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
