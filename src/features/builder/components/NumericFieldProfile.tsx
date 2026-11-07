import { useRemovedControlFocus } from "../hooks/useRemovedControlFocus";
import { NumericDistribution } from "./NumericDistribution";
import { useEffect, useMemo, useRef, useState } from "react";
import { numericProfileWorkerThreshold, runNumericProfileJob, type NumericProfileProgress } from "../../data/numericProfileJob";
import type { ImportedNumericProfile } from "../../data/importedNumericProfile";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { buildImportedNumericProfile } from "../../data/importedNumericProfile";

export function NumericFieldProfile({ dataset, field, onSummarize }: { dataset: ImportedDatasetRecord; field: ImportedDatasetField; onSummarize?: () => void }) {
  const { targetRef, controlRef } = useRemovedControlFocus();
  const storedRows = dataset.rows.length ? dataset.rows.length : dataset.previewRows.length;
  const background = storedRows >= numericProfileWorkerThreshold && storedRows >= dataset.rowCount;
  const synchronous = useMemo(() => background ? null : buildImportedNumericProfile(dataset, field), [background, dataset, field]);
  const [attempt, setAttempt] = useState(0);
  const [job, setJob] = useState<{ dataset: ImportedDatasetRecord; field: ImportedDatasetField; progress?: NumericProfileProgress; profile?: ImportedNumericProfile; error?: string; canceled?: boolean } | null>(null);
  const owner = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!background) return;
    const controller = new AbortController(); owner.current = controller;
    setJob({ dataset, field, progress: { phase: "preparing", prepared: 0, total: storedRows } });
    void runNumericProfileJob(dataset, field, { signal: controller.signal, onProgress: progress => {
      if (!controller.signal.aborted) setJob({ dataset, field, progress });
    } }).then(profile => {
      if (!controller.signal.aborted) setJob({ dataset, field, profile });
    }, error => {
      if (!controller.signal.aborted) setJob({ dataset, field, error: error instanceof Error ? error.message : "Numeric summary unavailable." });
    });
    return () => { controller.abort(); if (owner.current === controller) owner.current = null; };
  }, [background, dataset, field, attempt, storedRows]);
  const current = job?.dataset === dataset && job.field === field ? job : null;
  const profile = synchronous ?? current?.profile;
  if (!profile) return <section ref={targetRef} tabIndex={-1} className="numeric-field-profile" aria-label="Numeric field summary">
    <strong>Understand this number</strong>
    {current?.error ? <p role="alert">{current.error}</p> : current?.canceled ? <p role="status">Numeric summary canceled. Your study has not been changed.</p> : <p role="status">{current?.progress?.phase === "calculating" ? `Calculating summary for ${storedRows.toLocaleString()} stored responses in the background…` : `Preparing numeric values: ${(current?.progress?.phase === "preparing" ? current.progress.prepared : 0).toLocaleString()} of ${storedRows.toLocaleString()}…`}</p>}
    {current?.error || current?.canceled ? <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry numeric summary</button> : <button ref={controlRef} type="button" onClick={() => { owner.current?.abort(); setJob({ dataset, field, canceled: true }); }}>Cancel numeric summary</button>}
  </section>;
  if (profile.status === "unavailable") return <section ref={targetRef} tabIndex={-1} className="numeric-field-profile" aria-label="Numeric field summary"><strong>Numeric summary unavailable</strong><p>{profile.reason}</p></section>;
  const format = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-US",
    value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e12)
      ? { notation: "scientific", maximumSignificantDigits: 5 } : { maximumFractionDigits: 4 }).format(value);
  const entries: Array<[string, number | null]> = [["Valid numeric values", profile.valid], ["Blank values", profile.blank], ["Invalid numeric values", profile.invalid], ["Distinct numeric values", profile.distinct],
    ["Minimum", profile.minimum], ["Maximum", profile.maximum], ["Mean", profile.mean], ["Median", profile.median], ["Total", profile.total]];
  return <section ref={targetRef} tabIndex={-1} className="numeric-field-profile" aria-label="Numeric field summary">
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
