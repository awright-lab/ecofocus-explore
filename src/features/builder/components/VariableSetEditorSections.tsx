import {
  defaultDataset,
  defaultQuestion
} from "../builderConstants";
import { defaultVisualizationForQuestion } from "../../analytics/analyticsDisplay";
import { defaultVariableSetRows, rowKindLabel } from "../../document/documentSeeds";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { buildVariableSetReadinessView, buildVariableSetRecodePreview } from "./variableSetValidationModel";

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

export function VariableSetRowLogicSection(props: AnalysisAuthoringPanelProps) {
  const {
    selectedQuestion,
    resetVariableSetRows,
    revealAllVariableSetRows,
    markVariableSetRowsAsDetails,
    variableSetRows,
    variableSetOptionSelection,
    toggleVariableSetOptionRow,
    toggleVariableSetOptionSelection,
    addVariableSetNet
  } = props;
  const readiness = buildVariableSetReadinessView(variableSetRows, selectedQuestion);
  const recodePreview = buildVariableSetRecodePreview(variableSetRows, selectedQuestion);

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

export function VariableSetRowListSection(props: AnalysisAuthoringPanelProps) {
  const {
    selectedQuestion,
    variableSetRows,
    updateVariableSetRow,
    reorderVariableSetRow,
    removeVariableSetRow
  } = props;
  const recodeRows = new Map(buildVariableSetRecodePreview(variableSetRows, selectedQuestion).rows.map((row) => [row.rowId, row]));

	  return (
	    <>
	                        <div className="explorer-item-list compact">
                          {variableSetRows
                            .slice()
                            .sort((a, b) => a.rowOrder - b.rowOrder)
                            .map((row, index) => (
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
                                  <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "up")} disabled={index === 0}>
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => reorderVariableSetRow(row.id, "down")}
                                    disabled={index === variableSetRows.length - 1}
                                  >
                                    Down
                                  </button>
                                  <button type="button" className="secondary" onClick={() => removeVariableSetRow(row.id)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
	                        </div>
	    </>
	  );
}
