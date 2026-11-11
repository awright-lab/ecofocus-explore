import { useEffect, useRef, useState } from "react";
import type { ImportedDatasetField } from "../../../../shared/types/dashboard";

type FieldUpdates = Partial<Pick<ImportedDatasetField, "type" | "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner">>;
export function ImportedFieldSettings({ field, remote, onUpdate }: { field: ImportedDatasetField; remote: boolean; onUpdate: (updates: FieldUpdates) => boolean | void | Promise<boolean | void> }) {
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const busy = useRef(false), mounted = useRef(true), currentField = useRef(field.id);
  currentField.current = field.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setError(null); }, [field.id]);
  async function changeType(type: ImportedDatasetField["type"]) {
    if (remote || busy.current) return;
    const fieldId = field.id, categorical = type === "categorical";
    const isCurrent = () => mounted.current && currentField.current === fieldId;
    busy.current = true; setPending(true); setError(null);
    try {
      const saved = await onUpdate({ type, modelingRole: categorical ? "candidate_dimension" : type === "numeric" ? "candidate_measure" : type === "date" ? "candidate_date" : "raw_variable",
        eligibleForFilter: categorical, eligibleForSegment: categorical, eligibleForBanner: categorical });
      if (saved === false && isCurrent()) setError("This field change was not confirmed saved. Check workspace status and retry saving before closing this tab.");
    } catch (reason) {
      if (isCurrent()) setError(reason instanceof Error ? reason.message : "This field change could not be saved. Check workspace status before closing this tab.");
    } finally { busy.current = false; if (mounted.current) setPending(false); }
  }
  return <details className="imported-field-settings">
    <summary>Field settings</summary>
    <label>Interpret values as
      <select aria-label={`Value type for ${field.label}`} value={field.type} disabled={remote || pending} onChange={event => changeType(event.currentTarget.value as ImportedDatasetField["type"])}>
        <option value="categorical">Categories — counts and percentages</option>
        <option value="numeric">Numbers — totals and averages</option>
        <option value="date">Dates — reference field</option>
        <option value="text">Text — reference field</option>
      </select>
    </label>
    {pending && <p role="status">Saving field settings...</p>}
    {error && <p role="alert">{error}</p>}
    <p>{remote ? "Server-backed field settings cannot be changed in this browser workspace." : "Applies to this study in this browser. Stored values and saved snapshots are preserved. Existing tables and charts keep their results until rerun."}</p>
  </details>;
}
