import { NumericDistribution } from "./NumericDistribution";
import { useMemo } from "react";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { buildImportedNumericProfile } from "../../data/importedNumericProfile";

export function NumericFieldProfile({ dataset, field, onSummarize }: { dataset: ImportedDatasetRecord; field: ImportedDatasetField; onSummarize?: () => void }) {
  const profile = useMemo(() => buildImportedNumericProfile(dataset, field), [dataset, field]);
  if (profile.status === "unavailable") return <section className="numeric-field-profile" aria-label="Numeric field summary"><strong>Numeric summary unavailable</strong><p>{profile.reason}</p></section>;
  const format = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-US",
    value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e12)
      ? { notation: "scientific", maximumSignificantDigits: 5 } : { maximumFractionDigits: 4 }).format(value);
  const entries: Array<[string, number | null]> = [["Valid numeric values", profile.valid], ["Blank values", profile.blank], ["Invalid numeric values", profile.invalid], ["Distinct numeric values", profile.distinct],
    ["Minimum", profile.minimum], ["Maximum", profile.maximum], ["Mean", profile.mean], ["Median", profile.median], ["Total", profile.total]];
  return <section className="numeric-field-profile" aria-label="Numeric field summary">
    <strong>Understand this number</strong>
    <p>{profile.rows.toLocaleString()} stored responses; unweighted. Blank and invalid values are excluded from statistics.</p>
    {!profile.valid && <p role="status">No valid numeric values. Statistics are unavailable.</p>}
    <dl>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{format(value)}</dd></div>)}</dl>
    <NumericDistribution bins={profile.distribution} valid={profile.valid} label={field.variableLabel || field.label} />
    <small>Numbers are rounded for display; very small or large values use scientific notation. For an even sample, the median is the midpoint of the two middle values.</small>
    {onSummarize && <button type="button" onClick={onSummarize} disabled={!profile.valid || dataset.remote?.provider === "netlify"}>Summarize all respondents</button>}
    {onSummarize && dataset.remote?.provider === "netlify" && <small>Overall numeric summaries are not yet supported for server-backed studies. Use a grouped analysis.</small>}
    {profile.warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}
  </section>;
}
