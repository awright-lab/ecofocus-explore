import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import {
  buildQuestionSourceDetail,
  buildVariableSetRowDetails,
  buildVariableSetSourceDetail,
  type SourceDetailView
} from "./sourceExplorerModel";

interface SourceDetailPanelProps {
  selectedDataSource: AnalysisAuthoringPanelProps["selectedDataSource"];
  selectedQuestion: QuestionMetadata;
  selectedVariableSet: SavedVariableSet | null;
  variableSetRows: SavedVariableSet["rows"];
  updateVariableSetRow: AnalysisAuthoringPanelProps["updateVariableSetRow"];
  reorderVariableSetRow: AnalysisAuthoringPanelProps["reorderVariableSetRow"];
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

function VariableSetRowRefinement({
  selectedQuestion,
  variableSetRows,
  updateVariableSetRow,
  reorderVariableSetRow
}: Pick<SourceDetailPanelProps, "selectedQuestion" | "variableSetRows" | "updateVariableSetRow" | "reorderVariableSetRow">) {
  const rowDetails = buildVariableSetRowDetails(variableSetRows, selectedQuestion);

  return (
    <div className="source-row-refinement">
      <div className="source-detail-list">
        <span>Draft row refinement</span>
        <div className="source-row-refinement__list">
          {rowDetails.map((row, index) => (
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
              </div>
              {row.composition.length > 0 && (
                <p>{row.composition.join(", ")}</p>
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
                <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "up")} disabled={index === 0}>
                  Up
                </button>
                <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "down")} disabled={index === rowDetails.length - 1}>
                  Down
                </button>
              </div>
            </div>
          ))}
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
  reorderVariableSetRow
}: SourceDetailPanelProps) {
  const detail =
    selectedDataSource.kind === "variableSet" && selectedVariableSet
      ? buildVariableSetSourceDetail(selectedVariableSet, selectedQuestion)
      : buildQuestionSourceDetail(selectedQuestion);
  const showVariableSetRefinement = selectedDataSource.kind === "variableSet" && selectedVariableSet;

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
      {showVariableSetRefinement && (
        <VariableSetRowRefinement
          selectedQuestion={selectedQuestion}
          variableSetRows={variableSetRows}
          updateVariableSetRow={updateVariableSetRow}
          reorderVariableSetRow={reorderVariableSetRow}
        />
      )}
    </div>
  );
}
