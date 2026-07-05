import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImportedDatasetField } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
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
    filteredQuestions,
    savedFilters,
    savedSegmentProfiles,
    savedBanners,
    sourceSearch,
    setSourceSearch,
    applySavedBanner,
    bannerDraftName,
    setBannerDraftName,
    saveCurrentBanner,
    deleteSavedBanner,
    applySavedFilter,
    filterDraftName,
    setFilterDraftName,
    saveCurrentFilter,
    deleteSavedFilter,
    saveCurrentSegmentProfile,
    applySegmentProfile,
    deleteSegmentProfile,
    importedDatasets,
    importDataset,
    updateImportedDatasetField,
    removeImportedDataset,
    openGuidedDataQuery
  } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState<string | null>(null);
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState<string | null>(null);
  const [libraryComposer, setLibraryComposer] = useState<"filter" | "segment" | "banner" | null>(null);
  const [showFieldSetup, setShowFieldSetup] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [managedMenuKey, setManagedMenuKey] = useState<string | null>(null);
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

  useEffect(() => {
    if (!managedMenuKey) return;
    function closeManagedMenu() {
      setManagedMenuKey(null);
    }
    window.addEventListener("click", closeManagedMenu);
    window.addEventListener("keydown", closeManagedMenu);
    return () => {
      window.removeEventListener("click", closeManagedMenu);
      window.removeEventListener("keydown", closeManagedMenu);
    };
  }, [managedMenuKey]);

  function selectImportedDataset(datasetId: string) {
    const dataset = importedDatasets.find((item) => item.id === datasetId);
    setSelectedImportedDatasetId(datasetId);
    setSelectedImportedFieldId(firstImportedDimensionField(dataset)?.id ?? dataset?.fields[0]?.id ?? null);
  }

  function deleteImportedDataset(datasetId: string, title: string) {
    const shouldDelete = window.confirm(`Remove "${title}" from this workspace? Existing tiles will stay on the canvas, but the dataset will no longer appear in the Data Library.`);
    if (!shouldDelete) return;
    const remainingDatasets = importedDatasets.filter((dataset) => dataset.id !== datasetId);
    removeImportedDataset(datasetId);
    const nextDataset = remainingDatasets[0] ?? null;
    setSelectedImportedDatasetId(nextDataset?.id ?? null);
    setSelectedImportedFieldId(nextDataset ? firstImportedDimensionField(nextDataset)?.id ?? nextDataset.fields[0]?.id ?? null : null);
  }

  function toggleComposer(kind: "filter" | "segment" | "banner") {
    setLibraryComposer((current) => (current === kind ? null : kind));
  }

  function renderManagedLibraryRow(options: {
    id: string;
    kind: "filter" | "segment" | "banner";
    icon: DataLibraryIconName;
    label: string;
    onApply: () => void;
    onDelete: () => void;
  }) {
    const menuKey = `${options.kind}:${options.id}`;
    const isMenuOpen = managedMenuKey === menuKey;

    return (
      <div
        className="mockup-library-row compact managed-library-row"
        key={menuKey}
        onContextMenu={(event) => {
          event.preventDefault();
          setManagedMenuKey(menuKey);
        }}
      >
        <span><DataLibraryIcon icon={options.icon} /></span>
        <strong>{options.label}</strong>
        <button
          type="button"
          className="managed-library-row__menu-trigger"
          aria-label={`Open actions for ${options.label}`}
          aria-expanded={isMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setManagedMenuKey((current) => (current === menuKey ? null : menuKey));
          }}
        >
          ...
        </button>
        {isMenuOpen && (
          <div className="managed-library-row__menu" role="menu" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                options.onApply();
                setManagedMenuKey(null);
              }}
            >
              Apply
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                options.onDelete();
                setManagedMenuKey(null);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
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
          <button type="button" className="data-library-filter-button" aria-label="Filter data library">
            <DataLibraryIcon icon="filter" />
          </button>
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
              <div
                className={activeImportedDataset?.id === dataset.id || (!activeImportedDataset && index === 0) ? "mockup-library-row dataset-management-row active" : "mockup-library-row dataset-management-row quiet"}
                key={dataset.id}
              >
                <button
                  type="button"
                  className="library-row-main"
                  onClick={() => {
                    if (dataset.imported) selectImportedDataset(dataset.id);
                }}
              >
                  <span><DataLibraryIcon icon="dataset" /></span>
                  <div>
                    <strong>{dataset.title}</strong>
                    <small>{dataset.meta}{dataset.imported ? " · imported" : ""}</small>
                  </div>
                </button>
                {dataset.imported && (
                  <button
                    type="button"
                    className="library-row-icon-action danger"
                    onClick={() => deleteImportedDataset(dataset.id, dataset.title)}
                    aria-label={`Remove ${dataset.title}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Variables</strong>
              <button type="button" onClick={() => setShowAllFields((current) => !current)}>+</button>
            </div>
            {modeledVariables.length > 0
              ? modeledVariables.slice(0, showAllFields ? 18 : 5).map((field) => {
                const suitability = buildImportedFieldSuitability(field);
                const isSelectedForModeling = activeImportedField?.id === field.id;
                const analysisLabel = suitability.recommendedQueryMode === "measure" ? "Measure" : suitability.recommendedQueryMode === "modeling" ? "Review" : "Analyze";
                const fieldLabel = importedFieldDisplayLabel(field);
                const roleBadges = suitability.badges.filter((badge) => badge !== "Identifier").slice(0, 2);
                const shouldShowIdentifier = suitability.badges.includes("Identifier");
                return (
                  <div
                    className={isSelectedForModeling ? "mockup-library-row compact modeled-variable-row split active" : "mockup-library-row compact modeled-variable-row split"}
                    key={field.id}
                  >
                    <span><DataLibraryIcon icon="variable" /></span>
                    <div className="modeled-variable-row__body">
                      <strong>{fieldLabel}</strong>
                      <span className="data-library-badge-row">
                        <em className={`readiness ${suitability.readiness.tone}`}>{suitability.readiness.label}</em>
                        {shouldShowIdentifier && <em>Identifier</em>}
                        {roleBadges.map((badge) => (
                          <em key={badge}>{badge}</em>
                        ))}
                      </span>
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
                          setShowFieldSetup(true);
                        }}
                      >
                        {isSelectedForModeling ? "Modeling" : "Model"}
                      </button>
                    </div>
                  </div>
                );
              })
              : filteredQuestions.slice(0, 4).map((question) => (
                <button type="button" className="mockup-library-row compact" key={question.id} onClick={() => openGuidedDataQuery({ outputMode: "table" })}>
                  <span><DataLibraryIcon icon="variable" /></span>
                  <strong>{question.shortLabel}</strong>
                </button>
              ))}
            {modeledVariables.length > 5 && (
              <button type="button" className="mockup-library-link" onClick={() => setShowAllFields((current) => !current)}>
                {showAllFields ? "Show fewer fields" : `Browse variables (${modeledVariables.length})`}
              </button>
            )}
          </section>
          {activeImportedDataset && activeImportedField && activeImportedFieldView && (
            <section className="imported-variable-model-card compact-field-setup" aria-label="Imported field setup">
              <div className="imported-variable-model-card__header">
                <span>Field setup</span>
                <strong>{importedFieldDisplayLabel(activeImportedField)}</strong>
                <small>{activeImportedFieldSuitability?.readiness.label ?? "Imported field"} · {activeImportedFieldSuitability?.readiness.bestUse ?? "Ready for setup"}</small>
                <button type="button" onClick={() => setShowFieldSetup((current) => !current)}>
                  {showFieldSetup ? "Hide setup" : "Model field"}
                </button>
              </div>
              {!showFieldSetup && (
                <div className="field-setup-summary-card">
                  <span className="data-library-badge-row">
                    <em>{importedFieldTypeLabel(activeImportedField.type)}</em>
                    <em>{importedFieldRoleLabel(activeImportedField.modelingRole)}</em>
                    {activeImportedField.eligibleForFilter && <em>Filter</em>}
                    {activeImportedField.eligibleForBanner && <em>Breakout</em>}
                  </span>
                  <small>{activeImportedFieldSuitability?.readiness.reason ?? activeImportedFieldView.eligibilityLabel}</small>
                </div>
              )}
              {showFieldSetup && (
                <div className="field-setup-detail-stack">
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
                </div>
              )}
            </section>
          )}
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Filters</strong>
              <button type="button" onClick={() => toggleComposer("filter")}>+</button>
            </div>
            {activeImportedDataset
              ? importedStructureSummary.filters.slice(0, 3).map((field) => (
                <button type="button" className="mockup-library-row compact" key={field.id} onClick={() => {
                  setSelectedImportedFieldId(field.id);
                  setShowFieldSetup(true);
                }}>
                  <span><DataLibraryIcon icon="filter" /></span>
                  <strong>{importedFieldDisplayLabel(field)}</strong>
                </button>
              ))
              : savedFilters.slice(0, 3).map((filter) => renderManagedLibraryRow({
                id: filter.id,
                kind: "filter",
                icon: "filter",
                label: filter.label,
                onApply: () => applySavedFilter(filter),
                onDelete: () => deleteSavedFilter(filter.id)
              }))}
            {!activeImportedDataset && savedFilters.length === 0 && <small className="library-empty-note">No saved filters yet.</small>}
            {libraryComposer === "filter" && (
              <div className="library-management-card">
                <strong>Save current filter</strong>
                <small>Stores the current filter controls as a reusable filter.</small>
                <input value={filterDraftName} onChange={(event) => setFilterDraftName(event.target.value)} placeholder="Filter name" />
                <button type="button" onClick={saveCurrentFilter}>Save filter</button>
              </div>
            )}
            {activeImportedDataset && <small className="imported-structure-note">{importedStructureSummary.filterLabel}</small>}
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Segments</strong>
              <button type="button" onClick={() => toggleComposer("segment")}>+</button>
            </div>
            {activeImportedDataset
              ? importedStructureSummary.segments.slice(0, 3).map((field) => (
                <button type="button" className="mockup-library-row compact with-count" key={field.id} onClick={() => {
                  setSelectedImportedFieldId(field.id);
                  setShowFieldSetup(true);
                }}>
                  <span><DataLibraryIcon icon="segment" /></span>
                  <strong>{importedFieldDisplayLabel(field)}</strong>
                  <small>Modeled</small>
                </button>
              ))
              : savedSegmentProfiles.slice(0, 3).map((segment) => renderManagedLibraryRow({
                id: segment.id,
                kind: "segment",
                icon: "segment",
                label: segment.label,
                onApply: () => applySegmentProfile(segment),
                onDelete: () => deleteSegmentProfile(segment.id)
              }))}
            {!activeImportedDataset && savedSegmentProfiles.length === 0 && <small className="library-empty-note">No saved segments yet.</small>}
            {libraryComposer === "segment" && (
              <div className="library-management-card">
                <strong>Save current segment</strong>
                <small>Stores the current filter selection as a reusable segment profile.</small>
                <button type="button" onClick={saveCurrentSegmentProfile}>Save segment</button>
              </div>
            )}
            {activeImportedDataset && <small className="imported-structure-note">{importedStructureSummary.segmentLabel}</small>}
          </section>
          <section className="mockup-library-section quieter">
            <div className="mockup-library-section__header">
              <strong>Banners</strong>
              <button type="button" onClick={() => toggleComposer("banner")}>+</button>
            </div>
            {activeImportedDataset
              ? importedStructureSummary.banners.slice(0, 2).map((field) => (
                <button type="button" className="mockup-library-row compact" key={field.id} onClick={() => {
                  setSelectedImportedFieldId(field.id);
                  setShowFieldSetup(true);
                }}>
                  <span><DataLibraryIcon icon="banner" /></span>
                  <strong>{importedFieldDisplayLabel(field)}</strong>
                </button>
              ))
              : savedBanners.slice(0, 2).map((banner) => renderManagedLibraryRow({
                id: banner.id,
                kind: "banner",
                icon: "banner",
                label: banner.label,
                onApply: () => applySavedBanner(banner),
                onDelete: () => deleteSavedBanner(banner.id)
              }))}
            {!activeImportedDataset && savedBanners.length === 0 && <small className="library-empty-note">No saved banners yet.</small>}
            {libraryComposer === "banner" && (
              <div className="library-management-card">
                <strong>Save current banner</strong>
                <small>Stores the current breakout choice as a reusable banner.</small>
                <input value={bannerDraftName} onChange={(event) => setBannerDraftName(event.target.value)} placeholder="Banner name" />
                <button type="button" onClick={saveCurrentBanner}>Save banner</button>
              </div>
            )}
            {activeImportedDataset && <small className="imported-structure-note">{importedStructureSummary.bannerLabel}</small>}
          </section>
        </div>
        <button
          type="button"
          className="new-data-query-button"
          onClick={() => activeImportedDataset && activeImportedField ? openQueryForImportedField(activeImportedField) : openGuidedDataQuery({ outputMode: "table" })}
        >
          {activeImportedDataset && activeImportedField ? "Create analysis from selected field" : "＋ New data query"}
        </button>
      </div>
    </>
  );
}
