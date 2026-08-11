import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import {
  buildImportedDatasetStructureSummary,
  importedFieldDisplayLabel,
} from "../../data/datasetModelingModel";
import { normalizeDatasetSourceRefForImportedDataset } from "../../data/datasetSourceRegistry";
import { buildImportedFieldSuitability, firstImportedDimensionField } from "../../data/importedDatasetAnalytics";
import { buildLiveDatasetSourceReadinessView } from "../../data/liveDatasetSourceModel";
import { listImportedDatasetFieldsFromNetlify } from "../../data/netlifyDatasetStore";
import { makeWorkspaceHomePath } from "../../document/workspacePersistence";

type DataLibraryIconName = "dataset" | "variable" | "filter" | "segment" | "banner" | "chart";
type LibrarySectionId = "connected" | "datasets" | "suggested" | "fields" | "filters" | "segments" | "banners";
const VARIABLE_TREE_ROW_HEIGHT = 28;
const VARIABLE_TREE_VIEWPORT_HEIGHT = 360;
const VARIABLE_TREE_OVERSCAN = 8;
const REMOTE_FIELD_PAGE_SIZE = 120;

type VariableTreeEntry =
  | { type: "group"; id: string; label: string }
  | { type: "field"; id: string; field: ImportedDatasetField }
  | { type: "loading"; id: string; index: number };

function importedVariableGroupLabel(field: ImportedDatasetField) {
  const source = field.sourceColumn || field.label;
  const label = importedFieldDisplayLabel(field);
  const questionMatch = source.match(/^([A-Za-z]+[0-9]+)[A-Za-z0-9_]*/);
  if (questionMatch) return questionMatch[1].toUpperCase();
  const prefixMatch = source.match(/^([A-Za-z]{2,})/);
  if (prefixMatch) return prefixMatch[1].replace(/([a-z])([A-Z])/g, "$1 $2");
  return label.split(/[\s:_-]+/)[0] || "Fields";
}

function compactVariableRoleLabel(field: ImportedDatasetField) {
  if (field.modelingRole === "candidate_measure" || field.type === "numeric") return "Numeric";
  if (field.modelingRole === "candidate_dimension" || field.type === "categorical") return "Group";
  if (field.modelingRole === "candidate_date" || field.type === "date") return "Date";
  return "Raw";
}

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
    liveDatasetSources,
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
  const variableTreeFrameRef = useRef<number | null>(null);
  const variableTreePendingScrollTopRef = useRef(0);
  const remoteFieldLoadingPagesRef = useRef(new Set<number>());
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportedDatasetId, setSelectedImportedDatasetId] = useState<string | null>(null);
  const [selectedImportedFieldId, setSelectedImportedFieldId] = useState<string | null>(null);
  const [libraryComposer, setLibraryComposer] = useState<"filter" | "segment" | "banner" | null>(null);
  const [variableTreeScrollTop, setVariableTreeScrollTop] = useState(0);
  const [remoteFieldPages, setRemoteFieldPages] = useState<Record<number, ImportedDatasetField[]>>({});
  const [remoteFieldTotal, setRemoteFieldTotal] = useState<number | null>(null);
  const [remoteFieldError, setRemoteFieldError] = useState<string | null>(null);
  const [managedMenuKey, setManagedMenuKey] = useState<string | null>(null);
  const [libraryMode, setLibraryMode] = useState<"guided" | "browse">("guided");
  const [expandedLibrarySections, setExpandedLibrarySections] = useState<Record<LibrarySectionId, boolean>>({
    connected: true,
    datasets: true,
    suggested: true,
    fields: false,
    filters: false,
    segments: false,
    banners: false
  });
  const activeImportedDataset =
    importedDatasets.find((dataset) => dataset.id === selectedImportedDatasetId) ?? importedDatasets[0];
  const datasetRows = activeImportedDataset
    ? importedDatasets.map((dataset) => ({
        id: dataset.id,
        title: dataset.title,
        meta: `${dataset.rowCount.toLocaleString()} rows · ${dataset.fieldCount} fields · ${dataset.importMetadata?.formatLabel ?? dataset.fileType.toUpperCase()}`,
        sourceLabel: normalizeDatasetSourceRefForImportedDataset(dataset).kind === "workspace_database" ? "workspace database" : "file import",
        imported: true
      }))
    : [
        { id: "ecofocus_2026", title: "2026 EcoFocus Study", meta: "12,540 responses", sourceLabel: "demo source", imported: false },
        { id: "ecofocus_2024", title: "2024 EcoFocus Study", meta: "8,750 responses", sourceLabel: "demo source", imported: false }
      ];
  const modeledVariables = activeImportedDataset?.fields ?? [];
  const usesRemoteFieldPaging = activeImportedDataset?.remote?.provider === "netlify";
  const variableSearchTerm = sourceSearch.trim().toLowerCase();
  const remoteLoadedFields = useMemo(() => Object.values(remoteFieldPages).flat(), [remoteFieldPages]);
  const filteredModeledVariables = useMemo(() => {
    if (usesRemoteFieldPaging) return remoteLoadedFields;
    if (!variableSearchTerm) return modeledVariables;
    return modeledVariables.filter((field) => {
      const searchableText = [
        importedFieldDisplayLabel(field),
        field.label,
        field.variableLabel,
        field.sourceColumn,
        field.sourceFormat
      ].filter(Boolean).join(" ").toLowerCase();
      return searchableText.includes(variableSearchTerm);
    });
  }, [modeledVariables, remoteLoadedFields, usesRemoteFieldPaging, variableSearchTerm]);
  const variableTreeEntries = useMemo<VariableTreeEntry[]>(() => {
    if (usesRemoteFieldPaging) {
      const total = remoteFieldTotal ?? activeImportedDataset?.fieldCount ?? 0;
      return Array.from({ length: total }, (_, index) => {
        const pageIndex = Math.floor(index / REMOTE_FIELD_PAGE_SIZE);
        const field = remoteFieldPages[pageIndex]?.[index - pageIndex * REMOTE_FIELD_PAGE_SIZE];
        return field
          ? { type: "field", id: field.id, field }
          : { type: "loading", id: `loading:${index}`, index };
      });
    }
    if (variableSearchTerm) return filteredModeledVariables.map((field) => ({ type: "field", id: field.id, field }));
    const entries: VariableTreeEntry[] = [];
    let currentGroup = "";
    filteredModeledVariables.forEach((field) => {
      const group = importedVariableGroupLabel(field);
      if (group !== currentGroup) {
        currentGroup = group;
        entries.push({ type: "group", id: `group:${group}:${entries.length}`, label: group });
      }
      entries.push({ type: "field", id: field.id, field });
    });
    return entries;
  }, [activeImportedDataset?.fieldCount, filteredModeledVariables, remoteFieldPages, remoteFieldTotal, usesRemoteFieldPaging, variableSearchTerm]);
  const variableTreeTotalHeight = variableTreeEntries.length * VARIABLE_TREE_ROW_HEIGHT;
  const variableTreeStartIndex = Math.max(0, Math.floor(variableTreeScrollTop / VARIABLE_TREE_ROW_HEIGHT) - VARIABLE_TREE_OVERSCAN);
  const variableTreeEndIndex = Math.min(
    variableTreeEntries.length,
    variableTreeStartIndex + Math.ceil(VARIABLE_TREE_VIEWPORT_HEIGHT / VARIABLE_TREE_ROW_HEIGHT) + VARIABLE_TREE_OVERSCAN * 2
  );
  const visibleVariableTreeEntries = variableTreeEntries.slice(variableTreeStartIndex, variableTreeEndIndex);
  const importedStructureSummary = useMemo(() => buildImportedDatasetStructureSummary(activeImportedDataset), [activeImportedDataset]);
  const activeImportedField =
    [...remoteLoadedFields, ...modeledVariables].find((field) => field.id === selectedImportedFieldId) ?? remoteLoadedFields[0] ?? modeledVariables[0] ?? null;
  const activeImportedFieldSuitability = useMemo(
    () => activeImportedField ? buildImportedFieldSuitability(activeImportedField) : null,
    [activeImportedField]
  );
  const isBrowsingLibrary = libraryMode === "browse" || Boolean(variableSearchTerm);
  const isSectionExpanded = (sectionId: LibrarySectionId) =>
    sectionId === "fields" && variableSearchTerm ? true : expandedLibrarySections[sectionId];

  function toggleLibrarySection(sectionId: LibrarySectionId) {
    setExpandedLibrarySections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  function openLibraryFolder(sectionId: LibrarySectionId) {
    setLibraryMode("browse");
    setExpandedLibrarySections((current) => ({ ...current, [sectionId]: true }));
  }

  function openComposerFolder(sectionId: "filters" | "segments" | "banners", composer: "filter" | "segment" | "banner") {
    openLibraryFolder(sectionId);
    toggleComposer(composer);
  }

  function returnToSimpleLibrary() {
    setLibraryMode("guided");
    setExpandedLibrarySections((current) => ({
      ...current,
      suggested: true,
      fields: false,
      filters: false,
      segments: false,
      banners: false
    }));
  }

  function renderLibraryAccordionHeader({
    sectionId,
    icon,
    title,
    detail,
    action
  }: {
    sectionId: LibrarySectionId;
    icon: DataLibraryIconName;
    title: string;
    detail?: string;
    action?: ReactNode;
  }) {
    const expanded = isSectionExpanded(sectionId);
    return (
      <div className="mockup-library-section__header data-library-accordion-header">
        <button
          type="button"
          className="data-library-accordion-trigger"
          onClick={() => toggleLibrarySection(sectionId)}
          aria-expanded={expanded}
        >
          <span className="data-library-accordion-chevron">›</span>
          <span className="data-library-folder-icon"><DataLibraryIcon icon={icon} /></span>
          <span>
            <strong>{title}</strong>
            {detail && <small>{detail}</small>}
          </span>
        </button>
        {action}
      </div>
    );
  }

  function importStatusDetail(dataset: ImportedDatasetRecord) {
    const detail = dataset.importStatus?.detail ?? "";
    const databaseNoteIndex = detail.indexOf("Database note:");
    return databaseNoteIndex >= 0 ? detail.slice(databaseNoteIndex) : "";
  }

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

  useEffect(() => {
    setVariableTreeScrollTop(0);
    setRemoteFieldPages({});
    setRemoteFieldTotal(null);
    setRemoteFieldError(null);
    remoteFieldLoadingPagesRef.current.clear();
  }, [activeImportedDataset?.id, variableSearchTerm]);

  useEffect(() => {
    if (!usesRemoteFieldPaging || !activeImportedDataset) return;
    const startPage = Math.floor(variableTreeStartIndex / REMOTE_FIELD_PAGE_SIZE);
    const endPage = Math.floor(Math.max(variableTreeEndIndex - 1, 0) / REMOTE_FIELD_PAGE_SIZE);
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex += 1) {
      if (remoteFieldPages[pageIndex] || remoteFieldLoadingPagesRef.current.has(pageIndex)) continue;
      remoteFieldLoadingPagesRef.current.add(pageIndex);
      void listImportedDatasetFieldsFromNetlify({
        datasetId: activeImportedDataset.id,
        offset: pageIndex * REMOTE_FIELD_PAGE_SIZE,
        limit: REMOTE_FIELD_PAGE_SIZE,
        search: variableSearchTerm
      }).then((result) => {
        setRemoteFieldTotal(result.total);
        setRemoteFieldPages((current) => ({ ...current, [pageIndex]: result.fields }));
        setRemoteFieldError(null);
      }).catch((error) => {
        setRemoteFieldError(error instanceof Error ? error.message : "Unable to load imported fields.");
      }).finally(() => {
        remoteFieldLoadingPagesRef.current.delete(pageIndex);
      });
    }
  }, [activeImportedDataset, remoteFieldPages, usesRemoteFieldPaging, variableSearchTerm, variableTreeEndIndex, variableTreeStartIndex]);

  useEffect(() => {
    return () => {
      if (variableTreeFrameRef.current !== null) cancelAnimationFrame(variableTreeFrameRef.current);
    };
  }, []);

  function handleVariableTreeScroll(scrollTop: number) {
    variableTreePendingScrollTopRef.current = scrollTop;
    if (variableTreeFrameRef.current !== null) return;
    variableTreeFrameRef.current = requestAnimationFrame(() => {
      variableTreeFrameRef.current = null;
      setVariableTreeScrollTop(variableTreePendingScrollTopRef.current);
    });
  }

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
      importedFieldSnapshot: field,
      launchSource: "field"
    });
  }

  function openWorkspaceHome() {
    window.location.hash = makeWorkspaceHomePath().replace(/^#/, "");
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const imported = await importDataset(file);
      const statusDetail = imported ? importStatusDetail(imported) : "";
      setImportFeedback(imported
        ? imported.rowCount > 0
          ? `Imported ${imported.title} with ${imported.rowCount.toLocaleString()} rows.${statusDetail ? ` ${statusDetail}` : ""}`
          : `Imported labels for ${imported.title}, but no respondent rows were readable yet.${statusDetail ? ` ${statusDetail}` : ""}`
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
          <button
            type="button"
            className="secondary"
            onClick={() => setImportFeedback("Database connections are planned from Workspace Home. Use Import dataset here for local files.")}
          >
            Connect database
          </button>
          {importFeedback && <small className="dataset-import-feedback">{importFeedback}</small>}
        </div>
        <section className="data-library-start-card" aria-label="Study start">
          <div className="data-library-start-card__header">
            <span><DataLibraryIcon icon="dataset" /></span>
            <div>
              <strong>{activeImportedDataset ? activeImportedDataset.title : "Start with your study"}</strong>
              <small>
                {activeImportedDataset
                  ? `${activeImportedDataset.rowCount.toLocaleString()} rows · ${activeImportedDataset.fieldCount.toLocaleString()} fields`
                  : "Import data or create a guided table from the EcoFocus study library."}
              </small>
            </div>
          </div>
          <div className="data-library-start-actions">
            <button type="button" onClick={() => activeImportedField ? openQueryForImportedField(activeImportedField, "table") : openGuidedDataQuery({ outputMode: "table" })}>
              <DataLibraryIcon icon="chart" />
              Create first table
            </button>
            <button type="button" onClick={() => activeImportedField ? openQueryForImportedField(activeImportedField, "chart") : openGuidedDataQuery({ outputMode: "chart" })}>
              <DataLibraryIcon icon="chart" />
              Create chart
            </button>
            <button type="button" onClick={() => openLibraryFolder("fields")}>
              <DataLibraryIcon icon="variable" />
              Browse all fields
            </button>
          </div>
          <p>
            Use the guided query flow first. Open the full field library when you need a specific variable, filter, segment, or banner.
          </p>
        </section>
        <div className="mockup-library-stack" aria-label="Data library overview">
          {liveDatasetSources.length > 0 && (
            <section className={isSectionExpanded("connected") ? "mockup-library-section data-library-accordion open" : "mockup-library-section data-library-accordion"}>
              {renderLibraryAccordionHeader({
                sectionId: "connected",
                icon: "dataset",
                title: "Connected sources",
                detail: `${liveDatasetSources.length} registered`,
                action: <button type="button" onClick={openWorkspaceHome} aria-label="Manage connected sources">↗</button>
              })}
              {isSectionExpanded("connected") && (
                <div className="data-library-section-body">
                  {liveDatasetSources.map((source) => {
                    const readiness = buildLiveDatasetSourceReadinessView(source);
                    return (
                      <article className={`data-library-live-source-row ${source.status}`} key={source.sourceRef.id}>
                        <span><DataLibraryIcon icon="dataset" /></span>
                        <div>
                          <strong>{source.label}</strong>
                          <small>{readiness.statusLabel} · {source.syncMode === "live_query" ? "Live query" : "Snapshot"} · {source.objectType}</small>
                          <em>{source.objectPath}</em>
                          <b>{readiness.structureLabel}</b>
                          <p>{readiness.readinessNote}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!readiness.canCreateQuery}
                          title={readiness.readinessNote}
                        >
                          {readiness.actionLabel}
                        </button>
                      </article>
                    );
                  })}
                  <small className="library-empty-note">
                    Registered sources are workspace-managed. Query creation unlocks after provider-specific dataset mapping is connected.
                  </small>
                </div>
              )}
            </section>
          )}
          <section className={isSectionExpanded("datasets") ? "mockup-library-section data-library-accordion open" : "mockup-library-section data-library-accordion"}>
            {renderLibraryAccordionHeader({
              sectionId: "datasets",
              icon: "dataset",
              title: "Datasets",
              detail: `${datasetRows.length} available`,
              action: <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Import dataset">+</button>
            })}
            {isSectionExpanded("datasets") && (
              <div className="data-library-section-body">
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
                        <small>{dataset.meta} · {dataset.sourceLabel}</small>
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
              </div>
            )}
          </section>
          {!isBrowsingLibrary && (
            <section className={isSectionExpanded("suggested") ? "mockup-library-section data-library-accordion data-library-suggested-section open" : "mockup-library-section data-library-accordion data-library-suggested-section"}>
              {renderLibraryAccordionHeader({
                sectionId: "suggested",
                icon: "chart",
                title: "Suggested next steps",
                detail: "Fast starts"
              })}
              {isSectionExpanded("suggested") && (
                <div className="data-library-section-body">
                  {activeImportedDataset ? (
                    <>
                  {activeImportedField && (
                    <button type="button" className="data-library-suggestion-card" onClick={() => openQueryForImportedField(activeImportedField)}>
                      <span><DataLibraryIcon icon="chart" /></span>
                      <strong>Create analysis from selected field</strong>
                      <small>{importedFieldDisplayLabel(activeImportedField)}</small>
                    </button>
                  )}
                  <button type="button" className="data-library-suggestion-card" onClick={() => openLibraryFolder("fields")}>
                    <span><DataLibraryIcon icon="variable" /></span>
                    <strong>Browse the full study library</strong>
                    <small>{activeImportedDataset.fieldCount.toLocaleString()} fields, filters, segments, and banners.</small>
                  </button>
                    </>
                  ) : (
                    <>
                  <button type="button" className="data-library-suggestion-card" onClick={() => openGuidedDataQuery({ outputMode: "table" })}>
                    <span><DataLibraryIcon icon="chart" /></span>
                    <strong>Create a plain table</strong>
                    <small>Start with numbers before styling a story section.</small>
                  </button>
                  <button type="button" className="data-library-suggestion-card" onClick={() => fileInputRef.current?.click()}>
                    <span><DataLibraryIcon icon="dataset" /></span>
                    <strong>Import a study dataset</strong>
                    <small>Bring in CSV, XLSX, or SAV data.</small>
                  </button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
          {isBrowsingLibrary && (
            <section className={isSectionExpanded("fields") ? "mockup-library-section data-library-accordion open" : "mockup-library-section data-library-accordion"}>
            {renderLibraryAccordionHeader({
              sectionId: "fields",
              icon: "variable",
              title: "Fields",
              detail: usesRemoteFieldPaging
                ? `${(remoteFieldTotal ?? activeImportedDataset?.fieldCount ?? 0).toLocaleString()} fields`
                : variableSearchTerm
                ? `${filteredModeledVariables.length.toLocaleString()} matches`
                : `${modeledVariables.length.toLocaleString()} fields`,
              action: (
                <div className="data-library-browse-tools">
                  <button type="button" onClick={returnToSimpleLibrary}>Simple view</button>
                </div>
              )
            })}
            {isSectionExpanded("fields") && (
              <>
              {modeledVariables.length > 0
              ? variableTreeEntries.length > 0
                ? (
                  <>
                    <div
                      className="variable-tree-viewport"
                      style={{ height: Math.min(VARIABLE_TREE_VIEWPORT_HEIGHT, Math.max(VARIABLE_TREE_ROW_HEIGHT * variableTreeEntries.length, VARIABLE_TREE_ROW_HEIGHT)) }}
                      onScroll={(event) => handleVariableTreeScroll(event.currentTarget.scrollTop)}
                    >
                      <div className="variable-tree-spacer" style={{ height: variableTreeTotalHeight }}>
                        {visibleVariableTreeEntries.map((entry, index) => {
                          const top = (variableTreeStartIndex + index) * VARIABLE_TREE_ROW_HEIGHT;
                          if (entry.type === "group") {
                            return (
                              <div className="variable-tree-group" key={entry.id} style={{ top }}>
                                {entry.label}
                              </div>
                            );
                          }

                          if (entry.type === "loading") {
                            return (
                              <div className="variable-tree-row loading" key={entry.id} style={{ top }}>
                                <div className="variable-tree-row__select">
                                  <span><DataLibraryIcon icon="variable" /></span>
                                  <strong>Loading field...</strong>
                                  <em>Remote</em>
                                </div>
                              </div>
                            );
                          }

                          const field = entry.field;
                          const isSelectedForModeling = activeImportedField?.id === field.id;
                          const fieldLabel = importedFieldDisplayLabel(field);

                          return (
                            <div
                              className={isSelectedForModeling ? "variable-tree-row active" : "variable-tree-row"}
                              key={field.id}
                              style={{ top }}
                            >
                              <button type="button" className="variable-tree-row__select" onClick={() => setSelectedImportedFieldId(field.id)} onDoubleClick={() => openQueryForImportedField(field)}>
                                <span><DataLibraryIcon icon="variable" /></span>
                                <strong>{fieldLabel}</strong>
                                <em>{compactVariableRoleLabel(field)}</em>
                              </button>
                              <button type="button" className="variable-tree-row__create" onClick={() => openQueryForImportedField(field)}>
                                Create
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {remoteFieldError && <small className="library-empty-note">{remoteFieldError}</small>}
                    {activeImportedField && activeImportedFieldSuitability && (
                      <div className="variable-tree-detail-card">
                        <span>Selected field</span>
                        <strong>{importedFieldDisplayLabel(activeImportedField)}</strong>
                        <small>{activeImportedFieldSuitability.readiness.label} · {activeImportedFieldSuitability.readiness.bestUse}</small>
                        <button type="button" onClick={() => openQueryForImportedField(activeImportedField)}>Create analysis</button>
                      </div>
                    )}
                  </>
                )
                : <small className="library-empty-note">No variables match this search.</small>
              : filteredQuestions.slice(0, 4).map((question) => (
                <button type="button" className="mockup-library-row compact" key={question.id} onClick={() => openGuidedDataQuery({ outputMode: "table" })}>
                  <span><DataLibraryIcon icon="variable" /></span>
                  <strong>{question.shortLabel}</strong>
                </button>
              ))}
              </>
            )}
            </section>
          )}
          {isBrowsingLibrary && (
            <section className={isSectionExpanded("filters") ? "mockup-library-section data-library-accordion open" : "mockup-library-section data-library-accordion"}>
            {renderLibraryAccordionHeader({
              sectionId: "filters",
              icon: "filter",
              title: "Filters",
              detail: activeImportedDataset ? importedStructureSummary.filterLabel : `${savedFilters.length} saved`,
              action: <button type="button" onClick={() => openComposerFolder("filters", "filter")} aria-label="Add filter">+</button>
            })}
            {isSectionExpanded("filters") && (
              <div className="data-library-section-body">
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
              </div>
            )}
            </section>
          )}
          {isBrowsingLibrary && (
            <section className={isSectionExpanded("segments") ? "mockup-library-section data-library-accordion open" : "mockup-library-section data-library-accordion"}>
            {renderLibraryAccordionHeader({
              sectionId: "segments",
              icon: "segment",
              title: "Segments",
              detail: activeImportedDataset ? importedStructureSummary.segmentLabel : `${savedSegmentProfiles.length} saved`,
              action: <button type="button" onClick={() => openComposerFolder("segments", "segment")} aria-label="Add segment">+</button>
            })}
            {isSectionExpanded("segments") && (
              <div className="data-library-section-body">
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
              </div>
            )}
            </section>
          )}
          {isBrowsingLibrary && (
            <section className={isSectionExpanded("banners") ? "mockup-library-section quieter data-library-accordion open" : "mockup-library-section quieter data-library-accordion"}>
            {renderLibraryAccordionHeader({
              sectionId: "banners",
              icon: "banner",
              title: "Breakouts",
              detail: activeImportedDataset ? importedStructureSummary.bannerLabel : `${savedBanners.length} saved`,
              action: <button type="button" onClick={() => openComposerFolder("banners", "banner")} aria-label="Add breakout">+</button>
            })}
            {isSectionExpanded("banners") && (
              <div className="data-library-section-body">
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
              </div>
            )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
