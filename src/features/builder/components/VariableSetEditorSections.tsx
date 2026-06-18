import {
  defaultDataset,
  defaultQuestion
} from "../builderConstants";
import { defaultVisualizationForQuestion } from "../../analytics/analyticsDisplay";
import { defaultVariableSetRows, rowKindLabel } from "../../document/documentSeeds";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { VariableSetAuthoredRowAuditCard } from "./VariableSetAuthoredRowAuditCard";
import { VariableSetCoverageSummaryCard } from "./VariableSetCoverageSummaryCard";
import { VariableSetRowCompositionEditor } from "./VariableSetRowCompositionEditor";
import { buildVariableSetAuthoredRowAudit, buildVariableSetReadinessView, buildVariableSetRecodePreview, isAuthoredVariableSetRow, type VariableSetCoverageOption } from "./variableSetValidationModel";

interface VariableSetIssueFocusProps {
  showRowsNeedingReview?: boolean;
  onToggleRowsNeedingReview?: () => void;
  focusedSourceOption?: VariableSetCoverageOption | null;
  onFocusSourceOption?: (option: VariableSetCoverageOption) => void;
  onClearFocusedSourceOption?: () => void;
}

export function VariableSetMetadataSection(props: AnalysisAuthoringPanelProps) {
  const {
    question,
    setQuestion,
    variableSetDraftName,
    setVariableSetDraftName,
    variableSetDescription,
    setVariableSetDescription,
    variableSetQuestionIds,
    toggleVariableSetQuestion,
    setBreakBy,
    setMetric,
    setChartType,
    setVariableSetRows,
    setVariableSetOptionSelection
  } = props;

  return (
    <>
                      <label>
                        Variable set name
                        <input value={variableSetDraftName} onChange={(event) => setVariableSetDraftName(event.target.value)} placeholder="Name this saved set" />
                      </label>
                      <label>
                        Description
                        <input value={variableSetDescription} onChange={(event) => setVariableSetDescription(event.target.value)} placeholder="Describe this variable set" />
                      </label>
                      <label>
                        Primary question
                        <select
                          value={question}
                          onChange={(event) => {
                            const nextQuestion = defaultDataset.questions.find((item) => item.id === event.target.value) ?? defaultQuestion;
                            setQuestion(nextQuestion.id);
                            setBreakBy(nextQuestion.allowedBreakBys[0]);
                            setMetric(nextQuestion.defaultMetric);
                            setChartType(defaultVisualizationForQuestion(nextQuestion));
                            setVariableSetRows(defaultVariableSetRows(nextQuestion.id));
                            setVariableSetOptionSelection([]);
                          }}
                        >
                          {variableSetQuestionIds.map((questionId) => {
                            const item = defaultDataset.questions.find((entry) => entry.id === questionId);
                            if (!item) return null;
                            return (
                              <option value={item.id} key={item.id}>
                                {item.shortLabel}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <div className="explorer-question-picker">
                        <span>Included questions</span>
                        <div className="explorer-question-list">
                          {defaultDataset.questions.map((item) => (
                            <label key={item.id} className={variableSetQuestionIds.includes(item.id) ? "explorer-question-option active" : "explorer-question-option"}>
                              <input
                                type="checkbox"
                                checked={variableSetQuestionIds.includes(item.id)}
                                onChange={() => toggleVariableSetQuestion(item.id)}
                              />
                              <div>
                                <strong>{item.shortLabel}</strong>
                                <span>{item.topic}</span>
                              </div>
                            </label>
	                          ))}
	                        </div>
	                      </div>
	    </>
	  );
}

export function VariableSetRowLogicSection(props: AnalysisAuthoringPanelProps & VariableSetIssueFocusProps) {
  const {
    selectedQuestion,
    resetVariableSetRows,
    revealAllVariableSetRows,
    markVariableSetRowsAsDetails,
    variableSetRows,
    variableSetOptionSelection,
    toggleVariableSetOptionRow,
    toggleVariableSetOptionSelection,
    addVariableSetNet,
    addRowsForUncoveredOptions,
    showRowsNeedingReview = false,
    onToggleRowsNeedingReview,
    focusedSourceOption,
    onFocusSourceOption
  } = props;
  const readiness = buildVariableSetReadinessView(variableSetRows, selectedQuestion);
  const recodePreview = buildVariableSetRecodePreview(variableSetRows, selectedQuestion);
  const authoredRowAudit = buildVariableSetAuthoredRowAudit(variableSetRows, selectedQuestion);

  return (
    <>
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
                      <VariableSetAuthoredRowAuditCard
                        audit={authoredRowAudit}
                        showReviewRows={showRowsNeedingReview}
                        onToggleReviewRows={onToggleRowsNeedingReview}
                      />
                      <VariableSetCoverageSummaryCard
                        coverage={recodePreview.coverage}
                        focusedSourceOptionId={focusedSourceOption?.id}
                        onFocusSourceOption={onFocusSourceOption}
                        onAddRowsForUncoveredOptions={addRowsForUncoveredOptions}
                      />
                      <div className="variable-set-recode-card">
                        <div className="explorer-section-header">
                          <strong>Recode preview</strong>
                          <small>{recodePreview.includedOptionLabels.length} included · {recodePreview.excludedOptionLabels.length} excluded</small>
                        </div>
                        <div className="variable-set-recode-grid">
                          <div>
                            <span>Included source options</span>
                            <strong>{recodePreview.includedOptionLabels.length ? recodePreview.includedOptionLabels.join(", ") : "None"}</strong>
                          </div>
                          <div>
                            <span>Excluded source options</span>
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
                      <div className="explorer-section-card compact nested">
                        <div className="explorer-section-header">
                          <strong>Variable logic</strong>
                          <small>Author visible rows, nets, and boxes</small>
                        </div>
                        <div className="explorer-chip-row">
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={resetVariableSetRows}>
                            Reset rows
                          </button>
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={revealAllVariableSetRows}>
                            Reveal all
                          </button>
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={markVariableSetRowsAsDetails}>
                            Mark all detail
                          </button>
                        </div>
                        <div className="explorer-question-list compact">
                          {selectedQuestion.options.map((option) => {
                            const included = variableSetRows.some((row) => row.kind === "option" && row.sourceOptionIds[0] === option.id);
                            const selectedForNet = variableSetOptionSelection.includes(option.id);
                            return (
                              <label key={option.id} className={included || selectedForNet ? "explorer-question-option active" : "explorer-question-option"}>
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={() => toggleVariableSetOptionRow(option.id, option.label)}
                                />
                                <div>
                                  <strong>{option.label}</strong>
                                  <span>
                                    <button type="button" className={selectedForNet ? "mini-button active" : "mini-button"} onClick={() => toggleVariableSetOptionSelection(option.id)}>
                                      {selectedForNet ? "Selected for net" : "Select for net"}
                                    </button>
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="compact-grid">
                          <button type="button" className="secondary" onClick={() => addVariableSetNet("net")}>
                            Add net
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => addVariableSetNet("top")}
                            disabled={selectedQuestion.type !== "single_select"}
                          >
                            Add top 2 box
                          </button>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => addVariableSetNet("bottom")}
                          disabled={selectedQuestion.type !== "single_select"}
                        >
                          Add bottom 2 box
                        </button>
                      </div>
    </>
  );
}

export function VariableSetRowListSection(props: AnalysisAuthoringPanelProps & Pick<VariableSetIssueFocusProps, "showRowsNeedingReview" | "focusedSourceOption" | "onClearFocusedSourceOption">) {
  const {
    selectedQuestion,
    variableSetRows,
    updateVariableSetRow,
    reorderVariableSetRow,
    removeVariableSetRow,
    showRowsNeedingReview = false,
    focusedSourceOption,
    onClearFocusedSourceOption
  } = props;
  const recodeRows = new Map(buildVariableSetRecodePreview(variableSetRows, selectedQuestion).rows.map((row) => [row.rowId, row]));
  const orderedRows = variableSetRows
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder);
  const visibleRows = orderedRows.filter((row) => {
    if (focusedSourceOption) {
      return isAuthoredVariableSetRow(row) && row.sourceOptionIds.includes(focusedSourceOption.id);
    }
    return !showRowsNeedingReview || (isAuthoredVariableSetRow(row) && Boolean(recodeRows.get(row.id)?.needsReview));
  });

	  return (
	    <>
	                        <div className="explorer-item-list compact">
                          {focusedSourceOption && (
                            <div className="variable-set-focus-empty active">
                              <strong>Rows using {focusedSourceOption.label}</strong>
                              <span>{focusedSourceOption.summaryLabel}: {focusedSourceOption.rowLabels.join(", ")}</span>
                              <button type="button" className="secondary" onClick={onClearFocusedSourceOption}>
                                Clear option focus
                              </button>
                            </div>
                          )}
                          {visibleRows.length === 0 && focusedSourceOption && (
                            <div className="variable-set-focus-empty">
                              <strong>No authored rows use {focusedSourceOption.label}</strong>
                              <span>The current rows no longer include this source option.</span>
                            </div>
                          )}
                          {visibleRows.length === 0 && showRowsNeedingReview && !focusedSourceOption && (
                            <div className="variable-set-focus-empty">
                              <strong>No authored rows need review</strong>
                              <span>The current audit has no empty, unknown, or overlapping authored rows.</span>
                            </div>
                          )}
                          {visibleRows
                            .map((row) => {
                              const rowIndex = orderedRows.findIndex((item) => item.id === row.id);
                              return (
                              <div key={row.id} className="explorer-item active variable-set-row">
                                <div className="variable-set-row__top">
                                  <strong>{rowKindLabel(row.kind)}</strong>
                                  <span>{recodeRows.get(row.id)?.sourceSummary ?? "No source options"}</span>
                                </div>
                                <div className="explorer-chip-row variable-set-row__chips">
                                  <span className="explorer-chip">{row.emphasis === "summary" ? "Summary row" : "Detail row"}</span>
                                  <span className="explorer-chip">{row.visible ? "Visible" : "Hidden"}</span>
                                  {recodeRows.get(row.id)?.overlapLabels.length ? (
                                    <span className="explorer-chip warning-chip">Overlap</span>
                                  ) : null}
                                </div>
                                <small className="variable-set-row__composition">
                                  {recodeRows.get(row.id)?.compositionLabel ?? "No source options"}
                                </small>
                                {recodeRows.get(row.id)?.overlapLabels.length ? (
                                  <small className="variable-set-row__warning">
                                    Also used in another authored row: {recodeRows.get(row.id)?.overlapLabels.join(", ")}
                                  </small>
                                ) : null}
                                {isAuthoredVariableSetRow(row) && (
                                  <VariableSetRowCompositionEditor
                                    row={row}
                                    selectedQuestion={selectedQuestion}
                                    recodeRow={recodeRows.get(row.id)}
                                    updateVariableSetRow={updateVariableSetRow}
                                  />
                                )}
                                <input value={row.label} onChange={(event) => updateVariableSetRow(row.id, { label: event.target.value })} />
                                <div className="compact-grid">
                                  <label>
                                    Row style
                                    <select
                                      value={row.emphasis}
                                      onChange={(event) => updateVariableSetRow(row.id, { emphasis: event.target.value as "detail" | "summary" })}
                                    >
                                      <option value="detail">Detail</option>
                                      <option value="summary">Summary</option>
                                    </select>
                                  </label>
                                  <label>
                                    Visibility
                                    <select
                                      value={row.visible ? "visible" : "hidden"}
                                      onChange={(event) => updateVariableSetRow(row.id, { visible: event.target.value === "visible" })}
                                    >
                                      <option value="visible">Visible</option>
                                      <option value="hidden">Hidden</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="variable-set-row__actions">
                                  <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "up")} disabled={rowIndex === 0}>
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => reorderVariableSetRow(row.id, "down")}
                                    disabled={rowIndex === orderedRows.length - 1}
                                  >
                                    Down
                                  </button>
                                  <button type="button" className="secondary" onClick={() => removeVariableSetRow(row.id)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                              );
                            })}
	                        </div>
	    </>
	  );
}
