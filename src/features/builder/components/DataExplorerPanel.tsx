import { useRef, useState, type ReactNode } from "react";
import type { ImportedDatasetField } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { AnalysisLibrarySection, QueryEditorSection, SourcePickerSection } from "./DataExplorerSections";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import {
  buildImportedDatasetStructureSummary,
  buildImportedFieldModelingProfile,
  describeFieldModeling,
  importedFieldDisplayLabel,
  importedFieldRawNameLabel,
  importedFieldRoleLabel,
  importedFieldTypeLabel
} from "../../data/datasetModelingModel";
import { buildImportedFieldSuitability, firstImportedDimensionField } from "../../data/importedDatasetAnalytics";

type DataLibraryIconName = "dataset" | "variable" | "filter" | "segment" | "banner" | "chart";

function DataLibraryIcon({ icon }: { icon: DataLibraryIconName }) {
  const paths: Record<DataLibraryIconName, ReactNode> = {
    dataset: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    variable: <><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M3.5 19h17" /></>,
    filter: <><path d="M5 6h14l-5.5 6.3V18l-3 1v-6.7z" /></>,
    segment: <><path d="M12 4 20 12l-8 8-8-8z" /><circle cx="12" cy="12" r="2" /></>,
    banner: <><path d="M5 5h14v12H5z" /><path d="M8 20h8" /><path d="M12 17v3" /></>,
    chart: <><path d="M5 19V5" /><path d="M5 19h15" /><rect x="8" y="11" width="2.8" height="5" rx=".8" /><rect x="13" y="8" width="2.8" height="8" rx=".8" /><rect x="18" y="6" width="2.8" height="10" rx=".8" /></>
  };

  return (
    <svg className="data-library-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

export function DataExplorerPanel(props: AnalysisAuthoringPanelProps) {
  const {
    leftPanelView,
    exploreView,
    setExploreView,
    filteredQuestions,
    savedVariableSets,
    savedFilters,
    savedSegmentProfiles,
    savedBanners,
    savedAnalyticalTemplates,
    sourceSearch,
    setSourceSearch,
    importedDatasets,
    importDataset,
    updateImportedDatasetField,
    openGuidedDataQuery
  } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState<string | null>(null);
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState<string | null>(null);
  const savedChartRows = savedAnalyticalTemplates.length > 0
    ? savedAnalyticalTemplates.slice(0, 3).map((template) => ({
        id: template.id,
        label: template.label,
        meta: `${getChartTypeLabel(template.visualization)} · ${template.summary.sourceLabel}`,
        kind: "Template"
      }))
    : savedVariableSets.slice(0, 3).map((variableSet) => ({
        id: variableSet.id,
        label: variableSet.label,
        meta: `${variableSet.rows.length} authored rows`,
        kind: "Variable set"
      }));
  const activeImportedDataset =
    importedDatasets.find((dataset) => dataset.id === selectedImportedDatasetId) ?? importedDatasets[0];
  const datasetRows = activeImportedDataset
    ? importedDatasets.map((dataset) => ({
        id: dataset.id,
        title: dataset.title,
        meta: `${dataset.rowCount.toLocaleString()} rows · ${dataset.fieldCount} fields · ${dataset.importMetadata?.formatLabel ?? dataset.fileType.toUpperCase()}`,
        imported: true
      }))
    : [
        { id: "ecofocus_2026", title: "2026 EcoFocus Study", meta: "12,540 responses", imported: false },
        { id: "ecofocus_2024", title: "2024 EcoFocus Study", meta: "8,750 responses", imported: false }
      ];
  const modeledVariables = activeImportedDataset?.fields ?? [];
  const importedStructureSummary = buildImportedDatasetStructureSummary(activeImportedDataset);
  const activeImportedField =
    modeledVariables.find((field) => field.id === selectedImportedFieldId) ?? modeledVariables[0] ?? null;
  const activeImportedFieldView = activeImportedField ? describeFieldModeling(activeImportedField) : null;
  const activeImportedFieldSuitability = activeImportedField ? buildImportedFieldSuitability(activeImportedField) : null;
  const activeImportedFieldProfile = activeImportedField ? buildImportedFieldModelingProfile(activeImportedField) : null;

  function selectImportedDataset(datasetId: string) {
    const dataset = importedDatasets.find((item) => item.id === datasetId);
    setSelectedImportedDatasetId(datasetId);
    setSelectedImportedFieldId(firstImportedDimensionField(dataset)?.id ?? dataset?.fields[0]?.id ?? null);
  }

  function updateActiveImportedField(
    updates: Partial<Pick<ImportedDatasetField, "label" | "type" | "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner">>
  ) {
    if (!activeImportedDataset || !activeImportedField) return;
    updateImportedDatasetField(activeImportedDataset.id, activeImportedField.id, updates);
  }

  function openQueryForImportedField(field: ImportedDatasetField, outputMode: "table" | "chart" = "table") {
    if (!activeImportedDataset) return;
    setSelectedImportedFieldId(field.id);
    openGuidedDataQuery({
      outputMode,
      importedDatasetId: activeImportedDataset.id,
      importedFieldId: field.id,
      launchSource: "field"
    });
  }

  function applyModelingRecommendation(
    field: ImportedDatasetField,
    recommendation: NonNullable<ReturnType<typeof buildImportedFieldSuitability>["recommendations"][number]>,
    options?: { analyze?: boolean }
  ) {
    if (!activeImportedDataset || !recommendation.suggestedUpdates) return;
    updateImportedDatasetField(activeImportedDataset.id, field.id, recommendation.suggestedUpdates);
    setSelectedImportedFieldId(field.id);
    setExploreView("source");
    if (options?.analyze && recommendation.workflowAction) {
      window.setTimeout(() => openQueryForImportedField(field, "table"), 0);
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const imported = await importDataset(file);
      setImportFeedback(imported
        ? imported.rowCount > 0
          ? `Imported ${imported.title} with ${imported.rowCount.toLocaleString()} rows.`
          : `Imported labels for ${imported.title}, but no respondent rows were readable yet.`
        : `Could not import ${file.name}. Check the workspace status message for details.`);
      if (imported) setSelectedImportedDatasetId(imported.id);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (leftPanelView !== "data") {
    return null;
  }

  return (
    <>
      <div className="panel-title data-library-title">
        <h2>Data Library</h2>
      </div>
      <div className="data-explorer">
        <div className="data-library-search-row">
          <label className="data-library-search" aria-label="Search data library">
            <span aria-hidden="true">⌕</span>
            <input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Search data library" />
          </label>
          <button type="button" className="data-library-filter-button" onClick={() => setExploreView("source")} aria-label="Filter data library">
            <DataLibraryIcon icon="filter" />
          </button>
        </div>
        <div className="data-library-overview" aria-label="Library summary">
          <span>{activeImportedDataset ? "Imported workspace dataset" : "Survey workspace"}</span>
          <strong>{activeImportedDataset?.title ?? "EcoFocus study library"}</strong>
            <div className="data-library-overview-grid">
            <small>{activeImportedDataset ? activeImportedDataset.fieldCount : filteredQuestions.length} variables</small>
            <small>{savedVariableSets.length} variable sets</small>
            <small>{savedAnalyticalTemplates.length + savedSegmentProfiles.length} saved artifacts</small>
          </div>
          {activeImportedDataset && (
            <small className="data-library-model-note">
              {activeImportedDataset.importMetadata?.formatLabel ?? `${activeImportedDataset.fileType.toUpperCase()} import`} · {activeImportedDataset.importMetadata?.metadataQuality === "metadata_rich" ? "metadata-rich survey" : activeImportedDataset.importMetadata?.metadataQuality === "structured" ? "structured metadata" : "raw metadata"} · {activeImportedDataset.importStatus?.label ?? "Stored locally"} · {activeImportedDataset.remote?.provider ? `${activeImportedDataset.remote.provider}-backed` : "local workspace"} · imported {new Date(activeImportedDataset.importedAt).toLocaleDateString()}
            </small>
          )}
        </div>
        {activeImportedDataset && (
          <div className={`imported-dataset-health-card ${importedStructureSummary.health.statusTone}`}>
            <div className="imported-dataset-health-card__header">
              <span>Dataset model</span>
              <strong>{importedStructureSummary.health.statusLabel}</strong>
              <small>{importedStructureSummary.health.readinessScore}% of fields query-ready</small>
            </div>
            <p>{importedStructureSummary.health.guidance}</p>
            <div className="imported-dataset-health-grid">
              {importedStructureSummary.health.chips.map((chip) => (
                <small key={chip}>{chip}</small>
              ))}
            </div>
          </div>
        )}
        <div className="dataset-import-card">
          <div>
            <strong>Import dataset</strong>
            <small>Import CSV, XLSX, or classic SPSS SAV files. SAV imports preserve variable labels and value labels when available.</small>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.sav,text/csv"
            className="visually-hidden"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? "Importing..." : "Import file"}
          </button>
          {importFeedback && <small className="dataset-import-feedback">{importFeedback}</small>}
        </div>
        <div className="mockup-library-stack" aria-label="Data library overview">
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Datasets</strong>
              <button type="button" onClick={() => fileInputRef.current?.click()}>+</button>
            </div>
            {datasetRows.map((dataset, index) => (
              <button
                type="button"
                className={activeImportedDataset?.id === dataset.id || (!activeImportedDataset && index === 0) ? "mockup-library-row active" : "mockup-library-row quiet"}
                onClick={() => {
                  if (dataset.imported) selectImportedDataset(dataset.id);
                  setExploreView("source");
                }}
                key={dataset.id}
              >
                <span><DataLibraryIcon icon="dataset" /></span>
                <div>
                  <strong>{dataset.title}</strong>
                  <small>{dataset.meta}{dataset.imported ? " · imported" : ""}</small>
                </div>
              </button>
            ))}
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Variables</strong>
              <button type="button" onClick={() => setExploreView("source")}>+</button>
            </div>
            {modeledVariables.length > 0
              ? modeledVariables.slice(0, 5).map((field) => {
                const suitability = buildImportedFieldSuitability(field);
                const isSelectedForModeling = activeImportedField?.id === field.id;
                const analysisLabel = suitability.recommendedQueryMode === "measure" ? "Measure" : suitability.recommendedQueryMode === "modeling" ? "Review" : "Analyze";
                const topRecommendation = suitability.recommendations[0];
                const fieldLabel = importedFieldDisplayLabel(field);
                const rawNameLabel = importedFieldRawNameLabel(field);
                return (
                  <div
                    className={isSelectedForModeling ? "mockup-library-row compact modeled-variable-row split active" : "mockup-library-row compact modeled-variable-row split"}
                    key={field.id}
                  >
                    <span><DataLibraryIcon icon="variable" /></span>
                    <div className="modeled-variable-row__body">
                      <strong>{fieldLabel}</strong>
                      <small>{importedFieldTypeLabel(field.type)} · {suitability.helperText}</small>
                      {rawNameLabel && <small className="raw-field-name">{rawNameLabel}</small>}
                      <span className="data-library-badge-row">
                        <em className={`readiness ${suitability.readiness.tone}`}>{suitability.readiness.label}</em>
                        {suitability.badges.slice(0, 3).map((badge) => (
                          <em key={badge}>{badge}</em>
                        ))}
                      </span>
                      {suitability.readiness.tone !== "ready" && suitability.readiness.tone !== "measure" && (
                        <small className="field-readiness-reason">{suitability.readiness.recommendedAction}: {suitability.readiness.reason}</small>
                      )}
                      {topRecommendation && (
                        <small className="field-modeling-recommendation">Try: {topRecommendation.label}</small>
                      )}
                    </div>
                    <div className="modeled-variable-row__actions" aria-label={`Actions for ${fieldLabel}`}>
                      <button type="button" className="analyze" onClick={() => openQueryForImportedField(field)}>
                        {analysisLabel}
                      </button>
                      <button
                        type="button"
                        className="model"
                        onClick={() => {
                          setSelectedImportedFieldId(field.id);
                          setExploreView("source");
                        }}
                      >
                        {isSelectedForModeling ? "Modeling" : "Model"}
                      </button>
                    </div>
                  </div>
                );
              })
              : filteredQuestions.slice(0, 4).map((question) => (
                <button type="button" className="mockup-library-row compact" key={question.id} onClick={() => setExploreView("source")}>
                  <span><DataLibraryIcon icon="variable" /></span>
                  <strong>{question.shortLabel}</strong>
                </button>
              ))}
            <button type="button" className="mockup-library-link" onClick={() => setExploreView("source")}>
              Browse variables ({modeledVariables.length || filteredQuestions.length})
            </button>
            <button
              type="button"
              className="mockup-library-link primary-link"
              onClick={() => activeImportedDataset && activeImportedField ? openQueryForImportedField(activeImportedField) : openGuidedDataQuery({ outputMode: "table" })}
            >
              {activeImportedField && buildImportedFieldSuitability(activeImportedField).recommendedQueryMode === "measure" ? "Build measure view" : "Create analysis from field"}
            </button>
          </section>
          {activeImportedDataset && activeImportedField && activeImportedFieldView && (
            <section className="imported-variable-model-card" aria-label="Imported variable modeling">
              <div className="imported-variable-model-card__header">
                <span>Variable model</span>
                <strong>{importedFieldDisplayLabel(activeImportedField)}</strong>
                <small>{importedFieldRawNameLabel(activeImportedField) ?? "Imported field"}. Modeling controls how this field can be used for grouping, numbers, filters, and breakouts.</small>
              </div>
              {activeImportedFieldSuitability && (
                <div className={`imported-field-readiness-card ${activeImportedFieldSuitability.readiness.tone}`}>
                  <div>
                    <span>{activeImportedFieldSuitability.readiness.label}</span>
                    <strong>{activeImportedFieldSuitability.readiness.recommendedAction}</strong>
                  </div>
                  <p>{activeImportedFieldSuitability.readiness.reason}</p>
                  <small>Best used as: {activeImportedFieldSuitability.readiness.bestUse}</small>
                </div>
              )}
              {activeImportedFieldProfile && (
                <div className="imported-field-profile-card">
                  <div>
                    <strong>Analytical profile</strong>
                    <small>{activeImportedFieldProfile.analyticalRoleSummary}</small>
                    <small>{activeImportedFieldProfile.rawFieldSummary}</small>
                    <small>{activeImportedFieldProfile.distinctValueSummary}</small>
                    <small>{activeImportedFieldProfile.structureSummary}</small>
                    {activeImportedFieldProfile.valueLabelSummary && <small>{activeImportedFieldProfile.valueLabelSummary}</small>}
                    {activeImportedFieldProfile.dateTreatment && <small>{activeImportedFieldProfile.dateTreatment}</small>}
                  </div>
                  <span className="data-library-badge-row">
                    {activeImportedFieldProfile.chips.slice(0, 5).map((chip) => (
                      <em key={chip}>{chip}</em>
                    ))}
                  </span>
                </div>
              )}
              {activeImportedFieldSuitability && activeImportedFieldSuitability.recommendations.length > 0 && (
                <div className="imported-field-recommendations-card">
                  <div className="imported-field-recommendations-card__header">
                    <span>Recommended next step</span>
                    <strong>{activeImportedFieldSuitability.recommendations[0].label}</strong>
                  </div>
                  <div className="imported-field-recommendation-list">
                    {activeImportedFieldSuitability.recommendations.map((recommendation) => (
                      <div className="imported-field-recommendation-item" key={recommendation.id}>
                        <div>
                          <strong>{recommendation.label}</strong>
                          <small>{recommendation.description}</small>
                          <small>{recommendation.impact}</small>
                          {recommendation.workflowAction && <small className="workflow-handoff-note">{recommendation.workflowAction.description}</small>}
                        </div>
                        {recommendation.suggestedUpdates && (
                          <div className="imported-field-recommendation-actions">
                            <button
                              type="button"
                              onClick={() => {
                                applyModelingRecommendation(activeImportedField, recommendation);
                              }}
                            >
                              Apply
                            </button>
                            {recommendation.workflowAction && (
                              <button
                                type="button"
                                className="analyze"
                                onClick={() => {
                                  applyModelingRecommendation(activeImportedField, recommendation, { analyze: true });
                                }}
                              >
                                {recommendation.workflowAction.label}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label>
                Display label
                <input value={activeImportedField.label} onChange={(event) => updateActiveImportedField({ label: event.target.value })} />
              </label>
              <div className="imported-variable-model-grid">
                <label>
                  Type
                  <select
                    value={activeImportedField.type}
                    onChange={(event) => updateActiveImportedField({ type: event.target.value as ImportedDatasetField["type"] })}
                  >
                    {(["text", "numeric", "categorical", "date"] as const).map((type) => (
                      <option value={type} key={type}>{importedFieldTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select
                    value={activeImportedField.modelingRole}
                    onChange={(event) => updateActiveImportedField({ modelingRole: event.target.value as ImportedDatasetField["modelingRole"] })}
                  >
                    {(["raw_variable", "candidate_dimension", "candidate_measure", "candidate_date"] as const).map((role) => (
                      <option value={role} key={role}>{importedFieldRoleLabel(role)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="imported-modeling-preset-grid" aria-label="Field modeling presets">
                <button
                  type="button"
                  className={activeImportedField.modelingRole === "candidate_dimension" ? "active" : ""}
                  onClick={() => updateActiveImportedField({
                    type: "categorical",
                    modelingRole: "candidate_dimension",
                    eligibleForFilter: true,
                    eligibleForSegment: true,
                    eligibleForBanner: activeImportedField.distinctCount <= 12
                  })}
                >
                  <strong>Dimension</strong>
                  <small>Group, filter, segment, crosstab</small>
                </button>
                <button
                  type="button"
                  className={activeImportedField.modelingRole === "candidate_measure" ? "active" : ""}
                  onClick={() => updateActiveImportedField({
                    type: "numeric",
                    modelingRole: "candidate_measure",
                    eligibleForFilter: false,
                    eligibleForSegment: false,
                    eligibleForBanner: false
                  })}
                >
                  <strong>Measure</strong>
                  <small>Average or sum by a dimension</small>
                </button>
                <button
                  type="button"
                  className={activeImportedField.modelingRole === "raw_variable" ? "active" : ""}
                  onClick={() => updateActiveImportedField({
                    modelingRole: "raw_variable",
                    eligibleForFilter: false,
                    eligibleForSegment: false,
                    eligibleForBanner: false
                  })}
                >
                  <strong>Raw field</strong>
                  <small>Keep for reference only</small>
                </button>
                <button
                  type="button"
                  className={activeImportedField.modelingRole === "candidate_date" ? "active" : ""}
                  onClick={() => updateActiveImportedField({
                    type: "date",
                    modelingRole: "candidate_date",
                    eligibleForFilter: false,
                    eligibleForSegment: false,
                    eligibleForBanner: false
                  })}
                >
                  <strong>Date</strong>
                  <small>Preserve until date analysis</small>
                </button>
              </div>
              <div className="imported-variable-model-toggles">
                <label>
                  <input type="checkbox" checked={activeImportedField.eligibleForFilter} onChange={(event) => updateActiveImportedField({ eligibleForFilter: event.target.checked })} />
                  Filter-ready
                </label>
                <label>
                  <input type="checkbox" checked={activeImportedField.eligibleForSegment} onChange={(event) => updateActiveImportedField({ eligibleForSegment: event.target.checked })} />
                  Segment-ready
                </label>
                <label>
                  <input type="checkbox" checked={activeImportedField.eligibleForBanner} onChange={(event) => updateActiveImportedField({ eligibleForBanner: event.target.checked })} />
                  Breakout-ready
                </label>
              </div>
              <div className="imported-field-modeling-guidance">
                <strong>What these settings affect</strong>
                <small>Dimension fields can become tables, charts, filters, segments, or one-field breakouts. Measure fields can be averaged or summed by a separate dimension. Imported data still does not support weights, significance, waves, multi-filter queries, or provider-backed execution.</small>
              </div>
              <p>{activeImportedFieldView.completenessLabel}</p>
              <small>{activeImportedFieldView.eligibilityLabel}</small>
              {activeImportedFieldSuitability && <small>{activeImportedFieldSuitability.helperText}</small>}
              <small>Samples: {activeImportedFieldView.sampleLabel}</small>
            </section>
          )}
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Filters</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(activeImportedDataset
              ? importedStructureSummary.filters.slice(0, 3).map((field) => importedFieldDisplayLabel(field))
              : savedFilters.length > 0 ? savedFilters.slice(0, 3).map((filter) => filter.label) : ["Region: Global", "Age: 18–65+", "Employment: All"]).map((label) => (
              <button type="button" className="mockup-library-row compact" key={label} onClick={() => setExploreView("library")}>
                <span><DataLibraryIcon icon="filter" /></span>
                <strong>{label}</strong>
              </button>
            ))}
            {activeImportedDataset && <small className="imported-structure-note">{importedStructureSummary.filterLabel}</small>}
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Segments</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(activeImportedDataset
              ? importedStructureSummary.segments.slice(0, 3).map((field) => importedFieldDisplayLabel(field))
              : savedSegmentProfiles.length > 0 ? savedSegmentProfiles.slice(0, 3).map((segment) => segment.label) : ["Gen Z (18–27)", "Millennials (28–43)", "Parents"]).map((label, index) => (
              <button type="button" className="mockup-library-row compact with-count" key={label} onClick={() => setExploreView("library")}>
                <span><DataLibraryIcon icon="segment" /></span>
                <strong>{label}</strong>
                <small>{activeImportedDataset ? "Modeled" : [2312, 4598, 3764][index]?.toLocaleString()}</small>
              </button>
            ))}
            {activeImportedDataset && <small className="imported-structure-note">{importedStructureSummary.segmentLabel}</small>}
          </section>
          <section className="mockup-library-section quieter">
            <div className="mockup-library-section__header">
              <strong>Banners</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(activeImportedDataset
              ? importedStructureSummary.banners.slice(0, 2).map((field) => importedFieldDisplayLabel(field))
              : savedBanners.length > 0 ? savedBanners.slice(0, 2).map((banner) => banner.label) : ["Key takeaway", "Section divider"]).map((label) => (
              <button type="button" className="mockup-library-row compact" key={label} onClick={() => setExploreView("library")}>
                <span><DataLibraryIcon icon="banner" /></span>
                <strong>{label}</strong>
              </button>
            ))}
            {activeImportedDataset && <small className="imported-structure-note">{importedStructureSummary.bannerLabel}</small>}
          </section>
          <section className="mockup-library-section quieter">
            <div className="mockup-library-section__header">
              <strong>Saved charts</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {savedChartRows.map((artifact) => (
              <button type="button" className="mockup-library-row artifact" key={artifact.id} onClick={() => setExploreView("library")}>
                <span><DataLibraryIcon icon="chart" /></span>
                <div>
                  <strong>{artifact.label}</strong>
                  <small>{artifact.kind} · {artifact.meta}</small>
                </div>
              </button>
            ))}
          </section>
        </div>
        <button type="button" className="new-data-query-button" onClick={() => openGuidedDataQuery({ outputMode: "table" })}>＋ New data query</button>
        {exploreView === "analyze" && <QueryEditorSection {...props} />}
        {exploreView === "library" && <AnalysisLibrarySection {...props} />}
        {exploreView === "source" && <SourcePickerSection {...props} />}
      </div>
    </>
  );
}
