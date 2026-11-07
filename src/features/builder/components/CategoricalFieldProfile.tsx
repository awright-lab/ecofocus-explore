import { useRemovedControlFocus } from "../hooks/useRemovedControlFocus";
import { formatPercentageSample } from "../../../../shared/analytics/percentagePrecision";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { fieldProfileWorkerThreshold, type ColumnProfileProgress } from "../../data/columnProfileJob";
import { runCategoricalProfileJob } from "../../data/categoricalProfileJob";
import type { ImportedCategoricalProfile } from "../../data/importedCategoricalProfile";
import { buildImportedCategoricalProfile } from "../../data/importedCategoricalProfile";

function CategoryCounts({ dataset, field }: { dataset: ImportedDatasetRecord; field: ImportedDatasetField }) {
  const { targetRef, controlRef } = useRemovedControlFocus();
  const storedRows = dataset.rows.length ? dataset.rows.length : dataset.previewRows.length;
  const background = storedRows >= fieldProfileWorkerThreshold && storedRows >= dataset.rowCount && (field.type === "categorical" || field.modelingRole === "candidate_dimension");
  const synchronous = useMemo(() => background ? null : buildImportedCategoricalProfile(dataset, field), [background, dataset, field]);
  const [attempt, setAttempt] = useState(0);
  const [job, setJob] = useState<{ dataset: ImportedDatasetRecord; field: ImportedDatasetField; progress?: ColumnProfileProgress; profile?: ImportedCategoricalProfile; error?: string; canceled?: boolean } | null>(null);
  const owner = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!background) return;
    const controller = new AbortController(); owner.current = controller;
    setJob({ dataset, field, progress: { phase: "preparing", prepared: 0, total: storedRows } });
    void runCategoricalProfileJob(dataset, field, { signal: controller.signal, onProgress: progress => {
      if (!controller.signal.aborted) setJob({ dataset, field, progress });
    } }).then(profile => {
      if (!controller.signal.aborted) setJob({ dataset, field, profile });
    }, error => {
      if (!controller.signal.aborted) setJob({ dataset, field, error: error instanceof Error ? error.message : "Category summary unavailable." });
    });
    return () => { controller.abort(); if (owner.current === controller) owner.current = null; };
  }, [background, dataset, field, attempt, storedRows]);
  const current = job?.dataset === dataset && job.field === field ? job : null;
  const profile = synchronous ?? current?.profile;
  if (!profile) return <div ref={targetRef} tabIndex={-1} role="region" aria-label="Category field summary" className="category-profile-content">
    {current?.error ? <p role="alert">{current.error}</p> : current?.canceled ? <p role="status">Category summary canceled. Your study has not been changed.</p> : <p role="status">{current?.progress?.phase === "calculating" ? `Counting categories for ${storedRows.toLocaleString()} stored responses in the background…` : `Preparing category values: ${(current?.progress?.phase === "preparing" ? current.progress.prepared : 0).toLocaleString()} of ${storedRows.toLocaleString()}…`}</p>}
    {current?.error || current?.canceled ? <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry category summary</button> : <button ref={controlRef} type="button" onClick={() => { owner.current?.abort(); setJob({ dataset, field, canceled: true }); }}>Cancel category summary</button>}
  </div>;
  if (profile.status === "unavailable") return <p ref={targetRef} tabIndex={-1} aria-label="Category field summary" role="status">{profile.reason}</p>;
  return <div ref={targetRef} tabIndex={-1} role="region" aria-label="Category field summary" className="category-profile-content">
    <p>{profile.rows.toLocaleString()} stored responses; unweighted. Percentages use the {profile.valid.toLocaleString()} nonblank responses.</p>
    <dl><div><dt>Nonblank responses</dt><dd>{profile.valid.toLocaleString()}</dd></div><div><dt>Blank responses</dt><dd>{profile.blank.toLocaleString()}</dd></div><div><dt>Observed categories</dt><dd>{profile.observedCategories.toLocaleString()}</dd></div></dl>
    {!profile.valid ? <p role="status">No category values were recorded. Percentages are unavailable.</p> : <table>
      <caption>Most common categories for {field.variableLabel || field.label}</caption>
      <thead><tr><th scope="col">Category</th><th scope="col">Responses</th><th scope="col">Percent</th></tr></thead>
      <tbody>{profile.categories.map(category => <tr key={category.id}><th scope="row">{category.label}</th><td>{category.count.toLocaleString()}</td><td>{formatPercentageSample(category.share)}%</td></tr>)}</tbody>
    </table>}
    {profile.omittedCategories > 0 && <p>{profile.omittedCategories.toLocaleString()} additional categories with {profile.omittedResponses.toLocaleString()} responses are not shown. Create a response table to see every category.</p>}
    {profile.unusedLabels > 0 && <p>{profile.unusedLabels.toLocaleString()} declared categories have no recorded responses.</p>}
    <small>Each nonblank stored value counts once. Percentages are rounded for display. This is a descriptive count, without statistical testing.</small>
  </div>;
}

export function CategoricalFieldProfile({ dataset, field }: { dataset: ImportedDatasetRecord; field: ImportedDatasetField }) {
  const [open, setOpen] = useState(false);
  return <details className="categorical-field-profile" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Inspect response categories</summary>
    {open && <CategoryCounts dataset={dataset} field={field} />}
  </details>;
}
