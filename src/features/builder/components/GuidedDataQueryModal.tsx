import { useMemo, useState } from "react";
import { bannerDimensions, comparisonDatasetOptions, defaultDataset, filterDimensions } from "../builderConstants";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import {
  buildImportedDatasetStructureSummary,
  importedFieldTypeLabel
} from "../../data/datasetModelingModel";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import type { BreakById, ChartType, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";

type GuidedOutputMode = "table" | "chart";

function supportedChartType(chartTypes: ChartType[]) {
  return chartTypes.find((item) => item !== "table") ?? "vertical_bar";
}

export function GuidedDataQueryModal({
  props,
  initialOutputMode = "table",
  onClose
}: {
  props: AnalysisAuthoringPanelProps;
  initialOutputMode?: GuidedOutputMode;
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
    isLoading
  } = props;
  const [datasetMode, setDatasetMode] = useState<"seeded" | "imported">(importedDatasets.length ? "imported" : "seeded");
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState(importedDatasets[0]?.id ?? "");
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState(importedDatasets[0]?.fields[0]?.id ?? "");
  const [outputMode, setOutputMode] = useState<GuidedOutputMode>(initialOutputMode);
  const importedDataset = importedDatasets.find((dataset) => dataset.id === selectedImportedDatasetId) ?? importedDatasets[0] ?? null;
  const importedField = importedDataset?.fields.find((field) => field.id === selectedImportedFieldId) ?? importedDataset?.fields[0] ?? null;
  const importedSummary = buildImportedDatasetStructureSummary(importedDataset);
  const questionOptions = useMemo(() => filteredQuestions.slice(0, 60), [filteredQuestions]);
  const selectedChart = outputMode === "table" ? "table" : chartType === "table" ? supportedChartType(selectedChartTypes) : chartType;
  const canCreate = datasetMode === "seeded";
  const querySummary =
    datasetMode === "seeded"
      ? `${outputMode === "table" ? "Create a table" : `Create a ${getChartTypeLabel(selectedChart)} chart`} for ${selectedQuestion.shortLabel}`
      : `Imported field ${importedField?.label ?? "selected variable"} is modeled, but imported-dataset query execution is not enabled yet.`;
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
    const created = await addTileFromSourceWithVisualization(nextChartType);
    if (created) onClose();
  }

  function selectSeededQuestion(questionId: QuestionId) {
    const nextQuestion = defaultDataset.questions.find((item) => item.id === questionId);
    setQuestion(questionId);
    if (nextQuestion) applyQuestionSelection(nextQuestion);
  }

  return (
    <div className="guided-query-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="guided-query-modal" role="dialog" aria-modal="true" aria-label="Create data object" onMouseDown={(event) => event.stopPropagation()}>
        <header className="guided-query-header">
          <div>
            <p className="workspace-home-kicker">Guided Data Query</p>
            <h2>Start with a table, then design the view.</h2>
            <small>Choose the data source and analytical shape before placing it on the canvas.</small>
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
                <small>{importedDatasets.length ? `${importedDatasets.length} imported dataset${importedDatasets.length === 1 ? "" : "s"} ready for modeling` : "Import a CSV to start modeling fields."}</small>
              </button>
            </div>
            {datasetMode === "imported" && importedDatasets.length > 0 && (
              <label>
                Imported dataset
                <select
                  value={importedDataset?.id ?? ""}
                  onChange={(event) => {
                    const dataset = importedDatasets.find((item) => item.id === event.target.value);
                    setSelectedImportedDatasetId(event.target.value);
                    setSelectedImportedFieldId(dataset?.fields[0]?.id ?? "");
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
                  Imported field
                  <select value={importedField?.id ?? ""} onChange={(event) => setSelectedImportedFieldId(event.target.value)}>
                    {importedDataset.fields.map((field) => (
                      <option value={field.id} key={field.id}>{field.label}</option>
                    ))}
                  </select>
                </label>
                {importedField && (
                  <div className="guided-query-variable-card">
                    <strong>{importedField.label}</strong>
                    <span>{importedFieldTypeLabel(importedField.type)} · {importedField.distinctCount.toLocaleString()} distinct values</span>
                    <small>Modeled structures: {importedSummary.filterLabel}, {importedSummary.segmentLabel}, {importedSummary.bannerLabel}</small>
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
              <div className="guided-query-unsupported">
                <strong>Imported data query execution is coming next.</strong>
                <small>This field is modeled for filters, segments, and banners, but canvas table/chart creation still uses the supported EcoFocus query engine in this pass.</small>
              </div>
            )}
          </section>

          <aside className="guided-query-summary">
            <span>Summary</span>
            <strong>{querySummary}</strong>
            <ul>
              <li>Banner: {datasetMode === "seeded" ? bannerSummary : importedSummary.bannerLabel}</li>
              <li>Filter: {datasetMode === "seeded" ? filterSummary : importedSummary.filterLabel}</li>
              <li>Metric: {datasetMode === "seeded" ? metricSummary : "Not executable yet"}</li>
              <li>Weight: {datasetMode === "seeded" ? weightSummary : "Not executable yet"}</li>
            </ul>
          </aside>
        </div>

        <footer className="guided-query-footer">
          <small>{canCreate ? "The table/chart will be placed on the current slide and selected for editing." : "Imported datasets are modeled here; execution support arrives in a later imported-query pass."}</small>
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
