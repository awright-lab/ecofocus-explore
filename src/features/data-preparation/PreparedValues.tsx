import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { captureLocalRows, rawPage, type LocalRowsSnapshot } from "../data/localRowsInspection";

type Props = { dataset: ImportedDatasetRecord; fallback: RefObject<HTMLElement | null> };
// Read-only inspection is separate from recipe application and save attestation.
export default function PreparedValues({ dataset, fallback }: Props) {
  const section = useRef<HTMLElement | null>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const latest = useRef(dataset); latest.current = dataset;
  const task = useRef<AbortController | null>(null), epoch = useRef(0);
  const [pending, setPending] = useState<ImportedDatasetRecord | null>(null);
  const [result, setResult] = useState<{ owner: ImportedDatasetRecord; snapshot: LocalRowsSnapshot } | null>(null);
  const [notice, setNotice] = useState<{ owner: ImportedDatasetRecord; text: string } | null>(null);
  const [view, setView] = useState({ field: "", page: 0, jump: "", issue: "", selected: -1 });
  const body = useRef<HTMLElement | null>(null), departing = useRef<HTMLElement | null>(null);
  const bindBody = useCallback((node: HTMLElement | null) => {
    if (!node && body.current?.contains(document.activeElement)) departing.current = document.activeElement as HTMLElement;
    body.current = node;
  }, []);
  // Refresh removes only the snapshot subtree; the outer busy section stays.
  // Capture ownership at actual removal, not at activation, so a deliberate
  // outside focus/blur before commit cannot be mistaken for retained focus.
  const snapshotControls = useRef<HTMLDivElement | null>(null);
  const bindSnapshotControls = useCallback((node: HTMLDivElement | null) => {
    if (!node && snapshotControls.current?.contains(document.activeElement)) departing.current = document.activeElement as HTMLElement;
    snapshotControls.current = node;
  }, []);
  useLayoutEffect(() => {
    const owner = departing.current; departing.current = null;
    if (owner && !owner.isConnected && document.activeElement === document.body) trigger.current?.focus();
  });
  const bindSection = useCallback((node: HTMLElement | null) => {
    if (!node && section.current?.contains(document.activeElement)) fallback.current?.focus();
    section.current = node;
  }, [fallback]);
  useEffect(() => () => { epoch.current++; task.current?.abort(); }, []);
  useEffect(() => { epoch.current++; task.current?.abort(); task.current = null; setPending(null); setResult(null); setNotice(null); }, [dataset]);
  const snapshot = result?.owner === dataset ? result.snapshot : null, busy = pending === dataset;
  const message = notice?.owner === dataset ? notice.text : "";
  const page = rawPage(snapshot?.rows.length ?? 0, view.page, 50);
  const column = snapshot?.columns.find(c => c.key === view.field) ?? snapshot?.columns[0];
  const selectedRow = snapshot && view.selected >= 0 ? snapshot.rows[view.selected] : undefined;
  const owns = !!selectedRow && !!column && Object.hasOwn(selectedRow, column.key);
  const selectedValue = owns ? selectedRow![column!.key] : "";
  function stop(text: string) {
    epoch.current++; task.current?.abort(); task.current = null; setPending(null); setResult(null); setNotice({ owner: dataset, text });
  }
  async function inspect() {
    if (task.current && !task.current.signal.aborted) return;
    const controller = new AbortController(), attempt = ++epoch.current, owner = dataset; task.current?.abort(); task.current = controller;
    setPending(owner); setResult(null); setNotice({ owner, text: "Copying complete prepared values for read-only inspection." });
    try {
      const captured = await captureLocalRows(owner.id, () => latest.current === owner ? owner : undefined, {
        signal: controller.signal,
        onProgress: progress => { if (attempt === epoch.current && latest.current === owner && !controller.signal.aborted) setNotice({ owner, text: `${progress.phase === "verifying" ? "Verifying" : "Copying"} prepared rows: ${progress.completed.toLocaleString()} of ${progress.total.toLocaleString()}.` }); },
      });
      if (controller.signal.aborted || attempt !== epoch.current || latest.current !== owner) return;
      setResult({ owner, snapshot: captured }); setView({ field: captured.columns[0]?.key ?? "", page: 0, jump: "", issue: "", selected: -1 });
      setNotice({ owner, text: "Complete prepared snapshot ready. Inspection does not apply steps, attest review or save a study." });
    } catch (error) {
      if (!controller.signal.aborted && attempt === epoch.current && latest.current === owner) setNotice({ owner, text: error instanceof Error ? error.message : "Prepared inspection unavailable; the preview is kept." });
    } finally { if (task.current === controller) task.current = null; if (attempt === epoch.current && latest.current === owner) setPending(null); }
  }
  const go = (next: number) => setView(v => ({ ...v, page: Math.max(0, Math.min(page.pages - 1, next)), issue: "", selected: -1 }));
  return <section ref={bindSection} aria-label="Prepared value inspection">
    <h4>Inspect values beyond the first differences</h4>
    <p>Browse every row and declared/stored key in a complete snapshot of this prepared preview. Inspection itself does not add or save a study. Row positions are source positions, not respondent identities.</p>
    <button type="button" ref={trigger} aria-disabled={busy} onClick={() => { if (!busy) void inspect(); }}>{snapshot ? "Refresh prepared value snapshot" : "Inspect all prepared values"}</button>
    {message && <p role="status">{message}</p>}
    {(busy || snapshot) && <section ref={bindBody} tabIndex={-1} aria-label="Prepared snapshot values">
      <button type="button" onClick={() => stop(busy ? "Prepared inspection canceled. Your preview and recipe are kept." : "Prepared value snapshot closed. Your preview and recipe are kept.")}>{busy ? "Cancel prepared value inspection" : "Close prepared value snapshot"}</button>
      {snapshot && <div ref={bindSnapshotControls}>
        <label>Prepared stored field<select value={column?.key ?? ""} onChange={e => setView(v => ({ ...v, field: e.target.value, selected: -1 }))}>{snapshot.columns.map(c => <option key={c.key} value={c.key}>{JSON.stringify(c.key)} - {c.label}</option>)}</select></label>
        <p role="status">Prepared rows {page.start}-{page.end} of {snapshot.rows.length.toLocaleString()}; field {JSON.stringify(column?.key)}. Values are escaped JSON strings; empty string and absent own property are distinct.</p>
        <div role="group" aria-label="Prepared row navigation"><button type="button" aria-disabled={page.page === 0} onClick={() => go(0)}>First prepared rows</button><button type="button" aria-disabled={page.page === 0} onClick={() => go(page.page - 1)}>Previous prepared rows</button><button type="button" aria-disabled={page.page === page.pages - 1} onClick={() => go(page.page + 1)}>Next prepared rows</button><button type="button" aria-disabled={page.page === page.pages - 1} onClick={() => go(page.pages - 1)}>Last prepared rows</button>
          <label>Go to prepared row<input type="number" min={1} max={snapshot.rows.length} step={1} value={view.jump} onChange={e => setView(v => ({ ...v, jump: e.target.value, issue: "" }))} aria-invalid={!!view.issue}/></label><button type="button" onClick={() => { const row = Number(view.jump); if (!view.jump.trim() || !Number.isSafeInteger(row) || row < 1 || row > snapshot.rows.length) setView(v => ({ ...v, issue: `Enter a whole row from 1 to ${snapshot.rows.length}.` })); else go(Math.floor((row - 1) / 50)); }}>Go to prepared row</button>
        </div>{view.issue && <p role="alert">{view.issue}</p>}
        <div className="preparation-table" role="region" tabIndex={0} aria-label="Prepared raw value rows"><table><caption>Read-only prepared values, 50 rows per page. Select a value to inspect its complete escaped string.</caption><thead><tr><th scope="col">Source row position</th><th scope="col">Prepared raw value for {JSON.stringify(column?.key)}</th></tr></thead><tbody>{column && snapshot.rows.slice(page.page * 50, page.end).map((row, index) => { const position = page.page * 50 + index, own = Object.hasOwn(row, column.key), value = own ? JSON.stringify(row[column.key]) : "No own stored property"; return <tr key={position}><th scope="row">{position + 1}</th><td><button type="button" onClick={() => setView(v => ({ ...v, selected: position }))} aria-label={`Inspect prepared value, source row ${position + 1}, stored key ${JSON.stringify(column.key)}`}>{value.slice(0, 120)}{value.length > 120 ? " ..." : ""}</button></td></tr>; })}</tbody></table></div>
        <section aria-label="Complete prepared raw value"><h5>Complete prepared value</h5><p>{selectedRow ? `Source row ${view.selected + 1}; stored key ${JSON.stringify(column?.key)}. ${owns ? `${selectedValue.length.toLocaleString()} UTF-16 code units. The JSON string is reversible: CR, LF and CRLF remain distinct.` : "No own stored property; this is different from an empty string."}` : "Select a value on the current page. The complete escaped value is shown below, without changing or saving it."}</p><label>Complete prepared escaped JSON value<textarea readOnly rows={4} value={selectedRow && owns ? JSON.stringify(selectedValue) : ""}/></label></section>
      </div>}
    </section>}
    <details><summary>Prepared inspection limits</summary><p>Read-only inspection has separate limits: 50,000 rows, 200 distinct keys, 500,000 cells, 8 Mi source characters and 65,536 characters per value. A larger preparation preview is kept when inspection refuses. Capture yields between chunks; final verification is synchronous. No browser speed or memory guarantee. This view uses no network or export and does not confirm the source is unchanged after capture. Refresh explicitly to capture again. Respondent text remains sensitive and unencrypted in the existing preview.</p></details>
  </section>;
}
