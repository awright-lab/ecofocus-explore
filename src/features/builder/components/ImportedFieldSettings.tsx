import type { ImportedDatasetField } from "../../../../shared/types/dashboard";

type FieldUpdates = Partial<Pick<ImportedDatasetField, "type" | "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner">>;
export function ImportedFieldSettings({ field, remote, onUpdate }: { field: ImportedDatasetField; remote: boolean; onUpdate: (updates: FieldUpdates) => void }) {
  function changeType(type: ImportedDatasetField["type"]) {
    if (remote) return;
    const categorical = type === "categorical";
    onUpdate({ type, modelingRole: categorical ? "candidate_dimension" : type === "numeric" ? "candidate_measure" : type === "date" ? "candidate_date" : "raw_variable",
      eligibleForFilter: categorical, eligibleForSegment: categorical, eligibleForBanner: categorical });
  }
  return <details className="imported-field-settings">
    <summary>Field settings</summary>
    <label>Interpret values as
      <select aria-label={`Value type for ${field.label}`} value={field.type} disabled={remote} onChange={event => changeType(event.currentTarget.value as ImportedDatasetField["type"])}>
        <option value="categorical">Categories — counts and percentages</option>
        <option value="numeric">Numbers — totals and averages</option>
        <option value="date">Dates — reference field</option>
        <option value="text">Text — reference field</option>
      </select>
    </label>
    <p>{remote ? "Server-backed field settings cannot be changed in this browser workspace." : "Applies to this study in this browser. Stored values and saved snapshots are preserved. Existing tables and charts keep their results until rerun."}</p>
  </details>;
}
