import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImportedDatasetField } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import {
  buildImportedDatasetStructureSummary,
  importedFieldDisplayLabel,
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
    removeImportedDataset,
    openGuidedDataQuery
  } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState<string | null>(null);
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState<string | null>(null);
  const [libraryComposer, setLibraryComposer] = useState<"filter" | "segment" | "banner" | null>(null);
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

  function variableReadinessLabel(label: string) {
    const labels: Record<string, string> = {
      "Reference field": "ID field",
      "Ready for measure views": "Numeric",
      "Needs modeling review": "Needs review",
      "Ready for analysis": "Ready",
      "Not suitable yet": "Needs review",
      "No usable values": "No data"
    };
    return labels[label] ?? label;
  }

  function variableBadgeLabel(label: string) {
    const labels: Record<string, string> = {
      Identifier: "ID field",
      Dimension: "Group",
      Banner: "Breakout",
      "Modeling needed": "Needs review",
      "Ready for analysis": "Ready",
      "Ready for measure views": "Numeric",
      Measure: "Numeric"
    };
    return labels[label] ?? label;
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
        <div className="dataset-import-card compact-import-card">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.sav,text/csv"
            className="visually-hidden"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? "Importing..." : "Import dataset"}
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
                const fieldLabel = importedFieldDisplayLabel(field);
                const roleBadges = suitability.badges
                  .filter((badge) => !["Identifier", suitability.readiness.label].includes(badge))
                  .map(variableBadgeLabel)
                  .filter((badge, index, badges) => badges.indexOf(badge) === index)
                  .slice(0, 2);
                return (
                  <div
                    className={isSelectedForModeling ? "mockup-library-row compact modeled-variable-row split active" : "mockup-library-row compact modeled-variable-row split"}
                    key={field.id}
                  >
                    <span><DataLibraryIcon icon="variable" /></span>
                    <div className="modeled-variable-row__body">
                      <strong>{fieldLabel}</strong>
                      <span className="data-library-badge-row">
                        <em className={`readiness ${suitability.readiness.tone}`}>{variableReadinessLabel(suitability.readiness.label)}</em>
                        {roleBadges.map((badge) => (
                          <em key={badge}>{badge}</em>
                        ))}
                      </span>
                    </div>
                    <div className="modeled-variable-row__actions" aria-label={`Actions for ${fieldLabel}`}>
                      <button type="button" className="analyze" onClick={() => openQueryForImportedField(field)}>
                        Create
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
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Filters</strong>
              <button type="button" onClick={() => toggleComposer("filter")}>+</button>
            </div>
            {activeImportedDataset
              ? importedStructureSummary.filters.slice(0, 3).map((field) => (
                <button type="button" className="mockup-library-row compact" key={field.id} onClick={() => {
                  setSelectedImportedFieldId(field.id);
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
      </div>
    </>
  );
}
