import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { buildQuestionSourceDetail, buildVariableSetSourceDetail, type SourceDetailView } from "./sourceExplorerModel";

interface SourceDetailPanelProps {
  selectedDataSource: AnalysisAuthoringPanelProps["selectedDataSource"];
  selectedQuestion: QuestionMetadata;
  selectedVariableSet: SavedVariableSet | null;
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

export function SourceDetailPanel({ selectedDataSource, selectedQuestion, selectedVariableSet }: SourceDetailPanelProps) {
  const detail =
    selectedDataSource.kind === "variableSet" && selectedVariableSet
      ? buildVariableSetSourceDetail(selectedVariableSet, selectedQuestion)
      : buildQuestionSourceDetail(selectedQuestion);

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
    </div>
  );
}
