import { useState } from "react";
import type React from "react";
import { getChartTypeLabel, getCompatibleChartTypes } from "../../analytics/analyticsDisplay";
import { buildImportedResultProvenance, getImportedDatasetQuerySupport, importedFieldValues } from "../../data/importedDatasetAnalytics";
import { runImportedDatasetQueryForRuntime } from "../../data/importedDatasetRuntimeQuery";
import { importedFieldDisplayLabel } from "../../data/datasetModelingModel";
import type { ChartType, ConfidenceLevel, Metric } from "../../../../shared/types/analytics";
import type { BuilderInspectorProps } from "./BuilderInspector";
import {
  buildSettingProvenancePickerView,
  buildSettingProvenanceRows,
  updatesForSavedBanner,
  updatesForSavedFilter,
  updatesForSavedWeight,
  type SettingProvenanceEmptyState,
  type SettingProvenanceOption,
  type SettingProvenanceRow
} from "./inspectorSettingProvenanceModel";
import {
  buildDerivedObjectFreshnessView,
  buildIndependentDerivedContractView,
  buildRelatedObjectNavigationCueView,
  buildRelatedAnalyticalObjectsView,
  type DerivedObjectFreshnessView,
  type IndependentDerivedContractView,
  type RelatedAnalyticalObjectRow,
  type RelatedAnalyticalObjectsView
} from "./inspectorRelatedObjectsModel";
import { buildInspectorTileSummary } from "./inspectorTileSummaryModel";
import {
  buildDerivedOutputDetailView,
  buildDerivedDefinitionFromTile,
  buildDerivedDefinitionProvenanceView,
  buildDerivedDefinitionRecreationCueView,
  buildDerivedOutputLibraryActionCueView,
  buildDerivedOutputRecreationCueView,
  buildDerivedOutputViews,
  type DerivedOutputConfig,
  type DerivedOutputDetailView,
  type DerivedDefinitionProvenanceView,
  type DerivedDefinitionRecreationCueView,
  type DerivedOutputLibraryActionCueView,
  type DerivedOutputRecreationCueView,
  type DerivedOutputView
} from "./derivedOutputModel";
import {
  buildDerivedOutputCreationCueView,
  buildSavedLibraryInsertionCueView,
  type DerivedOutputCreationCueView,
  type SavedLibraryInsertionCueView
} from "./inspectorCreationCueModel";
import {
  buildSavedTileSettingConfirmation,
  buildTileQueryActionState,
  buildTileQueryStatus,
  type SavedTileSettingConfirmation,
  type SavedTileSettingKind
} from "./inspectorTileQueryModel";
import {
  TileComparisonControls,
  TileFilterWeightControls,
  TileQueryActions,
  TileQuestionConfigSection
} from "./InspectorTileQuerySections";
import { buildReportTreeSelectionCueView } from "./reportTreeSelectionCueModel";
import { AnalysisWeightDiagnosticsCard } from "./AnalysisWeightDiagnosticsCard";
import {
  buildAnalysisContextDiagnosticsSummary,
  buildAnalysisWeightDiagnostics,
  buildSavedVariableSetBannerMismatch,
  buildSavedVariableSetFilterMismatch,
  buildSavedVariableSetWeightMismatch
} from "./analysisWeightDiagnosticsModel";
import { buildSegmentProfileProvenanceView, type SegmentProfileProvenanceView } from "./libraryReuseModel";
import { buildAnalysisStatisticsContext, confidenceLevelLabel, supportedConfidenceLevels, type AnalysisStatisticsContextView } from "./analysisStatisticsContextModel";
import { buildExecutedSignificanceExplanationView, type ExecutedSignificanceExplanationView } from "./analysisSignificancePresentationModel";
import { buildCompositionStarterProvenanceHelper } from "./compositionBlockModel";
import type { DashboardTile, ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";

export function TileAnalysisResultSection(props: BuilderInspectorProps) {
  const {
    activePage,
    selectedTile,
    updateSelectedTile,
    selectTile,
    savedLibraryInsertionCue,
    relatedObjectNavigationCue,
    recordRelatedObjectNavigationCue,
    reportTreeSelectionCue,
    derivedOutputCreationCue,
    derivedOutputRecreationCue,
    derivedDefinitionRecreationCue,
    derivedOutputLibraryActionCue,
    duplicateDerivedOutputTile,
    createDerivedOutputTile,
    recreateDerivedOutputTile,
    saveDerivedDefinition,
    onViewSavedSettingInLibrary,
    saveSelectedTileAnalyticalTemplate
  } = props;
  const [rowDifferenceConfig, setRowDifferenceConfig] = useState<DerivedOutputConfig>({});

  if (!selectedTile) {
    return null;
  }
  const summary = buildInspectorTileSummary(selectedTile);
  const relatedObjects = buildRelatedAnalyticalObjectsView(selectedTile, activePage.tiles);
  const navigationCue = buildRelatedObjectNavigationCueView(relatedObjectNavigationCue, selectedTile);
  const reportTreeCue = buildReportTreeSelectionCueView(reportTreeSelectionCue, selectedTile, "tile");
  const savedLibraryCue = buildSavedLibraryInsertionCueView(savedLibraryInsertionCue, selectedTile);
  const segmentProvenance = buildSegmentProfileProvenanceView(selectedTile, props.savedSegmentProfiles);
  const derivedOutputCue = buildDerivedOutputCreationCueView(derivedOutputCreationCue, selectedTile);
  const derivedOutputRecreation = buildDerivedOutputRecreationCueView(derivedOutputRecreationCue, selectedTile);
  const derivedDefinitionRecreation = buildDerivedDefinitionRecreationCueView(derivedDefinitionRecreationCue, selectedTile);
  const derivedOutputLibraryAction = buildDerivedOutputLibraryActionCueView(derivedOutputLibraryActionCue, selectedTile);
  const derivedOutputDetail = buildDerivedOutputDetailView(selectedTile, activePage.tiles);
  const derivedDefinitionProvenance = buildDerivedDefinitionProvenanceView(selectedTile, props.savedDerivedDefinitions);
  const derivedOutputViews = buildDerivedOutputViews(selectedTile, rowDifferenceConfig);
  const independentContractCue = buildIndependentDerivedContractView(selectedTile);
  const freshnessCue = buildDerivedObjectFreshnessView(selectedTile, activePage.tiles);
  const weightDiagnostics = buildAnalysisWeightDiagnostics(selectedTile.query.weight);
  const sourceVariableSet = props.savedVariableSets.find((item) => selectedTile.source?.kind === "variableSet" && item.id === selectedTile.source.id) ?? null;
  const weightMismatch = sourceVariableSet
    ? buildSavedVariableSetWeightMismatch({
      savedWeight: sourceVariableSet.weight,
      currentWeight: selectedTile.query.weight,
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;
  const activeFilter = selectedTile.query.filters[0];
  const filterMismatch = sourceVariableSet
    ? buildSavedVariableSetFilterMismatch({
      savedFilterField: sourceVariableSet.filterField,
      savedFilterValue: sourceVariableSet.filterValue,
      currentFilterField: activeFilter?.field ?? null,
      currentFilterValue: activeFilter?.values[0] ?? "all",
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;
  const bannerMismatch = sourceVariableSet
    ? buildSavedVariableSetBannerMismatch({
      savedBreakBy: sourceVariableSet.breakBy,
      currentBreakBy: selectedTile.query.breakBy,
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;
  const contextMismatches = [weightMismatch, filterMismatch, bannerMismatch];
  const contextSummary = sourceVariableSet
    ? buildAnalysisContextDiagnosticsSummary({
      mismatches: contextMismatches,
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;

  function selectRelatedObject(item: RelatedAnalyticalObjectRow) {
    if (!selectedTile) return;
    recordRelatedObjectNavigationCue({
      tileId: item.id,
      fromTileId: selectedTile.id,
      fromTitle: selectedTile.title || selectedTile.name,
      targetTitle: item.title,
      relationship: item.relationship
    });
    selectTile(item.id);
  }

  return (
    <>
              <div className="panel-title subtle">
                <h2>Content</h2>
              </div>
              <label>
                Title
                <input value={selectedTile.title} onChange={(event) => updateSelectedTile({ title: event.target.value })} />
              </label>
              <div className="panel-title subtle">
                <h2>Selected object</h2>
              </div>
              <div className="inspector-summary-card tile-handoff-card">
                <span className="inspector-summary-kicker">{summary.sourceKind}</span>
                <strong>{summary.title}</strong>
                <p>{summary.subtitle}</p>
                <div className="tile-handoff-source">
                  <span>{summary.sourceLabel}</span>
                  <small>{summary.sourceDescription}</small>
                </div>
                <div className="tile-handoff-source lifecycle">
                  <span>{summary.lifecycleLabel}</span>
                  <small>{summary.lifecycleDescription}</small>
                </div>
                <AnalysisWeightDiagnosticsCard view={weightDiagnostics} mismatches={contextMismatches} mismatchSummary={contextSummary} />
                {savedLibraryCue && <SavedLibraryInsertionCueCard view={savedLibraryCue} />}
                {segmentProvenance && <SegmentProfileProvenanceCard view={segmentProvenance} />}
                {derivedOutputCue && <DerivedOutputCreationCueCard view={derivedOutputCue} />}
                {derivedOutputRecreation && <DerivedOutputRecreationCueCard view={derivedOutputRecreation} />}
                {derivedDefinitionRecreation && <DerivedDefinitionRecreationCueCard view={derivedDefinitionRecreation} />}
                {derivedOutputLibraryAction && <DerivedOutputLibraryActionCueCard view={derivedOutputLibraryAction} />}
                {derivedDefinitionProvenance && <DerivedDefinitionProvenanceCard view={derivedDefinitionProvenance} />}
                {selectedTile.compositionBlock && (
                  <CompositionBlockTileProvenanceCard
                    label={selectedTile.compositionBlock.label}
                    helper={buildCompositionStarterProvenanceHelper(selectedTile.compositionBlock, "tile")}
                  />
                )}
                {derivedOutputDetail && (
                  <DerivedOutputDetailCard
                    view={derivedOutputDetail}
                    onSelectSource={(tileId) => selectTile(tileId)}
                    onRecreate={() => recreateDerivedOutputTile(selectedTile)}
                    onDuplicate={() => duplicateDerivedOutputTile(selectedTile)}
                    onSaveTemplate={saveSelectedTileAnalyticalTemplate}
                  />
                )}
                {reportTreeCue && <ReportTreeSelectionCueCard view={reportTreeCue} />}
                <details className="inspector-disclosure">
                  <summary>
                    <span>Derived outputs</span>
                    <small>{derivedOutputViews.filter((view) => view.canCreate).length} available</small>
                  </summary>
                  <div className="derived-output-actions">
                    {derivedOutputViews.map((view) => (
                      <DerivedOutputCard
                        key={view.kind}
                        view={view}
                        onConfigChange={view.kind === "row_difference" || view.kind === "row_average" ? setRowDifferenceConfig : undefined}
                        onCreate={(config) => createDerivedOutputTile(selectedTile, view.kind, { config })}
                        onSaveDefinition={(config) => {
                          const definition = buildDerivedDefinitionFromTile(selectedTile, view.kind, config);
                          if (!definition) return;
                          saveDerivedDefinition(definition);
                          onViewSavedSettingInLibrary("derivedOutputs", { action: "derivedDefinitionSaved", itemId: definition.id });
                        }}
                      />
                    ))}
                  </div>
                </details>
                <div className="explorer-chip-row">
                  {summary.lifecycleChips.map((chip) => (
                    <span className="explorer-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                {independentContractCue && <IndependentDerivedContractCue view={independentContractCue} />}
                {navigationCue && (
                  <div className="related-navigation-cue" role="status">
                    <strong>{navigationCue.label}</strong>
                    <span>{navigationCue.message}</span>
                    <small>{navigationCue.helper}</small>
                  </div>
                )}
                {freshnessCue && <DerivedObjectFreshnessCue view={freshnessCue} />}
                <div className="explorer-chip-row">
                  {summary.chips.map((chip) => (
                    <span className="explorer-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                <details className="inspector-disclosure subtle">
                  <summary>
                    <span>Related analytical objects</span>
                    <small>{relatedObjects.rows.length} relationships</small>
                  </summary>
                  <RelatedAnalyticalObjectsCard view={relatedObjects} onSelectRelatedObject={selectRelatedObject} />
                </details>
                <small className="tile-handoff-cue">{summary.editCue}</small>
              </div>
    </>
  );
}

function DerivedOutputCard({
  view,
  onConfigChange,
  onCreate,
  onSaveDefinition
}: {
  view: DerivedOutputView;
  onConfigChange?: (config: DerivedOutputConfig) => void;
  onCreate: (config?: DerivedOutputConfig) => string | null;
  onSaveDefinition: (config?: DerivedOutputConfig) => void;
}) {
  const isRowMetric = view.kind === "row_difference" || view.kind === "row_average";
  const currentConfig: DerivedOutputConfig | undefined = isRowMetric
    ? {
        rowId: view.selectedRowId,
        comparedRowId: view.selectedComparedRowId,
        columnId: view.selectedColumnId
      }
    : undefined;
  const updateConfig = (updates: DerivedOutputConfig) => {
    onConfigChange?.({
      ...currentConfig,
      ...updates
    });
  };

  return (
    <div className={view.canCreate ? "derived-summary-output-card" : "derived-summary-output-card disabled"}>
      <div>
        <strong>{view.label}</strong>
        <span>{view.helper}</span>
        {view.canCreate && view.rowLabel && (
          <small>{[view.rowLabel, view.valueLabel, view.baseLabel, view.rowCountLabel].filter(Boolean).join(" · ")}</small>
        )}
      </div>
      {isRowMetric && view.canCreate && (
        <div className="row-difference-config">
          <label>
            Row
            <select value={view.selectedRowId ?? ""} onChange={(event) => updateConfig({ rowId: event.target.value })}>
              {view.rowOptions?.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            {view.kind === "row_average" ? "Averaged row" : "Minus row"}
            <select value={view.selectedComparedRowId ?? ""} onChange={(event) => updateConfig({ comparedRowId: event.target.value })}>
              {view.rowOptions?.map((option) => (
                <option value={option.id} key={option.id} disabled={option.id === view.selectedRowId}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Column
            <select value={view.selectedColumnId ?? ""} onChange={(event) => updateConfig({ columnId: event.target.value })}>
              {view.columnOptions?.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {isRowMetric && view.metricPreview && (
        <div className="row-difference-preview">
          <div>
            <span>Formula</span>
            <strong>{view.metricPreview.formulaLabel}</strong>
          </div>
          <div>
            <span>Column</span>
            <strong>{view.metricPreview.columnLabel}</strong>
          </div>
          <div>
            <span>Source values</span>
            <strong>{view.metricPreview.leftValueLabel}</strong>
            <strong>{view.metricPreview.rightValueLabel}</strong>
          </div>
          <div>
            <span>Result</span>
            <strong>{view.metricPreview.resultLabel}</strong>
          </div>
          <small>{view.metricPreview.baseContextLabel}</small>
          <small>{view.metricPreview.helper}</small>
        </div>
      )}
      <div className="derived-output-card-actions">
        <button type="button" className="secondary" onClick={() => onCreate(currentConfig)} disabled={!view.canCreate}>
          {view.kind === "top_n_extract"
            ? "Create top-N extract"
            : view.kind === "bottom_n_extract"
              ? "Create bottom-N extract"
              : isRowMetric
                ? "Create metric output"
                : "Create summary output"}
        </button>
        <button type="button" className="secondary" onClick={() => onSaveDefinition(currentConfig)} disabled={!view.canCreate}>
          {isRowMetric ? "Save metric definition" : "Save definition"}
        </button>
      </div>
    </div>
  );
}

function SavedLibraryInsertionCueCard({ view }: { view: SavedLibraryInsertionCueView }) {
  return (
    <div className="saved-library-insertion-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function SegmentProfileProvenanceCard({ view }: { view: SegmentProfileProvenanceView }) {
  return (
    <div className={`segment-profile-provenance-card ${view.status}`}>
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
      <div className="explorer-chip-row">
        {view.chips.map((chip) => (
          <span className={view.status === "matches" ? "explorer-chip" : "explorer-chip warning-chip"} key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function DerivedOutputCreationCueCard({ view }: { view: DerivedOutputCreationCueView }) {
  return (
    <div className="derived-output-creation-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function DerivedOutputRecreationCueCard({ view }: { view: DerivedOutputRecreationCueView }) {
  return (
    <div className="derived-output-recreation-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function DerivedDefinitionRecreationCueCard({ view }: { view: DerivedDefinitionRecreationCueView }) {
  return (
    <div className="derived-definition-recreation-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function DerivedDefinitionProvenanceCard({ view }: { view: DerivedDefinitionProvenanceView }) {
  return (
    <div className={`derived-definition-provenance-card ${view.status}`}>
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
      <div className="explorer-chip-row">
        {view.chips.map((chip) => (
          <span className={view.status === "matches" ? "explorer-chip" : "explorer-chip warning-chip"} key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function DerivedOutputLibraryActionCueCard({ view }: { view: DerivedOutputLibraryActionCueView }) {
  return (
    <div className="derived-output-library-action-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function DerivedOutputDetailCard({
  view,
  onSelectSource,
  onRecreate,
  onDuplicate,
  onSaveTemplate
}: {
  view: DerivedOutputDetailView;
  onSelectSource: (tileId: string) => void;
  onRecreate: () => boolean;
  onDuplicate: () => string | null;
  onSaveTemplate: () => void;
}) {
  return (
    <div className={`derived-output-detail-card ${view.sourceStatus}`} aria-label="Derived output relationship">
      <strong>{view.label}</strong>
      <span>Source tile: {view.sourceLabel}</span>
      <span>{view.sourceStatusLabel}</span>
      <span>{view.readinessLabel}</span>
      <small>{view.description}</small>
      <small>{view.sourceStatusHelper}</small>
      <small>{view.readinessHelper}</small>
      {view.lastRecreatedLabel && <small>{view.lastRecreatedLabel}</small>}
      <small>{view.managementHelper}</small>
      <div className="explorer-chip-row">
        {view.chips.map((chip) => (
          <span className="explorer-chip" key={chip}>{chip}</span>
        ))}
      </div>
      <div className="derived-output-detail-actions">
        {view.sourceTileId && (
          <>
          <button type="button" className="secondary" onClick={() => onSelectSource(view.sourceTileId!)}>
            Go to source tile
          </button>
          <button type="button" className="secondary" onClick={onRecreate} disabled={!view.canRecreate}>
            Recreate from source
          </button>
          </>
        )}
        <button type="button" className="secondary" onClick={onDuplicate}>
          Duplicate derived output
        </button>
        <button type="button" className="secondary" onClick={onSaveTemplate}>
          Save as template
        </button>
      </div>
    </div>
  );
}

function ReportTreeSelectionCueCard({ view }: { view: ReturnType<typeof buildReportTreeSelectionCueView> }) {
  if (!view) return null;

  return (
    <div className="report-tree-selection-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function CompositionBlockTileProvenanceCard({ label, helper }: { label: string; helper: string }) {
  return (
    <div className="composition-provenance-card">
      <span>Reusable content</span>
      <strong>{label}</strong>
      <small>{helper}</small>
    </div>
  );
}

function IndependentDerivedContractCue({ view }: { view: IndependentDerivedContractView }) {
  return (
    <div className="independent-derived-contract-cue" aria-label="Independent derived view contract">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function DerivedObjectFreshnessCue({ view }: { view: DerivedObjectFreshnessView }) {
  return (
    <div className={`derived-freshness-cue ${view.status}`} aria-label="Derived object freshness">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function RelatedAnalyticalObjectsCard({
  view,
  onSelectRelatedObject
}: {
  view: RelatedAnalyticalObjectsView;
  onSelectRelatedObject: (item: RelatedAnalyticalObjectRow) => void;
}) {
  return (
    <div className="related-objects-card" aria-label="Related analytical objects">
      <div className="explorer-section-header">
        <strong>{view.label}</strong>
        <small>{view.description}</small>
      </div>
      {view.rows.length > 0 ? (
        <div className="related-objects-list">
          {view.rows.map((item) => (
            <button type="button" className="related-object-row" key={item.id} onClick={() => onSelectRelatedObject(item)}>
              <span>{item.title}</span>
              <small>{item.description}</small>
              <div className="explorer-chip-row">
                {item.badges.map((badge) => (
                  <span className="explorer-chip" key={badge}>{badge}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <small className="tile-handoff-cue">{view.emptyLabel}</small>
      )}
    </div>
  );
}

function importedExecutableFields(dataset: ImportedDatasetRecord | null) {
  return (dataset?.fields ?? []).filter((field) => field.type === "categorical" || field.modelingRole === "candidate_dimension");
}

function importedBannerFields(dataset: ImportedDatasetRecord | null, primaryFieldId: string) {
  return (dataset?.fields ?? []).filter((field) =>
    field.id !== primaryFieldId && field.eligibleForBanner && (field.type === "categorical" || field.modelingRole === "candidate_dimension")
  );
}

function importedFilterFields(dataset: ImportedDatasetRecord | null) {
  return (dataset?.fields ?? []).filter((field) =>
    field.eligibleForFilter && (field.type === "categorical" || field.modelingRole === "candidate_dimension")
  );
}

function importedMeasureFields(dataset: ImportedDatasetRecord | null) {
  return (dataset?.fields ?? []).filter((field) => field.type === "numeric" || field.modelingRole === "candidate_measure");
}

function ImportedTileQueryEditor({
  tile,
  importedDatasets,
  updateSelectedTile,
  isLoading
}: {
  tile: DashboardTile;
  importedDatasets: ImportedDatasetRecord[];
  updateSelectedTile: (updates: Partial<DashboardTile>) => void;
  isLoading: boolean;
}) {
  const source = tile.result.metadataRefs.source?.kind === "imported" ? tile.result.metadataRefs.source : null;
  const initialDataset = importedDatasets.find((dataset) => dataset.id === source?.datasetId) ?? importedDatasets[0] ?? null;
  const [datasetId, setDatasetId] = useState(source?.datasetId ?? initialDataset?.id ?? "");
  const dataset = importedDatasets.find((item) => item.id === datasetId) ?? initialDataset;
  const [primaryFieldId, setPrimaryFieldId] = useState(source?.primaryFieldId ?? dataset?.fields[0]?.id ?? "");
  const [bannerFieldId, setBannerFieldId] = useState(source?.bannerFieldId ?? "none");
  const [filterFieldId, setFilterFieldId] = useState(source?.filterFieldId ?? "none");
  const [filterValue, setFilterValue] = useState(source?.filterValue ?? "all");
  const [metric, setMetric] = useState<Metric>(tile.result.metric.id);
  const [queryMode, setQueryMode] = useState<"categorical" | "measure">(source?.queryKind === "measure" || tile.result.metric.id === "average" || tile.result.metric.id === "sum" ? "measure" : "categorical");
  const [measureFieldId, setMeasureFieldId] = useState(source?.measureFieldId ?? "none");
  const [chartType, setChartType] = useState<ChartType>(tile.visualization);
  const [isUpdatingImportedResult, setIsUpdatingImportedResult] = useState(false);
  const [importedUpdateError, setImportedUpdateError] = useState<string | null>(null);
  const primaryFields = importedExecutableFields(dataset);
  const primaryField = primaryFields.find((field) => field.id === primaryFieldId) ?? primaryFields[0] ?? null;
  const measureOptions = importedMeasureFields(dataset);
  const measureField = measureOptions.find((field) => field.id === measureFieldId) ?? null;
  const bannerOptions = importedBannerFields(dataset, primaryField?.id ?? "");
  const bannerField = bannerOptions.find((field) => field.id === bannerFieldId) ?? null;
  const filterOptions = importedFilterFields(dataset);
  const filterField = filterOptions.find((field) => field.id === filterFieldId) ?? null;
  const values = importedFieldValues(dataset, filterField);
  const filter = filterField && filterValue !== "all" ? { field: filterField, value: filterValue } : null;
  const effectiveMetric: Metric =
    queryMode === "measure"
      ? metric === "sum" ? "sum" : "average"
      : metric === "count" ? "count" : "percent_selected";
  const selectedChartType = (bannerField || queryMode === "measure") && chartType === "donut" ? "vertical_bar" : chartType;
  const support = getImportedDatasetQuerySupport(dataset, primaryField, {
    bannerField,
    filter,
    measureField: queryMode === "measure" ? measureField : null,
    metric: effectiveMetric,
    chartType: selectedChartType
  });
  const canApply = Boolean(dataset && primaryField && support.executable && !isLoading && !isUpdatingImportedResult);
  const provenance = buildImportedResultProvenance(tile.result);

  function changeDataset(nextDatasetId: string) {
    const nextDataset = importedDatasets.find((item) => item.id === nextDatasetId) ?? null;
    setDatasetId(nextDatasetId);
    setPrimaryFieldId(nextDataset?.fields.find((field) => field.type === "categorical" || field.modelingRole === "candidate_dimension")?.id ?? "");
    setMeasureFieldId(nextDataset?.fields.find((field) => field.type === "numeric" || field.modelingRole === "candidate_measure")?.id ?? "none");
    setBannerFieldId("none");
    setFilterFieldId("none");
    setFilterValue("all");
  }

  function changePrimaryField(nextFieldId: string) {
    setPrimaryFieldId(nextFieldId);
    if (nextFieldId === bannerFieldId) setBannerFieldId("none");
  }

  async function applyImportedQuery() {
    if (!dataset || !primaryField || !canApply) return;
    setImportedUpdateError(null);
    setIsUpdatingImportedResult(true);
    try {
      const result = await runImportedDatasetQueryForRuntime({
        dataset,
        field: primaryField,
        measureField: queryMode === "measure" ? measureField : null,
        bannerField,
        filter,
        chartType: selectedChartType,
        metric: effectiveMetric
      });
      const title = queryMode === "measure" && measureField
        ? `${effectiveMetric === "sum" ? "Sum of" : "Average"} ${measureField.label} by ${primaryField.label}`
        : primaryField.label;
      updateSelectedTile({
        name: title,
        title,
        source: {
          kind: "importedField",
          id: `${dataset.id}:${primaryField.id}`,
          label: title,
          datasetId: dataset.id,
          fieldId: primaryField.id
        },
        query: result.query,
        visualization: selectedChartType,
        result
      });
    } catch (error) {
      setImportedUpdateError(error instanceof Error ? error.message : "Imported result update failed.");
    } finally {
      setIsUpdatingImportedResult(false);
    }
  }

  if (!source) return null;

  return (
    <div className="imported-query-editor">
      <div className="explorer-section-header">
        <strong>Imported query</strong>
        <small>{support.reason}</small>
      </div>
      {provenance && (
        <div className="empty-state compact">
          <strong>{provenance.summaryLabel}</strong>
          <small>{provenance.queryKindLabel} · {provenance.metricLabel} · {provenance.baseLabel}</small>
          <div className="explorer-chip-row">
            {provenance.chips.slice(1, 6).map((chip) => (
              <span className="explorer-chip" key={chip}>{chip}</span>
            ))}
          </div>
        </div>
      )}
      <div className="guided-query-field-grid">
        <label>
          Dataset
          <select value={dataset?.id ?? ""} onChange={(event) => changeDataset(event.target.value)}>
            {importedDatasets.map((item) => (
              <option value={item.id} key={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        <label>
          Group responses by
          <select value={primaryField?.id ?? ""} onChange={(event) => changePrimaryField(event.target.value)}>
            {primaryFields.map((field) => (
              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="guided-query-field-grid">
        <label>
          What do you want to do?
          <select
            value={queryMode}
            onChange={(event) => {
              const nextMode = event.target.value as "categorical" | "measure";
              setQueryMode(nextMode);
              setMetric(nextMode === "measure" ? "average" : "percent_selected");
              if (nextMode === "measure") setMeasureFieldId(measureOptions[0]?.id ?? "none");
            }}
          >
            <option value="categorical">Count responses by a field</option>
            <option value="measure">Average or sum a number</option>
          </select>
        </label>
        {queryMode === "measure" && (
          <label>
            Number to average or sum
            <select value={measureField?.id ?? "none"} onChange={(event) => setMeasureFieldId(event.target.value)}>
              <option value="none">Choose a number...</option>
              {measureOptions.map((field) => (
                <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="guided-query-field-grid">
        <label>
          Break out by
          <select value={bannerField?.id ?? "none"} onChange={(event) => setBannerFieldId(event.target.value)}>
            <option value="none">No breakout</option>
            {bannerOptions.map((field) => (
              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
            ))}
          </select>
        </label>
        <label>
          Result values
          <select value={effectiveMetric} onChange={(event) => setMetric(event.target.value as Metric)}>
            {queryMode === "measure" ? (
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
      </div>
      <div className="guided-query-field-grid">
        <label>
          Limit to
          <select
            value={filterField?.id ?? "none"}
            onChange={(event) => {
              setFilterFieldId(event.target.value);
              setFilterValue("all");
            }}
          >
            <option value="none">No filter</option>
            {filterOptions.map((field) => (
              <option value={field.id} key={field.id}>{importedFieldDisplayLabel(field)}</option>
            ))}
          </select>
        </label>
        {filterField && (
          <label>
            Keep responses where
            <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="all">Choose value...</option>
              {values.map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="guided-query-field-grid">
        <label>
          Output
          <select value={selectedChartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
            <option value="table">Table</option>
            <option value="vertical_bar">Column</option>
            <option value="horizontal_bar">Horizontal bar</option>
            {!bannerField && queryMode === "categorical" && <option value="donut">Donut</option>}
            {bannerField && <option value="grouped_bar">Grouped bar</option>}
            {bannerField && <option value="stacked_bar">Stacked bar</option>}
            {bannerField && <option value="line_chart">Line chart</option>}
          </select>
        </label>
      </div>
      <div className={support.executable ? "guided-query-supported" : "guided-query-unsupported"}>
        <strong>{support.executable ? "Ready to rerun imported result" : "Unsupported imported edit"}</strong>
        <small>{support.reason}</small>
      </div>
      <button type="button" onClick={applyImportedQuery} disabled={!canApply}>
        {isLoading || isUpdatingImportedResult ? "Updating..." : "Update imported result"}
      </button>
      {importedUpdateError && <small className="imported-query-error">{importedUpdateError}</small>}
    </div>
  );
}

export function TileAnalysisQuerySection(props: BuilderInspectorProps) {
  const {
    selectedTile,
    selectedTileQuestion,
    savedVariableSets,
    savedBanners,
    savedFilters,
    savedWeights,
    updateSelectedTile,
    recordSavedSettingOriginCue,
    saveSelectedTileBanner,
    saveSelectedTileFilter,
    saveSelectedTileWeight,
    onViewSavedSettingInLibrary,
    isLoading
  } = props;
  const [saveConfirmation, setSaveConfirmation] = useState<(SavedTileSettingConfirmation & { tileId: string }) | null>(null);
  const [recentlySavedSetting, setRecentlySavedSetting] = useState<{ tileId: string; kind: Exclude<SavedTileSettingKind, "set" | "template"> } | null>(null);

  if (!selectedTile || !selectedTileQuestion) {
    return null;
  }
  const tile = selectedTile;
  const queryStatus = buildTileQueryStatus(tile);
  const actionState = buildTileQueryActionState(queryStatus, isLoading);
  const provenanceRows = buildSettingProvenanceRows(tile, savedBanners, savedFilters, savedWeights);
  const compatibleSavedBanners = savedBanners.filter((item) => selectedTileQuestion.allowedBreakBys.includes(item.breakBy));
  const pickerView = buildSettingProvenancePickerView(tile, compatibleSavedBanners, savedFilters, savedWeights);
  const bannerDisabled = (tile.query.comparisonMode ?? "none") === "wave";
  const activeBannerOption = pickerView.bannerOptions.find((item) => item.id === pickerView.activeBannerId);
  const activeFilterOption = pickerView.filterOptions.find((item) => item.id === pickerView.activeFilterId);
  const activeWeightOption = pickerView.weightOptions.find((item) => item.id === pickerView.activeWeightId);
  const showSaveConfirmation = saveConfirmation?.tileId === tile.id && actionState.canSaveSettings;
  const recentlySavedKind = recentlySavedSetting?.tileId === tile.id ? recentlySavedSetting.kind : null;
  const weightDiagnostics = buildAnalysisWeightDiagnostics(tile.query.weight);
  const statisticsContext = buildAnalysisStatisticsContext(tile);
  const significanceExplanation = buildExecutedSignificanceExplanationView(tile.result);
  const sourceVariableSet = savedVariableSets.find((item) => tile.source?.kind === "variableSet" && item.id === tile.source.id) ?? null;
  const weightMismatch = sourceVariableSet
    ? buildSavedVariableSetWeightMismatch({
      savedWeight: sourceVariableSet.weight,
      currentWeight: tile.query.weight,
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;
  const activeFilter = tile.query.filters[0];
  const filterMismatch = sourceVariableSet
    ? buildSavedVariableSetFilterMismatch({
      savedFilterField: sourceVariableSet.filterField,
      savedFilterValue: sourceVariableSet.filterValue,
      currentFilterField: activeFilter?.field ?? null,
      currentFilterValue: activeFilter?.values[0] ?? "all",
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;
  const bannerMismatch = sourceVariableSet
    ? buildSavedVariableSetBannerMismatch({
      savedBreakBy: sourceVariableSet.breakBy,
      currentBreakBy: tile.query.breakBy,
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;
  const contextMismatches = [weightMismatch, filterMismatch, bannerMismatch];
  const contextSummary = sourceVariableSet
    ? buildAnalysisContextDiagnosticsSummary({
      mismatches: contextMismatches,
      sourceLabel: sourceVariableSet.label,
      currentContextLabel: "selected tile"
    })
    : null;

  function saveEmptyStateSetting(kind: Exclude<SavedTileSettingKind, "set" | "template">, saveAction: () => void) {
    saveAction();
    const nextConfirmation = buildSavedTileSettingConfirmation(kind);
    setSaveConfirmation({ tileId: tile.id, ...nextConfirmation });
    setRecentlySavedSetting({ tileId: tile.id, kind });
  }

  function applySavedBanner(optionId: string) {
    const nextBanner = compatibleSavedBanners.find((item) => item.id === optionId);
    if (!nextBanner) return;
    updateSelectedTile(updatesForSavedBanner(tile, nextBanner));
    recordSavedSettingOriginCue("banner", nextBanner.label, tile.id);
  }

  function applySavedFilter(optionId: string) {
    const nextFilter = savedFilters.find((item) => item.id === optionId);
    if (!nextFilter) return;
    updateSelectedTile(updatesForSavedFilter(tile, nextFilter));
    recordSavedSettingOriginCue("filter", nextFilter.label, tile.id);
  }

  function applySavedWeight(optionId: string) {
    const nextWeight = savedWeights.find((item) => item.id === optionId);
    if (!nextWeight) return;
    updateSelectedTile(updatesForSavedWeight(tile, nextWeight));
    recordSavedSettingOriginCue("weight", nextWeight.label, tile.id);
  }

  function updateConfidenceLevel(confidenceLevel: ConfidenceLevel) {
    updateSelectedTile({
      query: {
        ...tile.query,
        confidenceLevel
      }
    });
  }

  const provenancePickerConfigs = [
    {
      kind: "banner" as const,
      row: provenanceRows.find((row) => row.id === "banner"),
      options: pickerView.bannerOptions,
      activeOptionId: pickerView.activeBannerId,
      activeOption: activeBannerOption,
      emptyState: bannerDisabled ? { label: "Wave comparison uses Summary", helper: "Turn off wave comparison before applying a saved banner." } : pickerView.bannerEmptyState,
      placeholder: bannerDisabled ? "Wave comparison" : pickerView.bannerOptions.length === 0 ? "No saved banners" : "Apply saved banner",
      selectLabel: "Apply saved banner",
      disabled: queryStatus.isImported || bannerDisabled || pickerView.bannerOptions.length === 0,
      onApply: applySavedBanner,
      action:
        !bannerDisabled && pickerView.bannerOptions.length === 0
          ? {
            label: "Save current banner",
            disabled: !actionState.canSaveSettings,
            disabledReason: actionState.saveHelperText,
            onClick: () => saveEmptyStateSetting("banner", saveSelectedTileBanner)
          }
          : undefined
    },
    {
      kind: "filter" as const,
      row: provenanceRows.find((row) => row.id === "filter"),
      options: pickerView.filterOptions,
      activeOptionId: pickerView.activeFilterId,
      activeOption: activeFilterOption,
      emptyState: pickerView.filterEmptyState,
      placeholder: pickerView.filterOptions.length === 0 ? "No saved filters" : "Apply saved filter",
      selectLabel: "Apply saved filter",
      disabled: queryStatus.isImported || pickerView.filterOptions.length === 0,
      onApply: applySavedFilter,
      action:
        pickerView.filterOptions.length === 0
          ? {
            label: "Save current filter",
            disabled: !actionState.canSaveSettings,
            disabledReason: actionState.saveHelperText,
            onClick: () => saveEmptyStateSetting("filter", saveSelectedTileFilter)
          }
          : undefined
    },
    {
      kind: "weight" as const,
      row: provenanceRows.find((row) => row.id === "weight"),
      options: pickerView.weightOptions,
      activeOptionId: pickerView.activeWeightId,
      activeOption: activeWeightOption,
      emptyState: pickerView.weightEmptyState,
      placeholder: pickerView.weightOptions.length === 0 ? "No saved weights" : "Apply saved weight",
      selectLabel: "Apply saved weight",
      disabled: queryStatus.isImported || pickerView.weightOptions.length === 0,
      onApply: applySavedWeight,
      action:
        pickerView.weightOptions.length === 0
          ? {
            label: "Save current weight",
            disabled: !actionState.canSaveSettings,
            disabledReason: actionState.saveHelperText,
            onClick: () => saveEmptyStateSetting("weight", saveSelectedTileWeight)
          }
          : undefined
    }
  ];

  return (
    <div className="inspector-summary-card">
      <span className="inspector-summary-kicker">Edit analysis</span>
      <div className={queryStatus.hasPendingChanges ? "tile-query-status pending" : "tile-query-status"}>
        <div>
          <strong>{queryStatus.label}</strong>
          <span>{queryStatus.description}</span>
        </div>
        <small>{queryStatus.visualizationLabel}</small>
      </div>
      <div className="settings-provenance-row" aria-label="Current analytical setting provenance">
        {provenancePickerConfigs.map((config) => (
          config.row && (
            <SettingProvenancePickerCard
              key={config.kind}
              row={config.row}
              options={config.options}
              activeOptionId={config.activeOptionId}
              activeOption={config.activeOption}
              emptyState={config.emptyState}
              placeholder={config.placeholder}
              selectLabel={config.selectLabel}
              disabled={config.disabled}
              recentlySaved={recentlySavedKind === config.kind && Boolean(config.activeOption)}
              action={config.action}
              onApply={config.onApply}
            />
          )
        ))}
      </div>
      {showSaveConfirmation && (
        <div className="tile-query-action-confirmation" role="status">
          <strong>{saveConfirmation.label}</strong>
          <span>{saveConfirmation.message}</span>
          <button type="button" className="secondary inline-action" onClick={() => onViewSavedSettingInLibrary(saveConfirmation.libraryView)}>
            View in library
          </button>
        </div>
      )}
      <div className="tile-query-group primary">
        <div className="explorer-section-header">
          <strong>Source settings</strong>
          <small>{queryStatus.sourceLabel}</small>
        </div>
        <div className="explorer-chip-row">
          <span className="explorer-chip">{queryStatus.primarySourceLabel}: {queryStatus.questionLabel}</span>
          <span className="explorer-chip">Compare: {queryStatus.comparisonLabel}</span>
        </div>
        {queryStatus.isImported ? (
          <ImportedTileQueryEditor
            tile={tile}
            importedDatasets={props.importedDatasets}
            updateSelectedTile={updateSelectedTile}
            isLoading={isLoading}
          />
        ) : (
          <TileQuestionConfigSection {...props} />
        )}
      </div>
      <details className="tile-query-group disclosure">
        <summary>
          <strong>Comparison settings</strong>
          <small>Trend or compare waves</small>
        </summary>
        {queryStatus.isImported ? <div className="empty-state compact">Wave comparison is not supported for imported local results yet.</div> : <TileComparisonControls {...props} />}
      </details>
      <details className="tile-query-group disclosure">
        <summary>
          <strong>Filters and weights</strong>
          <small>Analysis base</small>
        </summary>
        <AnalysisWeightDiagnosticsCard view={weightDiagnostics} mismatches={contextMismatches} mismatchSummary={contextSummary} />
        {queryStatus.isImported ? <div className="empty-state compact">Imported filters are captured in the local result; seeded saved filters and weights do not apply.</div> : <TileFilterWeightControls {...props} />}
      </details>
      <details className="tile-query-group disclosure">
        <summary>
          <strong>Statistical context</strong>
          <small>Confidence and significance status</small>
        </summary>
        <AnalysisStatisticsContextCard
          view={statisticsContext}
          confidenceLevel={tile.query.confidenceLevel ?? 0.95}
          onChangeConfidenceLevel={updateConfidenceLevel}
        />
        <ExecutedSignificanceExplanationCard view={significanceExplanation} visualization={tile.visualization} />
      </details>
      <details className="tile-query-group disclosure" open={queryStatus.hasPendingChanges}>
        <summary>
          <strong>Apply and save</strong>
          <small>{queryStatus.hasPendingChanges ? "Refresh to update result" : "Reusable settings"}</small>
        </summary>
        <TileQueryActions {...props} />
      </details>
    </div>
  );
}

function AnalysisStatisticsContextCard({
  view,
  confidenceLevel,
  onChangeConfidenceLevel
}: {
  view: AnalysisStatisticsContextView;
  confidenceLevel: ConfidenceLevel;
  onChangeConfidenceLevel: (confidenceLevel: ConfidenceLevel) => void;
}) {
  return (
    <div className={`analysis-statistics-context-card ${view.status}`}>
      <div>
        <span>{view.label}</span>
        <strong>{view.currentConfidenceLabel}</strong>
        <p>{view.message}</p>
        <small>{view.helper}</small>
      </div>
      <label className="analysis-confidence-control">
        Confidence level
        <select value={confidenceLevel} onChange={(event) => onChangeConfidenceLevel(Number(event.target.value) as ConfidenceLevel)}>
          {supportedConfidenceLevels.map((level) => (
            <option value={level} key={level}>
              {confidenceLevelLabel(level)}
            </option>
          ))}
        </select>
        <small>Updates query context only; refresh analysis to update rendered results.</small>
      </label>
      {view.refreshCue && (
        <div className="analysis-confidence-refresh-cue" role="status">
          <strong>{view.refreshCue.label}</strong>
          <span>{view.refreshCue.message}</span>
          <small>{view.refreshCue.helper}</small>
        </div>
      )}
      <div className={`analysis-significance-eligibility ${view.eligibility.status}`}>
        <div>
          <strong>{view.eligibility.label}</strong>
          <span>{view.eligibility.message}</span>
          <small>{view.eligibility.helper}</small>
        </div>
        <div className="explorer-chip-row">
          <span className="explorer-chip">{view.eligibility.comparisonBasisLabel}</span>
          {view.eligibility.chips.map((chip) => (
            <span className={view.eligibility.status === "candidate" && chip !== "Placeholder only" && chip !== "No test performed" ? "explorer-chip" : "explorer-chip warning-chip"} key={chip}>
              {chip}
            </span>
          ))}
        </div>
        {view.eligibility.limitations.length > 0 && (
          <ul>
            {view.eligibility.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={`analysis-execution-diagnostics ${view.executionDiagnostics.status}`}>
        <div>
          <strong>{view.executionDiagnostics.label}</strong>
          <span>{view.executionDiagnostics.message}</span>
          <small>{view.executionDiagnostics.helper}</small>
        </div>
        <div className="explorer-chip-row">
          {view.executionDiagnostics.chips.map((chip) => (
            <span className={view.executionDiagnostics.status === "deferred" || view.executionDiagnostics.status === "ready" ? "explorer-chip" : "explorer-chip warning-chip"} key={chip}>
              {chip}
            </span>
          ))}
        </div>
        {view.executionDiagnostics.details.length > 0 && (
          <ul>
            {view.executionDiagnostics.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={`analysis-comparison-diagnostics ${view.comparisonDiagnostics.status}`}>
        <div>
          <strong>{view.comparisonDiagnostics.label}</strong>
          <span>{view.comparisonDiagnostics.message}</span>
          <small>{view.comparisonDiagnostics.helper}</small>
        </div>
        <div className="explorer-chip-row">
          {view.comparisonDiagnostics.chips.map((chip) => (
            <span className={view.comparisonDiagnostics.status === "inactive" ? "explorer-chip" : "explorer-chip warning-chip"} key={chip}>
              {chip}
            </span>
          ))}
        </div>
        {view.comparisonDiagnostics.limitations.length > 0 && (
          <ul>
            {view.comparisonDiagnostics.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={`analysis-base-diagnostics ${view.baseDiagnostics.status}`}>
        <div>
          <strong>{view.baseDiagnostics.label}</strong>
          <span>{view.baseDiagnostics.message}</span>
          <small>{view.baseDiagnostics.helper}</small>
        </div>
        <div className="explorer-chip-row">
          {view.baseDiagnostics.chips.map((chip) => (
            <span className={view.baseDiagnostics.status === "strong" ? "explorer-chip" : "explorer-chip warning-chip"} key={chip}>
              {chip}
            </span>
          ))}
        </div>
        {view.baseDiagnostics.notes.length > 0 && (
          <ul>
            {view.baseDiagnostics.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="explorer-chip-row">
        {view.chips.map((chip) => (
          <span className={chip === "Advisory only" || chip === "Refresh needed" || chip.includes("Placeholder") ? "explorer-chip warning-chip" : "explorer-chip"} key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExecutedSignificanceExplanationCard({
  view,
  visualization
}: {
  view: ExecutedSignificanceExplanationView;
  visualization: ChartType;
}) {
  if (!view.available || visualization !== "table") {
    return null;
  }

  return (
    <div className="executed-significance-explanation-card">
      <div className="explorer-section-header">
        <strong>{view.label}</strong>
        <small>Executed column comparisons</small>
      </div>
      <p>{view.message}</p>
      <small>{view.helper}</small>
      <div className="explorer-chip-row">
        {view.chips.map((chip) => (
          <span className="explorer-chip" key={chip}>{chip}</span>
        ))}
      </div>
      <div className="executed-significance-columns">
        <span>Compared columns</span>
        <strong>{view.comparedColumns.join(" vs ")}</strong>
      </div>
      <ul>
        {view.markerMeanings.map((meaning) => (
          <li key={meaning}>{meaning}</li>
        ))}
      </ul>
      {view.exampleCells.length > 0 && (
        <div className="executed-significance-examples">
          {view.exampleCells.map((cell) => (
            <span className={`executed-significance-example ${cell.direction}`} key={`${cell.rowId}-${cell.columnId}`}>
              <strong>{cell.label}</strong>
              <small>{cell.comparedLabels.join(", ")}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingProvenancePickerCard({
  row,
  options,
  activeOptionId,
  activeOption,
  emptyState,
  placeholder,
  selectLabel,
  disabled,
  recentlySaved,
  action,
  onApply
}: {
  row: SettingProvenanceRow;
  options: SettingProvenanceOption[];
  activeOptionId: string;
  activeOption?: SettingProvenanceOption;
  emptyState: SettingProvenanceEmptyState;
  placeholder: string;
  selectLabel: string;
  disabled: boolean;
  recentlySaved: boolean;
  action?: { label: string; disabled: boolean; disabledReason: string; onClick: () => void };
  onApply: (optionId: string) => void;
}) {
  return (
    <div className={row.saved ? "settings-provenance-item saved" : "settings-provenance-item"}>
      <span>{row.label}</span>
      <strong>{row.value}</strong>
      <small>{row.source}</small>
      <select
        aria-label={selectLabel}
        value={activeOptionId}
        disabled={disabled}
        onChange={(event) => onApply(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option value={item.id} key={item.id} title={item.description}>{item.label} - {item.summary}</option>
        ))}
      </select>
      <SettingProvenanceOptionDetail
        option={activeOption}
        recentlySaved={recentlySaved}
        emptyState={emptyState}
        action={action}
      />
    </div>
  );
}

function SettingProvenanceOptionDetail({
  option,
  recentlySaved = false,
  emptyState,
  action
}: {
  option?: SettingProvenanceOption;
  recentlySaved?: boolean;
  emptyState: SettingProvenanceEmptyState;
  action?: { label: string; disabled: boolean; disabledReason: string; onClick: () => void };
}) {
  return (
    <div className={option ? recentlySaved ? "settings-provenance-detail active recently-saved" : "settings-provenance-detail active" : "settings-provenance-detail"}>
      <span>{option?.summary ?? emptyState.label}</span>
      <small>{option?.description ?? emptyState.helper}</small>
      {recentlySaved && <small className="recently-saved-label">Newly saved reusable setting</small>}
      {!option && action && (
        <button type="button" className="mini-button" disabled={action.disabled} title={action.disabled ? action.disabledReason : undefined} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function TileAnalysisDisplaySection(props: BuilderInspectorProps) {
  const {
    selectedTile,
    updateSelectedTile,
    updateSelectedAppearance,
    tileWithVisualization,
    duplicateTileAsVisualization
  } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
              <label>
                Visualization
                <select
                  value={selectedTile.visualization}
                  onChange={(event) => {
                    const nextVisualization = event.target.value as ChartType;
                    updateSelectedTile(tileWithVisualization(selectedTile, nextVisualization));
                  }}
                >
                  {getCompatibleChartTypes(selectedTile.result).map((item) => (
                    <option value={item} key={item}>
                      {getChartTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTile.visualization === "table" && (
                <div className="table-convert-card">
                  <div className="explorer-section-header">
                    <strong>Convert table to chart</strong>
                    <small>Pick a view for this same query</small>
                  </div>
                  <div className="explorer-chip-row">
                    {getCompatibleChartTypes(selectedTile.result)
                      .filter((item) => item !== "table")
                      .map((item) => (
                        <button
                          type="button"
                          key={item}
                          className="explorer-chip-button"
                          onClick={() => updateSelectedTile(tileWithVisualization(selectedTile, item))}
                        >
                          {getChartTypeLabel(item)}
                        </button>
                      ))}
                  </div>
                  <div className="explorer-section-header table-convert-subhead">
                    <strong>Keep table and create chart</strong>
                    <small>Useful when the page needs both views</small>
                  </div>
                  <div className="explorer-chip-row">
                    {getCompatibleChartTypes(selectedTile.result)
                      .filter((item) => item !== "table")
                      .map((item) => (
                        <button
                          type="button"
                          key={`duplicate-${item}`}
                          className="explorer-chip-button secondary-chip"
                          onClick={() => duplicateTileAsVisualization(selectedTile, item)}
                        >
                          New {getChartTypeLabel(item)}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <div className="panel-title subtle">
                <h2>Display</h2>
              </div>
              <div className="toggle-list">
                <label><input type="checkbox" checked={selectedTile.appearance.showGrid} onChange={(event) => updateSelectedAppearance({ showGrid: event.target.checked })} /> {selectedTile.visualization === "table" ? "Table guides" : "Chart grid"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showValueLabels} onChange={(event) => updateSelectedAppearance({ showValueLabels: event.target.checked })} /> {selectedTile.visualization === "table" ? "Cell values" : "Value labels"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showAnnotations} onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })} /> {selectedTile.visualization === "table" ? "Highlights" : "Arrows"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showNotes} onChange={(event) => updateSelectedAppearance({ showNotes: event.target.checked })} /> Notes</label>
              </div>
    </>
  );
}

export function TileAnalysisDesignSection(props: BuilderInspectorProps) {
  const { selectedTile, setSettingsView, setDesignModal } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
              <div className="panel-title subtle">
                <h2>Design</h2>
              </div>
              <div className="settings-menu">
                <button type="button" className="menu-card" onClick={() => setDesignModal("chartColors")}>
                  <strong>Colors</strong>
                  <span>Bars, labels, axes, grid, and chart surface.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("labelSettings")}>
                  <strong>Labels</strong>
                  <span>Value label position, size, and spacing.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("barLayout")}>
                  <strong>Bars</strong>
                  <span>Roundness, width, and spacing.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("axisSettings")}>
                  <strong>Axis</strong>
                  <span>Text, alignment, wrapping, and offsets.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setSettingsView("container")}>
                  <strong>Container</strong>
                  <span>Tile background, border, and transparency.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("tileEffects")}>
                  <strong>Effects</strong>
                  <span>{selectedTile.appearance.shadow || selectedTile.appearance.glow ? "Shadow or glow active." : "Shadow and glow controls."}</span>
                </button>
              </div>
    </>
  );
}
