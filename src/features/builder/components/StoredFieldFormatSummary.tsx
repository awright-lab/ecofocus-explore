import { useEffect, useRef, useState } from "react";
import { summarizeStoredFieldFormats, type LocalRowsSnapshot, type StoredFieldFormatCounts, type StoredFormatMode } from "../../data/localRowsInspection";

const groups: readonly { mode: StoredFormatMode; label: string }[] = [
  { mode: "number", label: "Parsed finite numbers" },
  { mode: "not-number", label: "Nonblank rejected values" },
  { mode: "blank", label: "Blank or whitespace strings" },
  { mode: "missing", label: "Missing properties" },
];
type Props = { snapshot: LocalRowsSnapshot | null; field: string; unavailable: boolean; onInspect: (mode: StoredFormatMode) => void };
type Context = Pick<Props, "snapshot" | "field" | "unavailable">;
type Outcome = { context: Context; counts?: StoredFieldFormatCounts; message: string };
export function StoredFieldFormatSummary({ snapshot, field, unavailable, onInspect }: Props) {
  const current = useRef<Context>({ snapshot, field, unavailable }); current.current = { snapshot, field, unavailable };
  const operation = useRef<{ controller: AbortController; context: Context } | null>(null);
  const [busy, setBusy] = useState<Context | null>(null), [outcome, setOutcome] = useState<Outcome | null>(null);
  const matches = (context: Context) => context.snapshot === snapshot && context.field === field && !unavailable && !context.unavailable;
  const running = !!busy && matches(busy), valid = outcome && matches(outcome.context) ? outcome : null;
  const ready = !!snapshot && !unavailable && snapshot.columns.some(c => c.key === field);
  useEffect(() => {
    setOutcome(null); setBusy(null);
    return () => { operation.current?.controller.abort(); operation.current = null; };
  }, [snapshot, field, unavailable]);
  async function review() {
    if (!ready || !snapshot || operation.current) return;
    const context: Context = { snapshot, field, unavailable }, controller = new AbortController(), owner = { controller, context };
    operation.current = owner; setBusy(context); setOutcome(null);
    const owns = () => operation.current === owner && !controller.signal.aborted && current.current.snapshot === snapshot && current.current.field === field && !current.current.unavailable;
    try {
      const counts = await summarizeStoredFieldFormats(snapshot, field, { signal: controller.signal, onProgress: p => { if (owns()) setOutcome({ context, message: `Checking stored formats: ${p.completed.toLocaleString()} of ${p.total.toLocaleString()} rows.` }); } });
      if (owns()) setOutcome({ context, counts, message: `Format review complete. The four groups account for all ${counts.total.toLocaleString()} snapshot rows.` });
    } catch (error) { if (owns()) setOutcome({ context, message: error instanceof Error ? error.message : "Format review unavailable. No stored values changed." }); }
    finally { if (operation.current === owner) { operation.current = null; setBusy(null); } }
  }
  function cancel() {
    if (!running) return;
    operation.current?.controller.abort(); operation.current = null; setBusy(null); setOutcome({ context: { snapshot, field, unavailable }, message: "Format review canceled. No partial totals are shown; stored values remain intact." });
  }
  return <section aria-label="Stored field format summary" className="local-rows-format-summary">
    <h3>Review this field’s stored values</h3>
    <p>Exact stored key: <code>{JSON.stringify(field)}</code>. Review all snapshot rows, independently of the current display search. Counts describe stored formats, not analytical eligibility or study-specific missing codes. Percent notation keeps its written numeric magnitude; no values are converted.</p>
    <button type="button" aria-disabled={!ready || running} onClick={() => void review()}>Review field value formats</button>{" "}
    <button type="button" aria-disabled={!running} onClick={cancel}>Cancel field format review</button>
    <p role="status">{valid?.message ?? "Run a review for the selected field and snapshot. No prior field’s totals are substituted."}</p>
    <p>Every row belongs to exactly one format group; blank strings include empty strings.</p>
    <dl>{groups.map(({ mode, label }) => <div key={mode}><dt>{label}</dt><dd><span>{valid?.counts ? valid.counts[mode].toLocaleString() : "Not reviewed"}</span>{valid?.counts ? " rows " : " "}<button type="button" aria-label={`Inspect ${label.toLowerCase()}`} aria-disabled={!valid?.counts || running} onClick={() => { if (valid?.counts && !running) onInspect(mode); }}>Inspect rows</button></dd></div>)}</dl>
    <p>{valid?.counts ? `Total snapshot rows: ${valid.counts.total.toLocaleString()}. Empty strings within the blank group: ${valid.counts.empty.toLocaleString()}.` : "Totals appear only after a complete review. Changing the field or refreshing the snapshot requires a new review."}</p>
  </section>;
}
