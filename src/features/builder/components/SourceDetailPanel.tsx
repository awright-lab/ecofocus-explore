import { useState } from "react";
import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import type { InsertionContextView } from "./insertionContextModel";
import {
  buildSourceInsertionView,
  buildVariableSetDraftStatus,
  buildQuestionSourceDetail,
  buildVariableSetRowDetails,
  buildVariableSetSourceDetail,
  type VariableSetDraftState,
  type SourceDetailView
} from "./sourceExplorerModel";
import { VariableSetAuthoredRowAuditCard } from "./VariableSetAuthoredRowAuditCard";
import { VariableSetCoverageSummaryCard } from "./VariableSetCoverageSummaryCard";
import { VariableSetRowCompositionEditor } from "./VariableSetRowCompositionEditor";
import { buildVariableSetAuthoredRowAudit, buildVariableSetReadinessView, buildVariableSetRecodePreview, isAuthoredVariableSetRow, type VariableSetCoverageOption, type VariableSetReadinessView } from "./variableSetValidationModel";

interface SourceDetailPanelProps {
  selectedDataSource: AnalysisAuthoringPanelProps["selectedDataSource"];
  selectedQuestion: QuestionMetadata;
  selectedVariableSet: SavedVariableSet | null;
  variableSetRows: SavedVariableSet["rows"];
  updateVariableSetRow: AnalysisAuthoringPanelProps["updateVariableSetRow"];
  reorderVariableSetRow: AnalysisAuthoringPanelProps["reorderVariableSetRow"];
  saveCurrentVariableSet: AnalysisAuthoringPanelProps["saveCurrentVariableSet"];
  variableSetDraftName: AnalysisAuthoringPanelProps["variableSetDraftName"];
  variableSetDescription: AnalysisAuthoringPanelProps["variableSetDescription"];
  variableSetQuestionIds: AnalysisAuthoringPanelProps["variableSetQuestionIds"];
  breakBy: AnalysisAuthoringPanelProps["breakBy"];
  metric: AnalysisAuthoringPanelProps["metric"];
  chartType: AnalysisAuthoringPanelProps["chartType"];
  comparisonMode: AnalysisAuthoringPanelProps["comparisonMode"];
  comparisonDatasets: AnalysisAuthoringPanelProps["comparisonDatasets"];
  weight: AnalysisAuthoringPanelProps["weight"];
  filterField: AnalysisAuthoringPanelProps["filterField"];
  filterValue: AnalysisAuthoringPanelProps["filterValue"];
  selectedChartTypes: AnalysisAuthoringPanelProps["selectedChartTypes"];
  addTileFromSourceWithVisualization: AnalysisAuthoringPanelProps["addTileFromSourceWithVisualization"];
  isLoading: AnalysisAuthoringPanelProps["isLoading"];
  insertionContext: InsertionContextView;
}

function SourceDetailList({ detail }: { detail: SourceDetailView }) {
  return (
    <>
      <div className="source-detail-grid">
        {detail.items.map((item) => (
          <div className="source-detail-field" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      {detail.lists.map((list) => (
        <div className="source-detail-list" key={list.label}>
          <span>{list.label}</span>
          <div className="explorer-chip-row">
            {list.items.map((item) => (
              <span className="explorer-chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function SourceInsertionActions({
  chartType,
  selectedChartTypes,
  insertionContext,
  isLoading,
  addTileFromSourceWithVisualization
}: Pick<SourceDetailPanelProps, "chartType" | "selectedChartTypes" | "insertionContext" | "isLoading" | "addTileFromSourceWithVisualization">) {
  const insertion = buildSourceInsertionView(chartType, selectedChartTypes, insertionContext);
  const [confirmation, setConfirmation] = useState<{ label: string; pageTitle: string } | null>(null);

  async function createSourceObject(nextChartType: typeof chartType, label: string) {
    const createdTileId = await addTileFromSourceWithVisualization(nextChartType);
    if (!createdTileId) return;
    setConfirmation({ label, pageTitle: insertionContext.targetPageLabel });
  }

  return (
    <div className="source-insertion-card">
      <div>
        <span>Use this source</span>
        <strong>Create a report object</strong>
        <p>{insertion.helperText}</p>
      </div>
      <div className="insertion-context-grid source-insertion-context">
        <div>
          <span>Selection</span>
          <strong>{insertionContext.selectedObjectLabel}</strong>
        </div>
        <div>
          <span>Placement</span>
          <strong>{insertionContext.placementLabel}</strong>
        </div>
      </div>
      {insertionContext.dropHelperText && <small className="source-insertion-drop-note">{insertionContext.dropHelperText}</small>}
      <div className="source-insertion-card__actions">
        <button
          type="button"
          className="secondary"
          onClick={() => void createSourceObject("table", "table")}
          disabled={isLoading || !insertion.canCreateTable}
        >
          {isLoading && chartType === "table" ? "Creating..." : insertion.tableActionLabel}
        </button>
        <button
          type="button"
          onClick={() => void createSourceObject(insertion.chartType, insertion.chartLabel)}
          disabled={isLoading}
        >
          {isLoading && chartType !== "table" ? "Creating..." : insertion.chartActionLabel}
        </button>
      </div>
      {confirmation && (
        <div className="source-insertion-confirmation" role="status">
          <strong>Created {confirmation.label}</strong>
          <span>Added to "{confirmation.pageTitle}" and selected for inspector editing.</span>
        </div>
      )}
    </div>
  );
}

function VariableSetLifecycle({
  selectedVariableSet,
  draft,
  saveCurrentVariableSet
}: {
  selectedVariableSet: SavedVariableSet | null;
  draft: VariableSetDraftState;
  saveCurrentVariableSet: AnalysisAuthoringPanelProps["saveCurrentVariableSet"];
}) {
  const status = buildVariableSetDraftStatus(selectedVariableSet, draft);

  return (
    <div className={status.hasUnsavedChanges ? "source-lifecycle-card dirty" : "source-lifecycle-card"}>
      <div>
        <span>{status.isPersisted ? "Saved library source" : "New library source"}</span>
        <strong>{status.label}</strong>
        <p>{status.description}</p>
      </div>
      <div className="source-lifecycle-card__actions">
        <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(!selectedVariableSet)} disabled={status.isPersisted && !status.hasUnsavedChanges}>
          {status.primaryActionLabel}
        </button>
        {selectedVariableSet && (
          <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(true)}>
            Save as new
          </button>
        )}
      </div>
    </div>
  );
}

function VariableSetReadinessCard({ readiness }: { readiness: VariableSetReadinessView }) {
  return (
    <div className={`variable-set-readiness-card ${readiness.status}`}>
      <div className="explorer-section-header">
        <strong>{readiness.label}</strong>
        <small>{readiness.visibleRowCount}/{readiness.totalRowCount} visible rows · {readiness.issueCount} issue{readiness.issueCount === 1 ? "" : "s"}</small>
      </div>
      <small>{readiness.helper}</small>
      {readiness.issues.length > 0 && (
        <div className="variable-set-readiness-list">
          {readiness.issues.map((issue) => (
            <div className="variable-set-readiness-issue" key={issue.id}>
              <strong>{issue.label}</strong>
              <span>{issue.helper}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VariableSetRowRefinement({
  selectedQuestion,
  variableSetRows,
  updateVariableSetRow,
  reorderVariableSetRow
}: Pick<SourceDetailPanelProps, "selectedQuestion" | "variableSetRows" | "updateVariableSetRow" | "reorderVariableSetRow">) {
  const rowDetails = buildVariableSetRowDetails(variableSetRows, selectedQuestion);
  const recodePreview = buildVariableSetRecodePreview(variableSetRows, selectedQuestion);
  const authoredRowAudit = buildVariableSetAuthoredRowAudit(variableSetRows, selectedQuestion);
  const recodeRows = new Map(recodePreview.rows.map((row) => [row.rowId, row]));
  const rowsById = new Map(variableSetRows.map((row) => [row.id, row]));
  const [showRowsNeedingReview, setShowRowsNeedingReview] = useState(false);
  const [focusedSourceOption, setFocusedSourceOption] = useState<VariableSetCoverageOption | null>(null);
  const visibleRowDetails = rowDetails.filter((row) => {
    if (focusedSourceOption) {
      const sourceRow = rowsById.get(row.id);
      return Boolean(sourceRow && isAuthoredVariableSetRow(sourceRow) && sourceRow.sourceOptionIds.includes(focusedSourceOption.id));
    }
    return !showRowsNeedingReview || Boolean(recodeRows.get(row.id)?.needsReview);
  });

  return (
    <div className="source-row-refinement">
      <VariableSetAuthoredRowAuditCard
        audit={authoredRowAudit}
        showReviewRows={showRowsNeedingReview}
        onToggleReviewRows={() => setShowRowsNeedingReview((current) => !current)}
      />
      <VariableSetCoverageSummaryCard
        coverage={recodePreview.coverage}
        focusedSourceOptionId={focusedSourceOption?.id}
        onFocusSourceOption={(option) => {
          setFocusedSourceOption(option);
          setShowRowsNeedingReview(false);
        }}
      />
      <div className="variable-set-recode-card">
        <div className="explorer-section-header">
          <strong>Recode and net preview</strong>
          <small>{recodePreview.includedOptionLabels.length} included · {recodePreview.excludedOptionLabels.length} excluded</small>
        </div>
        <div className="variable-set-recode-grid">
          <div>
            <span>Included</span>
            <strong>{recodePreview.includedOptionLabels.length ? recodePreview.includedOptionLabels.join(", ") : "None"}</strong>
          </div>
          <div>
            <span>Excluded</span>
            <strong>{recodePreview.excludedOptionLabels.length ? recodePreview.excludedOptionLabels.join(", ") : "None"}</strong>
          </div>
        </div>
        {recodePreview.overlapWarnings.length > 0 && (
          <div className="variable-set-readiness-list">
            {recodePreview.overlapWarnings.map((warning) => (
              <div className="variable-set-readiness-issue" key={warning.id}>
                <strong>Overlap: {warning.optionLabel}</strong>
                <span>{warning.helper}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="source-detail-list">
        <span>Draft row refinement</span>
        <div className="source-row-refinement__list">
          {focusedSourceOption && (
            <div className="variable-set-focus-empty active">
              <strong>Rows using {focusedSourceOption.label}</strong>
              <span>{focusedSourceOption.summaryLabel}: {focusedSourceOption.rowLabels.join(", ")}</span>
              <button type="button" className="secondary" onClick={() => setFocusedSourceOption(null)}>
                Clear option focus
              </button>
            </div>
          )}
          {visibleRowDetails.length === 0 && focusedSourceOption && (
            <div className="variable-set-focus-empty">
              <strong>No authored rows use {focusedSourceOption.label}</strong>
              <span>The current rows no longer include this source option.</span>
            </div>
          )}
          {visibleRowDetails.length === 0 && showRowsNeedingReview && !focusedSourceOption && (
            <div className="variable-set-focus-empty">
              <strong>No authored rows need review</strong>
              <span>The current audit has no empty, unknown, or overlapping authored rows.</span>
            </div>
          )}
          {visibleRowDetails.map((row) => {
            const recodeRow = recodeRows.get(row.id);
            const sourceRow = rowsById.get(row.id);
            const rowIndex = rowDetails.findIndex((item) => item.id === row.id);
            return (
            <div className={row.visible ? "source-row-card" : "source-row-card muted"} key={row.id}>
              <div className="source-row-card__header">
                <div>
                  <span>Row {row.order}</span>
                  <strong>{row.label}</strong>
                </div>
                <span className="source-row-kind">{row.kindLabel}</span>
              </div>
              <div className="explorer-chip-row">
                <span className="explorer-chip">{row.sourceSummary}</span>
                <span className="explorer-chip">{row.emphasis === "summary" ? "Summary row" : "Detail row"}</span>
                <span className="explorer-chip">{row.visible ? "Visible" : "Hidden"}</span>
                {recodeRow?.overlapLabels.length ? <span className="explorer-chip warning-chip">Overlap</span> : null}
              </div>
              {row.composition.length > 0 && (
                <p>{row.composition.join(", ")}</p>
              )}
              {recodeRow?.overlapLabels.length ? (
                <p className="source-row-card__warning">Also used in another authored row: {recodeRow.overlapLabels.join(", ")}</p>
              ) : null}
              {sourceRow && (
                <VariableSetRowCompositionEditor
                  row={sourceRow}
                  selectedQuestion={selectedQuestion}
                  recodeRow={recodeRow}
                  updateVariableSetRow={updateVariableSetRow}
                  compact
                />
              )}
              <div className="source-row-card__controls">
                <select
                  aria-label={`Row emphasis for ${row.label}`}
                  value={row.emphasis}
                  onChange={(event) => updateVariableSetRow(row.id, { emphasis: event.target.value as "detail" | "summary" })}
                >
                  <option value="detail">Detail</option>
                  <option value="summary">Summary</option>
                </select>
                <select
                  aria-label={`Row visibility for ${row.label}`}
                  value={row.visible ? "visible" : "hidden"}
                  onChange={(event) => updateVariableSetRow(row.id, { visible: event.target.value === "visible" })}
                >
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
                <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "up")} disabled={rowIndex === 0}>
                  Up
                </button>
                <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "down")} disabled={rowIndex === rowDetails.length - 1}>
                  Down
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SourceDetailPanel({
  selectedDataSource,
  selectedQuestion,
  selectedVariableSet,
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
  insertionContext
}: SourceDetailPanelProps) {
  const detail =
    selectedDataSource.kind === "variableSet" && selectedVariableSet
      ? buildVariableSetSourceDetail(selectedVariableSet, selectedQuestion)
      : buildQuestionSourceDetail(selectedQuestion);
  const showVariableSetRefinement = selectedDataSource.kind === "variableSet" && selectedVariableSet;
  const variableSetDraft: VariableSetDraftState = {
    label: variableSetDraftName,
    description: variableSetDescription,
    questionIds: variableSetQuestionIds,
    primaryQuestionId: selectedQuestion.id,
    rows: variableSetRows,
    breakBy,
    metric,
    chartType,
    comparisonMode,
    comparisonDatasets,
    weight,
    filterField,
    filterValue
  };
  const variableSetReadiness = buildVariableSetReadinessView(variableSetRows, selectedQuestion);

  return (
    <div className="explorer-section-card source-detail-panel">
      <div className="explorer-section-header">
        <strong>Source details</strong>
        <small>{detail.kindLabel}</small>
      </div>
      <div className="source-detail-heading">
        <span>{detail.subtitle}</span>
        <strong>{detail.title}</strong>
        <p>{detail.description}</p>
      </div>
      <div className="explorer-chip-row">
        {detail.chips.map((chip) => (
          <span className="explorer-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
      <SourceDetailList detail={detail} />
      <SourceInsertionActions
        chartType={chartType}
        selectedChartTypes={selectedChartTypes}
        insertionContext={insertionContext}
        isLoading={isLoading}
        addTileFromSourceWithVisualization={addTileFromSourceWithVisualization}
      />
      {showVariableSetRefinement && (
        <>
          <VariableSetReadinessCard readiness={variableSetReadiness} />
          <VariableSetLifecycle selectedVariableSet={selectedVariableSet} draft={variableSetDraft} saveCurrentVariableSet={saveCurrentVariableSet} />
          <VariableSetRowRefinement
            selectedQuestion={selectedQuestion}
            variableSetRows={variableSetRows}
            updateVariableSetRow={updateVariableSetRow}
            reorderVariableSetRow={reorderVariableSetRow}
          />
        </>
      )}
    </div>
  );
}
