import { analyticalCell } from "../../../../shared/analytics/resultCells";
import { findAnalysisPlacement, type AnalysisDestination } from "../analysisPlacement";
import { allRespondentsGroupingField, allRespondentsGroupingId } from "../../data/numericSummaryScope";
import { useEffect, useMemo, useRef, useState } from "react";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import { runMockAnalyticsQuery } from "../../../../shared/mock/analytics";
import { X } from "lucide-react";
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
  formatImportedMeasureValue,
  buildImportedQueryRecommendations,
  firstImportedDimensionField,
  firstImportedMeasureField,
  getImportedDatasetQuerySupport as getImportedExecutionSupport,
  importedDatasetHasQueryableRows,
  getImportedFilterChoiceSupport,
  isImportedFieldAnalysisCandidate,
  importedFieldValues
} from "../../data/importedDatasetAnalytics";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { importedQuerySelectionIssue } from "../../data/importedQuerySelection";
import type { AnalysisAuthoringPanelProps, GuidedDataQueryLaunchOptions } from "./AnalysisAuthoringPanel";
import type { BreakById, ChartType, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";

import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";

type GuidedOutputMode = "table" | "chart";
type ImportedQueryMode = "categorical" | "measure";
type ImportedAnalysisIntent = "responses" | "compare" | "measure";

function supportedChartType(chartTypes: ChartType[]) {
  return chartTypes.find((item) => item !== "table") ?? "vertical_bar";
}

// A field launch carries an explicit modeling choice, including same-ID updates.
// Apply it only to that study and leave the workspace's dataset/rows untouched.
function withLaunchFieldSnapshot(dataset: ImportedDatasetRecord | null, launch?: GuidedDataQueryLaunchOptions) {
  const snapshot = launch?.importedFieldSnapshot;
  if (!dataset || dataset.id !== launch?.importedDatasetId || !snapshot) return dataset;
  const exists = dataset.fields.some((field) => field.id === snapshot.id);
  return { ...dataset, fields: exists
    ? dataset.fields.map((field) => field.id === snapshot.id ? snapshot : field)
    : [snapshot, ...dataset.fields] };
}

export function GuidedDataQueryModal({
  props,
  initialOutputMode = "table",
  launchContext,
  onClose,
  onCreated
}: {
  props: AnalysisAuthoringPanelProps;
  initialOutputMode?: GuidedOutputMode;
  launchContext?: GuidedDataQueryLaunchOptions;
  onClose: () => void;
  onCreated?: (tileId: string) => void;
}) {
  const modalRef = useRef<HTMLElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const importedGroupingRef = useRef<HTMLSelectElement | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const currentPageHasRoom = useMemo(() => !props.activePage || findAnalysisPlacement(props.activePage) !== null, [props.activePage]);
  const [destination, setDestination] = useState<AnalysisDestination>(() => currentPageHasRoom ? "current_page" : "new_page");
  const destinationAvailable = destination === "new_page" || currentPageHasRoom;
  const active = useRef(true);
  const requestSequence = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; requestSequence.current += 1; }; }, []);
  function dismiss() { active.current = false; requestSequence.current += 1; onClose(); }
  useModalAccessibility(modalRef, dismiss);
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
  const launchDatasetBase = launchContext?.importedDatasetId
    ? importedDatasets.find((dataset) => dataset.id === launchContext.importedDatasetId) ?? null
    : importedDatasets[0] ?? null;
  const launchDataset = withLaunchFieldSnapshot(launchDatasetBase, launchContext);
  const launchField = launchContext?.importedFieldSnapshot ?? launchDataset?.fields.find((field) => field.id === launchContext?.importedFieldId) ?? null;
  const launchFieldSuitability = launchField ? buildImportedFieldSuitability(launchField) : null;
  const launchFieldCanDriveAnalysis = isImportedFieldAnalysisCandidate(launchField);
  const launchPrimaryField = launchFieldCanDriveAnalysis && launchFieldSuitability?.recommendedQueryMode === "categorical"
    ? launchField
    : firstImportedDimensionField(launchDataset);
  const launchMeasureField = launchFieldCanDriveAnalysis && launchFieldSuitability?.recommendedQueryMode === "measure"
    ? launchField
    : firstImportedMeasureField(launchDataset);
  const launchQueryMode: ImportedQueryMode = launchContext?.groupingScope === "all_respondents" || (launchFieldCanDriveAnalysis && launchFieldSuitability?.recommendedQueryMode === "measure") ? "measure" : "categorical";
  const [datasetMode, setDatasetMode] = useState<"seeded" | "imported">(launchContext?.importedDatasetId || importedDatasets.length ? "imported" : "seeded");
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState(launchDataset?.id ?? launchContext?.importedDatasetId ?? "");
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState(launchContext?.groupingScope === "all_respondents" ? allRespondentsGroupingId : launchContext?.importedFieldId && launchFieldSuitability?.recommendedQueryMode !== "measure"
    ? launchField?.id ?? launchContext.importedFieldId : launchPrimaryField?.id ?? "");
  const [selectedImportedBannerFieldId, setSelectedImportedBannerFieldId] = useState("none");
  const [selectedImportedFilterFieldId, setSelectedImportedFilterFieldId] = useState("none");
  const [selectedImportedFilterValue, setSelectedImportedFilterValue] = useState<string | null>(null);
  const [importedMetric, setImportedMetric] = useState<Metric>(launchQueryMode === "measure" ? "average" : "percent_selected");
  const [importedQueryMode, setImportedQueryMode] = useState<ImportedQueryMode>(launchQueryMode);
  const [selectedImportedMeasureFieldId, setSelectedImportedMeasureFieldId] = useState(launchContext?.groupingScope === "all_respondents" && launchContext.importedFieldId ? launchField?.id ?? launchContext.importedFieldId : launchMeasureField?.id ?? "none");
  const [outputMode, setOutputMode] = useState<GuidedOutputMode>(initialOutputMode);
  const importedDatasetBase = importedDatasets.find((dataset) => dataset.id === selectedImportedDatasetId) ?? null;
  const missingRequestedStudy = datasetMode === "imported" && Boolean(selectedImportedDatasetId) && !importedDatasetBase;
  const importedDataset = withLaunchFieldSnapshot(importedDatasetBase, launchContext);
  const importedSummary = buildImportedDatasetStructureSummary(importedDataset);
  const importedPrimaryFieldCandidates = importedSummary.fields.filter((field) =>
    (field.type === "categorical" || field.modelingRole === "candidate_dimension") && isImportedFieldAnalysisCandidate(field)
  );
  const importedPrimaryFields = importedPrimaryFieldCandidates.length
    ? importedPrimaryFieldCandidates
    : importedSummary.fields.filter((field) => field.type === "categorical" || field.modelingRole === "candidate_dimension");
  const groupingScope = selectedImportedFieldId === allRespondentsGroupingId ? "all_respondents" as const : undefined;
  const allRespondents = allRespondentsGroupingField(importedDataset);
  const importedField = groupingScope ? allRespondents : importedPrimaryFields.find((field) => field.id === selectedImportedFieldId) ?? null;
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
    importedFilterField && selectedImportedFilterValue !== null
      ? { field: importedFilterField, value: selectedImportedFilterValue }
      : null;
  const importedMeasureField = importedMeasureFields.find((field) => field.id === selectedImportedMeasureFieldId) ?? null;
  const importedFieldSuitability = importedField ? buildImportedFieldSuitability(importedField) : null;
  const importedRecommendations = groupingScope ? [] : buildImportedQueryRecommendations(importedDataset, importedField, {
    selectedQueryMode: importedQueryMode,
    measureField: importedMeasureField,
    bannerFields: importedBannerFields
  });
  const effectiveImportedMetric: Metric =
    importedQueryMode === "measure"
      ? importedMetric === "sum" ? "sum" : "average"
      : importedMetric === "count" ? "count" : "percent_selected";
  const questionOptions = useMemo(() => filteredQuestions.filter((item) => `${item.shortLabel} ${item.id}`.toLowerCase().includes(fieldSearch.toLowerCase()) || item.id === question), [filteredQuestions, fieldSearch, question]);
  const selectedChart = outputMode === "table"
    ? "table"
    : (importedBannerField || importedQueryMode === "measure") && chartType === "donut"
      ? "vertical_bar"
      : chartType === "table"
        ? supportedChartType(selectedChartTypes)
        : chartType;
  const filterChoiceSupport = getImportedFilterChoiceSupport(importedDataset);
  const selectionIssue = importedQuerySelectionIssue({
    grouping: { id: selectedImportedFieldId, fields: [...importedPrimaryFields, allRespondents] },
    comparison: { id: selectedImportedBannerFieldId, fields: importedBannerFields },
    filter: { id: selectedImportedFilterFieldId, fields: importedFilterFields },
    ...(importedQueryMode === "measure" ? { measure: { id: selectedImportedMeasureFieldId, fields: importedMeasureFields } } : {}),
    filterValue: selectedImportedFilterValue, filterValues: importedFilterValues, completeFilterValues: filterChoiceSupport.executable
  });
  const importedSupport = selectionIssue ? { executable: false, reason: selectionIssue }
    : importedFilterField && !filterChoiceSupport.executable
    ? filterChoiceSupport
    : importedFilterField && selectedImportedFilterValue === null
    ? { executable: false, reason: "Choose a filter value or select No filter." }
    : getImportedExecutionSupport(importedDataset, importedField, {
    groupingScope,
    bannerField: importedBannerField,
    filter: importedFilter,
    measureField: importedQueryMode === "measure" ? importedMeasureField : null,
    metric: effectiveImportedMetric,
    chartType: selectedChart
  });
  const importedDatasetHasRows = importedDatasetHasQueryableRows(importedDataset);
  const previewState = useMemo(() => {
    try {
      if (datasetMode === "seeded") return { result: runMockAnalyticsQuery({ ...props.query, chartType: selectedChart }), error: null };
      if (!importedSupport.executable || !importedDataset || !importedField || importedDataset.remote?.provider === "netlify") return { result: null, error: null };
      return { result: runImportedDatasetQuery({ dataset: importedDataset, field: importedField, groupingScope, measureField: importedQueryMode === "measure" ? importedMeasureField : null,
        bannerField: importedBannerField, filter: importedFilter, chartType: selectedChart, metric: effectiveImportedMetric }), error: null };
    } catch (error) { return { result: null, error: error instanceof Error ? error.message : "This setup could not be calculated. Check the selected fields and values." }; }
  }, [datasetMode, props.query, selectedChart, importedDataset, importedField, importedSupport.executable, importedQueryMode, importedMeasureField, importedBannerField, importedFilter, effectiveImportedMetric, groupingScope]);
  const resultPreview = previewState.result;
  const previewFailure = previewState.error;
  const canCreate = (datasetMode === "seeded" || importedSupport.executable) && !previewFailure;
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
  const importedAnalysisIntent: ImportedAnalysisIntent =
    importedQueryMode === "measure" ? "measure" : importedBannerField ? "compare" : "responses";
  const importedIntentOptions: Array<{
    id: ImportedAnalysisIntent;
    label: string;
    helper: string;
    disabled?: boolean;
  }> = [
    {
      id: "responses",
      label: "Show answers for this question",
      disabled: Boolean(groupingScope),
      helper: `Count how respondents answered ${importedGroupingLabel || "the selected field"}.`
    },
    {
      id: "compare",
      label: "Compare by a group",
      helper: importedBannerFields.length
        ? "Break the answers out by gender, segment, status, or another grouping field."
        : "This dataset needs another group field before comparison is available.",
      disabled: Boolean(groupingScope) || importedBannerFields.length === 0
    },
    {
      id: "measure",
      label: "Summarize a number",
      helper: importedMeasureFields.length
        ? "Average or total a numeric field across groups."
        : "No numeric fields are modeled as measures yet.",
      disabled: importedMeasureFields.length === 0
    }
  ];
  const querySummary =
    datasetMode === "seeded"
      ? `${outputMode === "table" ? "Create a table" : `Create a ${getChartTypeLabel(selectedChart)} chart`} for ${selectedQuestion.shortLabel}`
      : importedSupport.executable
        ? importedQueryLabel
      : !importedDatasetHasRows
        ? "The complete respondent data is unavailable. Re-import the study before analyzing."
        : `${importedFieldDisplayLabel(importedField)} needs a supported grouping, measure, filter, or chart setup before it can be created.`;
  const modalTitle =
    missingRequestedStudy ? "Study unavailable" :
    datasetMode === "imported" && importedDataset
      ? importedSupport.executable
        ? `Explore ${importedDataset.title}`
        : importedField
          ? `Build analysis from ${importedFieldDisplayLabel(importedField)}`
          : "Build analysis from imported data"
      : launchContext?.launchSource === "field" && launchField
        ? `Building analysis from: ${importedFieldDisplayLabel(launchField)}`
        : "What would you like to learn?";
  const modalHelper =
    missingRequestedStudy ? "The requested study is not available in this workspace. Choose another study explicitly or import its source file." :
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
    if (!canCreate || !destinationAvailable || creating || isLoading || !active.current) return;
    const request = ++requestSequence.current;
    const isCurrent = () => active.current && requestSequence.current === request;
    setCreating(true);
    setCreationError(null);
    try {
    const nextChartType = mode === "table"
      ? "table"
      : selectedChart === "table" ? supportedChartType(selectedChartTypes) : selectedChart;
    if (datasetMode === "imported") {
      if (!importedDataset || !importedField) return;
      const created = await addTileFromImportedDatasetField(importedDataset, importedField, nextChartType, effectiveImportedMetric, {
        destination,
        groupingScope,
        isCurrent,
        measureField: importedQueryMode === "measure" ? importedMeasureField : null,
        bannerField: importedBannerField,
        filter: importedFilter
      });
      if (!isCurrent()) return;
      if (created) { onClose(); onCreated?.(created); }
      else setCreationError("The analysis could not be created. Check the setup and try again; your selections are kept.");
      return;
    }
    const created = await addTileFromSourceWithVisualization(nextChartType, isCurrent, destination);
    if (!isCurrent()) return;
    if (created) { onClose(); onCreated?.(created); }
    else setCreationError("The analysis could not be created. Check the setup and try again; your selections are kept.");
    } catch (error) { if (isCurrent()) setCreationError(error instanceof Error ? error.message : "Analysis failed. Please try again."); }
    finally { if (isCurrent()) setCreating(false); }
  }

  async function importStudy(file: File | undefined) {
    if (!file) return;
    setImporting(true); setCreationError(null);
    try {
      const dataset = await props.importDataset(file);
      if (!dataset) { setCreationError("We couldn't import this file. Check the format and try again."); return; }
      setDatasetMode("imported");
      setSelectedImportedDatasetId(dataset.id);
      setSelectedImportedBannerFieldId("none");
      setSelectedImportedFilterFieldId("none");
      setSelectedImportedFilterValue(null);
      setSelectedImportedFieldId(firstImportedDimensionField(dataset)?.id ?? "");
      setSelectedImportedMeasureFieldId(firstImportedMeasureField(dataset)?.id ?? "none");
      setFieldSearch("");
    } catch (error) { setCreationError(error instanceof Error ? error.message : "Import failed."); }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
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

  function chooseImportedGrouping(fieldId: string) {
    setSelectedImportedFieldId(fieldId);
    if (fieldId === allRespondentsGroupingId) {
      setImportedQueryMode("measure");
      setImportedMetric("average");
    }
    if (fieldId === selectedImportedBannerFieldId) setSelectedImportedBannerFieldId("none");
  }

  function applyImportedAnalysisIntent(intent: ImportedAnalysisIntent) {
    if (intent === "responses") {
      setImportedQueryMode("categorical");
      setImportedMetric("percent_selected");
      setSelectedImportedBannerFieldId("none");
      setSelectedImportedMeasureFieldId("none");
      if (chartType === "table") setChartType("vertical_bar");
      return;
    }

    if (intent === "compare") {
      setImportedQueryMode("categorical");
      setImportedMetric("percent_selected");
      setSelectedImportedBannerFieldId(importedBannerField?.id ?? importedBannerFields[0]?.id ?? "none");
      setSelectedImportedMeasureFieldId("none");
      if (chartType === "donut" || chartType === "table") setChartType("grouped_bar");
      return;
    }

    setImportedQueryMode("measure");
    setImportedMetric("average");
    setSelectedImportedMeasureFieldId(importedMeasureField?.id ?? importedMeasureFields[0]?.id ?? "none");
    setSelectedImportedBannerFieldId(importedBannerField?.id ?? "none");
    if (chartType === "donut" || chartType === "table") setChartType("vertical_bar");
  }

  return (
    <div className="guided-query-backdrop" role="presentation" onMouseDown={dismiss}>
      <section ref={modalRef} tabIndex={-1} className="guided-query-modal" role="dialog" aria-modal="true" aria-labelledby="analysis-dialog-title" aria-describedby="analysis-dialog-helper" onMouseDown={(event) => event.stopPropagation()}>
        <header className="guided-query-header">
          <div>
            <p className="workspace-home-kicker">CREATE AN ANALYSIS</p>
            <h2 id="analysis-dialog-title">{modalTitle}</h2>
            <small id="analysis-dialog-helper">{modalHelper}</small>
          </div>
          <button type="button" className="guided-query-close" onClick={dismiss} aria-label="Close guided data query"><X className="modal-close-icon" aria-hidden="true" strokeWidth={2} /></button>
        </header>

        <div className="guided-query-body">
          <section className="guided-query-step">
            <div className="guided-query-step__header">
              <span>1</span>
              <strong>Choose dataset</strong>
            </div>
            <div className="guided-query-choice-grid">
              <button type="button" className={datasetMode === "seeded" ? "active" : ""} onClick={() => setDatasetMode("seeded")}>
                <strong>Explore the sample study</strong>
                <small>Illustrative EcoFocus data for learning the tools. Not your imported research.</small>
              </button>
              <button type="button" className={datasetMode === "imported" ? "active" : ""} onClick={() => importedDatasets.length ? setDatasetMode("imported") : importRef.current?.click()}>
                <strong>{importedDatasets.length ? "Your imported studies" : "Import your study"}</strong>
                <small>{importedDatasets.length ? `${importedDatasets.length} imported dataset${importedDatasets.length === 1 ? "" : "s"} available. SAV labels appear when the source file provides them.` : "Import CSV, XLSX, or SAV data to start modeling fields."}</small>
              </button>
            </div>
            <input ref={importRef} type="file" accept=".csv,.xlsx,.sav" hidden aria-label="Import study file" onChange={(event) => void importStudy(event.target.files?.[0])} />
            <button type="button" className="guided-import-action" disabled={importing} onClick={() => importRef.current?.click()}>{importing ? "Importing study…" : "Import CSV, Excel or SPSS"}</button>
            {missingRequestedStudy && <p role="alert">The requested study is unavailable. No replacement study has been selected.</p>}
            {datasetMode === "imported" && importedDataset && selectionIssue && <p role="alert">{selectionIssue}</p>}
            {datasetMode === "imported" && importedDatasets.length > 0 && (
              <label>
                Imported dataset
                <select
                  value={importedDataset?.id ?? ""}
                  onChange={(event) => {
                    const dataset = withLaunchFieldSnapshot(importedDatasets.find((item) => item.id === event.target.value) ?? null, launchContext);
                    const primaryField = firstImportedDimensionField(dataset);
                    const measureField = firstImportedMeasureField(dataset);
                    setSelectedImportedDatasetId(event.target.value);
                    setSelectedImportedFieldId(primaryField?.id ?? "");
                    setSelectedImportedBannerFieldId("none");
                    setSelectedImportedFilterFieldId("none");
                    setSelectedImportedFilterValue(null);
                    setSelectedImportedMeasureFieldId(measureField?.id ?? "none");
                  }}
                >
                  {!importedDataset && <option value="" disabled>Choose an available study...</option>}
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
            <label className="guided-field-search">Find a question or field<input type="search" placeholder="Search by question, label or field name" value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} /></label>
            {fieldSearch && <p className="field-search-help" role="status">Your selected question stays available while you search. <button type="button" onClick={() => setFieldSearch("")}>Clear field search</button></p>}
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
                    ref={importedGroupingRef}
                    value={importedField?.id ?? ""}
                    onChange={(event) => chooseImportedGrouping(event.target.value)}
                  >
                    {!importedField && <option value="" disabled>Choose an available grouping field...</option>}
                    <option value={allRespondentsGroupingId}>All respondents (numeric summary)</option>
                    {importedPrimaryFields.filter((field) => field.id === importedField?.id || `${importedFieldDisplayLabel(field)} ${field.sourceColumn}`.toLowerCase().includes(fieldSearch.toLowerCase())).map((field) => (
                      <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                    ))}
                  </select>
                </label>
                {groupingScope && <div className="guided-query-variable-card"><strong>All respondents</strong>
                  <span>Summarize the selected number across the study, with any chosen filter.</span>
                  <small>Only valid numeric values contribute to the result and its sample base.</small></div>}
                {importedField && !groupingScope && (
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
            <div className="guided-query-placement">
          <label>Place analysis
            <select value={destination} disabled={creating} onChange={(event) => setDestination(event.target.value as AnalysisDestination)}>
              <option value="current_page" disabled={!currentPageHasRoom}>Current page{currentPageHasRoom ? "" : " — no room"}</option>
              <option value="new_page">New page</option>
            </select>
          </label>
          {!currentPageHasRoom && <p>This page has no clear space for a full-size analysis. A new page keeps existing objects in place.</p>}
          {!destinationAvailable && <p role="alert">Choose a new page or make space on the current page before creating this analysis.</p>}
            </div>
            <div className="guided-query-output-toggle" aria-label="Output type">
              <button type="button" aria-pressed={outputMode === "table"} className={outputMode === "table" ? "active" : ""} onClick={() => setOutputMode("table")}>Table</button>
              <button type="button" aria-pressed={outputMode === "chart"} className={outputMode === "chart" ? "active" : ""} onClick={() => setOutputMode("chart")}>Chart</button>
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
                    {!importedDatasetHasRows && (
                      <div className="guided-query-unsupported">
                        <strong>Labels imported, but no response rows are available</strong>
                        <small>
                          {[
                            importedDataset?.importStatus?.detail,
                            importedDataset?.importMetadata?.parserNotes.at(-1),
                            "You can review/model the fields, but charts and tables need respondent rows. Try exporting the file as CSV/XLSX, or re-save the SAV with standard SPSS compression if this file uses an unsupported SAV variant."
                          ].filter(Boolean).join(" ")}
                        </small>
                      </div>
                    )}
                    <div className="guided-query-intent-grid" aria-label="What to show">
                      {importedIntentOptions.map((intent) => (
                        <button
                          type="button"
                          key={intent.id}
                          className={importedAnalysisIntent === intent.id ? "active" : ""}
                          disabled={intent.disabled}
                          onClick={() => applyImportedAnalysisIntent(intent.id)}
                        >
                          <strong>{intent.label}</strong>
                          <small>{intent.helper}</small>
                        </button>
                      ))}
                    </div>
                    <div className="guided-query-field-grid">
                      {importedQueryMode === "measure" && (
                        <label>
                          Number to summarize
                          <select value={selectedImportedMeasureFieldId} onChange={(event) => setSelectedImportedMeasureFieldId(event.target.value)}>
                            <option value="none">Choose a numeric field...</option>
                            {selectedImportedMeasureFieldId !== "none" && !importedMeasureField && <option value={selectedImportedMeasureFieldId} disabled>Unavailable numeric field</option>}
                    {importedMeasureFields.filter((field) => field.id === importedMeasureField?.id || `${importedFieldDisplayLabel(field)} ${field.sourceColumn}`.toLowerCase().includes(fieldSearch.toLowerCase())).map((field) => (
                              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {importedAnalysisIntent === "compare" && (
                        <label>
                          Compare by
                          <select value={selectedImportedBannerFieldId} onChange={(event) => setSelectedImportedBannerFieldId(event.target.value)}>
                            {selectedImportedBannerFieldId !== "none" && !importedBannerField && <option value={selectedImportedBannerFieldId} disabled>Unavailable comparison field</option>}
                            {importedBannerFields.map((field) => (
                              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <details className="guided-query-analysis-details">
                      <summary>Analysis details</summary>
                      <div className="guided-query-field-grid">
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
                        {importedAnalysisIntent !== "compare" && (
                          <label>
                            Optional comparison group
                            <select value={selectedImportedBannerFieldId} onChange={(event) => setSelectedImportedBannerFieldId(event.target.value)}>
                              <option value="none">No group - all respondents</option>
                              {selectedImportedBannerFieldId !== "none" && !importedBannerField && <option value={selectedImportedBannerFieldId} disabled>Unavailable comparison field</option>}
                              {importedBannerFields.map((field) => (
                                <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                              ))}
                            </select>
                          </label>
                        )}
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
                        <label>
                          Limit to
                          <select
                            value={selectedImportedFilterFieldId}
                            onChange={(event) => {
                              setSelectedImportedFilterFieldId(event.target.value);
                              setSelectedImportedFilterValue(null);
                            }}
                          >
                            <option value="none">No filter</option>
                            {selectedImportedFilterFieldId !== "none" && !importedFilterField && <option value={selectedImportedFilterFieldId} disabled>Unavailable filter field</option>}
                            {importedFilterFields.map((field) => (
                              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
                            ))}
                          </select>
                        </label>
                        {importedFilterField && (
                          <label>
                            Keep responses where
                            <select disabled={!filterChoiceSupport.executable} value={selectedImportedFilterValue ?? ""} onChange={(event) => setSelectedImportedFilterValue(event.target.value || null)}>
                              <option value="">Choose value...</option>
                              {selectedImportedFilterValue !== null && filterChoiceSupport.executable && !importedFilterValues.includes(selectedImportedFilterValue) && <option value={selectedImportedFilterValue} disabled>Unavailable value: {selectedImportedFilterValue}</option>}
                              {importedFilterValues.map((value) => (
                                <option value={value} key={value}>{value}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </details>
                    {importedRecommendations.length > 0 && (
                      <details className="guided-query-analysis-details">
                        <summary>Suggested setups</summary>
                        <div className="guided-query-recommendations" aria-label="Imported query recommendations">
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
                      </details>
                    )}
                    <div className={canCreate ? "guided-query-supported" : "guided-query-unsupported"}>
                      <strong>{canCreate ? "Ready to create" : previewFailure ?? importedSupport.reason}</strong>
                      <small>{canCreate ? `This will create a normal editable table or chart on ${destination === "new_page" ? "a new page" : "the current page"}.` : "Adjust the field, measure, breakout, filter, or chart type above."}</small>
                    </div>
                  </>
                ) : (
                  <div className="guided-query-unsupported">
                    <strong>{importedField ? "Modeled-only for now." : "Choose what to analyze"}</strong>
                    <small>{importedSupport.reason}</small>
                    {!importedField && importedPrimaryFieldCandidates.length === 0 && importedMeasureFieldCandidates.length > 0 && importedDataset?.remote?.provider !== "netlify" && <>
                      <small>This study has numeric fields. Summarize a number across all respondents, then review the calculation before creating it.</small>
                      <button type="button" onClick={() => { chooseImportedGrouping(allRespondentsGroupingId); importedGroupingRef.current?.focus(); }}>Summarize all respondents</button>
                    </>}
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="guided-query-summary">
            <span>YOUR ANALYSIS</span>
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
            <section className="analysis-result-preview" aria-label="Analysis result preview">
              <h3>Result preview</h3>
              {resultPreview ? <>
                <p>{datasetMode === "seeded" ? "Illustrative sample results" : "Calculated from your complete imported study"} · {resultPreview.metric.label}</p>
                <div className="analysis-preview-scroll"><table><thead><tr><th scope="col">Answer</th>{resultPreview.columns.slice(0, 3).map((column) => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead>
                  <tbody>{resultPreview.table.slice(0, 6).map((row) => <tr key={row.optionId}><th scope="row">{row.label}</th>{resultPreview.columns.slice(0, 3).map((column) => <td key={column.id}>{analyticalCell(resultPreview, row, column.id).value === null ? "Unavailable" : resultPreview.metric.valueFormat === "number" ? formatImportedMeasureValue(row.values[column.id], resultPreview.metric.id) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(row.values[column.id])}{resultPreview.metric.valueFormat === "percent" ? "%" : ""}{datasetMode === "imported" && groupingScope && <small> (n={row.bases[column.id] ?? 0} valid values)</small>}</td>)}</tr>)}</tbody></table></div>
                <small>Showing up to 6 answers and 3 groups. The complete result is placed on the page. Numeric results retain calculation precision; displayed values may be rounded.</small>
                {resultPreview.warnings.length > 0 && <ul aria-label="Analysis data quality notices">{resultPreview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              </> : previewFailure ? <p role="alert">{previewFailure}</p> : <p>{importedDataset?.remote?.provider === "netlify" ? "This study is queried securely on the server when you create the analysis." : "Choose a supported question and calculation to preview the results."}</p>}
            </section>
          </aside>
        </div>

        <footer className="guided-query-footer">
          {creating && <p role="status">Closing will ignore this analysis result; the request may finish in the background.</p>}
          {isLoading && !creating && <p role="status">A data request is still finishing. Your setup is kept; creation will be available when it settles.</p>}
          {(creationError || props.error) && <p role="alert" className="analysis-create-error">{creationError || props.error}</p>}
          <small>{canCreate ? `The table/chart will be placed on ${destination === "new_page" ? "a new page" : "the current page"} and selected for editing.` : previewFailure ?? importedSupport.reason}</small>
          <div>
            <button type="button" className="secondary" onClick={dismiss}>Cancel</button>
            <button type="button" onClick={() => void createOutput(outputMode)} disabled={!canCreate || !destinationAvailable || isLoading || creating || importing}>
              {creating ? "Creating analysis..." : isLoading ? "Waiting for data request" : `${outputMode === "table" ? "Create table" : "Create chart"}${destination === "new_page" ? " on new page" : ""}`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
