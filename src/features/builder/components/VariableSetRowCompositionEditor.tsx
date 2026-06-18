import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";
import {
  isAuthoredVariableSetRow,
  toggleVariableSetRowSourceOption,
  type VariableSetRowRecodePreview
} from "./variableSetValidationModel";

interface VariableSetRowCompositionEditorProps {
  row: SavedVariableSet["rows"][number];
  selectedQuestion: QuestionMetadata;
  recodeRow: VariableSetRowRecodePreview | undefined;
  updateVariableSetRow: (rowId: string, updates: Partial<SavedVariableSet["rows"][number]>) => void;
  compact?: boolean;
}

export function VariableSetRowCompositionEditor({
  row,
  selectedQuestion,
  recodeRow,
  updateVariableSetRow,
  compact = false
}: VariableSetRowCompositionEditorProps) {
  if (!isAuthoredVariableSetRow(row)) return null;

  return (
    <div className={compact ? "row-composition-editor compact" : "row-composition-editor"}>
      <div className="row-composition-editor__header">
        <span>Source options</span>
        <strong>{recodeRow?.sourceSummary ?? "No source options"}</strong>
      </div>
      {recodeRow && (
        <div className="row-composition-intent">
          <strong>{recodeRow.intentLabel}</strong>
          <span>{recodeRow.intentHelper}</span>
        </div>
      )}
      {recodeRow?.issueLabels.length ? (
        <div className="row-issue-chip-row" aria-label="Row issues">
          {recodeRow.issueLabels.map((issue) => (
            <span className="row-issue-chip" key={issue}>{issue}</span>
          ))}
        </div>
      ) : null}
      <div className="row-composition-editor__options">
        {selectedQuestion.options.map((option) => {
          const checked = row.sourceOptionIds.includes(option.id);
          const overlaps = recodeRow?.overlapLabels.includes(option.label) ?? false;
          return (
            <label className={checked ? "row-composition-option active" : "row-composition-option"} key={option.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => updateVariableSetRow(row.id, { sourceOptionIds: toggleVariableSetRowSourceOption(row, option.id) })}
              />
              <span>{option.label}</span>
              {overlaps && <small>Overlap</small>}
            </label>
          );
        })}
      </div>
      {recodeRow?.unknownSourceOptionIds.length ? (
        <small className="row-composition-editor__warning">
          Unknown source options: {recodeRow.unknownSourceOptionIds.join(", ")}
        </small>
      ) : null}
    </div>
  );
}
