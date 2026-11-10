import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject, type ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { captureLocalRows, localRowsLimits, rawPage, searchLocalRows, rawSearchDescription, rawSearchUsesText, type LocalRowsSnapshot, type RawSearch } from "../../data/localRowsInspection";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import "./complete-table-dialog.css";
import "./local-rows-dialog.css";
import { StoredFieldFormatSummary } from "./StoredFieldFormatSummary";

function CellButton({ fallback, children, ...props }: ComponentPropsWithoutRef<"button"> & { fallback: RefObject<HTMLElement | null> }) {
  const previous = useRef<HTMLButtonElement | null>(null);
  const ref = useCallback((node: HTMLButtonElement | null) => { if (!node && previous.current && document.activeElement === previous.current) fallback.current?.focus(); previous.current = node; }, [fallback]);
  return <button type="button" {...props} ref={ref}>{children}</button>;
}
function PageControls({ kind, page, pages, onPage }: { kind: string; page: number; pages: number; onPage: (page: number) => void }) {
  const [jump, setJump] = useState(""), [issue, setIssue] = useState("");
  const move = (next: number) => { onPage(Math.min(pages - 1, Math.max(0, next))); setIssue(""); };
  return <div className="complete-table-pager" role="group" aria-label={`${kind} navigation`}>
    <button type="button" aria-disabled={page === 0} onClick={() => move(0)}>First {kind}</button><button type="button" aria-disabled={page === 0} onClick={() => move(page - 1)}>Previous {kind}</button>
    <span>{kind} page {page + 1} of {pages}</span><button type="button" aria-disabled={page === pages - 1} onClick={() => move(page + 1)}>Next {kind}</button><button type="button" aria-disabled={page === pages - 1} onClick={() => move(pages - 1)}>Last {kind}</button>
    <label>Go to {kind} page<input type="number" min={1} max={pages} step={1} value={jump} aria-invalid={!!issue} onChange={e => { setJump(e.target.value); setIssue(""); }}/></label><button type="button" onClick={() => { const n = Number(jump); if (!jump.trim() || !Number.isSafeInteger(n) || n < 1 || n > pages) setIssue(`Enter a whole page from 1 to ${pages}.`); else move(n - 1); }}>Go to {kind} page</button>
    {issue && <span role="alert">{issue}</span>}
  </div>;
}
type Props = { studyId: string; dataset: ImportedDatasetRecord | undefined; onClose: () => void };
type View = { owner: LocalRowsSnapshot | null; rowPage: number; columnPage: number; columnSearch: string; field: string; mode: RawSearch["mode"]; text: string; matchCase: boolean };
export function LocalRowsDialog({ studyId, dataset, onClose }: Props) {
  const caseControl = useRef<HTMLInputElement | null>(null), modeControl = useRef<HTMLSelectElement | null>(null), displacedCase = useRef<HTMLInputElement | null>(null);
  const modal = useRef<HTMLElement | null>(null), fallback = useRef<HTMLHeadingElement | null>(null), titleId = useId(), helpId = useId();
  const [portal] = useState(() => document.fullscreenElement ?? document.body);
  const latest = useRef(dataset), capturedFrom = useRef(dataset); latest.current = dataset;
  const captureOwner = useRef<AbortController | null>(null), searchOwner = useRef<AbortController | null>(null), captureEpoch = useRef(0), searchEpoch = useRef(0);
  const [snapshot, setSnapshot] = useState<LocalRowsSnapshot | null>(null), snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const [attempt, setAttempt] = useState(0), [capturing, setCapturing] = useState(true), [captureMessage, setCaptureMessage] = useState(""), [captureProgress, setCaptureProgress] = useState("");
  const [searching, setSearching] = useState(false), [searchMessage, setSearchMessage] = useState(""), [matches, setMatches] = useState<{ owner: LocalRowsSnapshot; positions: readonly number[]; label: string } | null>(null);
  const [selected, setSelected] = useState<{ owner: LocalRowsSnapshot; row: number; key: string } | null>(null), [savedView, setSavedView] = useState<View | null>(null);
  const closeOwner = useRef<HTMLElement | null>(null);
  const close = () => { closeOwner.current = document.activeElement instanceof HTMLElement && modal.current?.contains(document.activeElement) ? document.activeElement : null; captureEpoch.current++; searchEpoch.current++; captureOwner.current?.abort(); searchOwner.current?.abort(); onClose(); };
  useModalAccessibility(modal, close, () => !!closeOwner.current && (document.activeElement === closeOwner.current || !closeOwner.current.isConnected && document.activeElement === document.body));
  useEffect(() => {
    const controller = new AbortController(), epoch = ++captureEpoch.current, startedWith = latest.current; captureOwner.current = controller;
    searchEpoch.current++; searchOwner.current?.abort(); setSearching(false); setMatches(null); setCapturing(true); setCaptureMessage("");
    void captureLocalRows(studyId, () => latest.current, { signal: controller.signal, onProgress: p => { if (epoch === captureEpoch.current) setCaptureProgress(`${p.phase === "verifying" ? "Verifying snapshot" : "Copying stored rows"}: ${p.completed.toLocaleString()} of ${p.total.toLocaleString()}.`); } }).then(next => {
      if (!controller.signal.aborted && epoch === captureEpoch.current) { capturedFrom.current = startedWith; setSnapshot(next); setCapturing(false); setCaptureProgress(""); setSearchMessage(""); }
    }, error => { if (!controller.signal.aborted && epoch === captureEpoch.current) { setCaptureMessage(error instanceof Error ? error.message : "Inspection unavailable. Your study was not changed."); setCapturing(false); } });
    return () => { captureEpoch.current++; controller.abort(); searchEpoch.current++; searchOwner.current?.abort(); };
  }, [attempt, studyId]);
  const emptyView: View = { owner: snapshot, rowPage: 0, columnPage: 0, columnSearch: "", field: snapshot?.columns[0]?.key ?? "", mode: "contains", text: "", matchCase: false };
  const view = savedView && savedView.owner === snapshot ? savedView : emptyView;
  function edit(patch: Partial<View>) {
    searchEpoch.current++; searchOwner.current?.abort(); setSearching(false); setMatches(null); setSearchMessage(""); setSavedView({ ...view, rowPage: 0, ...patch });
  }
  const allRows = useMemo(() => Object.freeze(Array.from({ length: snapshot?.rows.length ?? 0 }, (_, i) => i)), [snapshot]);
  const positions = matches?.owner === snapshot ? matches.positions : allRows;
  const columns = snapshot?.columns.filter(c => `${c.key}\n${c.label}`.toLowerCase().includes(view.columnSearch.toLowerCase())) ?? [];
  const rowWindow = rawPage(positions.length, view.rowPage, 50), colWindow = rawPage(columns.length, view.columnPage, 12);
  const shownRows = positions.slice(rowWindow.page * 50, rowWindow.end), shownColumns = columns.slice(colWindow.page * 12, colWindow.end);
  async function findRows(mode = view.mode) {
    if (!snapshot || capturing || !snapshot.columns.length) return;
    searchOwner.current?.abort(); const controller = new AbortController(), epoch = ++searchEpoch.current, owner = snapshot; searchOwner.current = controller; setSearching(true); setMatches(null); setSearchMessage("Searching the snapshot, without changing the study or analysis.");
    try {
      const found = await searchLocalRows(owner, { field: view.field, mode, text: view.text, matchCase: view.matchCase }, { signal: controller.signal, onProgress: p => { if (epoch === searchEpoch.current) setSearchMessage(`Searched ${p.completed.toLocaleString()} of ${p.total.toLocaleString()} snapshot rows.`); } });
      if (controller.signal.aborted || epoch !== searchEpoch.current || snapshotRef.current !== owner) return;
      setMatches({ owner, positions: found, label: rawSearchDescription({ field: view.field, mode, text: view.text, matchCase: view.matchCase }) });
      setSavedView(current => current?.owner === owner ? { ...current, mode, rowPage: 0 } : { ...view, mode, rowPage: 0 }); setSearchMessage("Search complete. These are display matches, not an analysis filter.");
    } catch (error) { if (epoch === searchEpoch.current) setSearchMessage(error instanceof Error ? error.message : "Search unavailable; snapshot was kept."); }
    finally { if (epoch === searchEpoch.current) setSearching(false); }
  }
  const textSearch = rawSearchUsesText(view.mode), caseSearch = view.mode === "contains" || view.mode === "exact";
  if (!caseSearch && caseControl.current && document.activeElement === caseControl.current && !caseControl.current.disabled) displacedCase.current = caseControl.current;
  useLayoutEffect(() => { const owner = displacedCase.current; displacedCase.current = null; if (owner?.disabled && (!document.activeElement || document.activeElement === document.body || document.activeElement === owner)) modeControl.current?.focus(); });
  const cell = snapshot && selected?.owner === snapshot ? selected : null, own = !!cell && Object.hasOwn(cell.owner.rows[cell.row], cell.key), raw = cell && own ? cell.owner.rows[cell.row][cell.key] : "";
  return createPortal(<div className="complete-table-backdrop" data-canvas-keyboard-scope="controls" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <section ref={modal} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby={titleId} aria-describedby={helpId} className="complete-table-dialog local-rows-dialog" onBlurCapture={e => { if (closeOwner.current === e.target) closeOwner.current = null; }}>
      <header><div><h2 id={titleId} ref={fallback} tabIndex={-1}>Stored study rows{snapshot ? `: ${snapshot.title}` : ""}</h2><p id={helpId}>Read-only inspection snapshot. Search and paging only change this view; no study, report or analysis is edited or saved.</p></div><button type="button" onClick={close}>Close stored rows</button></header>
      <div className="local-rows-actions"><button type="button" onClick={() => setAttempt(n => n + 1)}>Refresh stored-row snapshot</button><button type="button" aria-disabled={!capturing} onClick={() => { if (!capturing) return; captureEpoch.current++; captureOwner.current?.abort(); setCapturing(false); setCaptureMessage("Inspection canceled. Any previous snapshot is kept; your study was not changed."); }}>Cancel row inspection</button></div>
      {capturing && <p role="status">{captureProgress || "Preparing read-only snapshot."}</p>}{captureMessage && <p role="status">{captureMessage}</p>}
      {snapshot && <p>Source import: {snapshot.importedAt}. Snapshot captured: {snapshot.capturedAt}. File: {snapshot.fileName}. Values stay frozen until an explicit successful refresh. {dataset !== undefined && dataset.id !== studyId ? "A different source will not be substituted." : ""}</p>}
      {snapshot && capturedFrom.current !== dataset && <p role="status">The study context may have changed. This is the captured snapshot; refresh to inspect current data.</p>}
      <div className="local-rows-search"><label>Find stored fields<input maxLength={4096} value={view.columnSearch} onChange={e => setSavedView({ ...view, columnSearch: e.target.value, columnPage: 0 })}/></label>
        <label>Search values in field<select value={view.field} onChange={e => edit({ field: e.target.value })}>{snapshot ? snapshot.columns.map(c => <option key={c.key} value={c.key}>{c.key || "(Empty stored key)"} — {c.label}</option>) : <option value="">No snapshot field yet</option>}</select></label>
        <label>Value matching<select ref={modeControl} value={view.mode} onChange={e => edit({ mode: e.target.value as RawSearch["mode"] })}><option value="contains">Contains text</option><option value="exact">Exact entered text</option><option value="json-exact">Exact escaped JSON string (case-sensitive)</option><option value="empty">Empty stored string</option><option value="missing">Missing property</option><option value="blank">Blank or whitespace string</option><option value="number">Value parsed as a finite number</option><option value="not-number">Nonblank value not parsed as a number</option></select></label>
        <label>Find raw text<textarea rows={2} readOnly={!textSearch} aria-disabled={!textSearch} maxLength={view.mode === "json-exact" ? 6 * localRowsLimits.cellCharacters + 2 : 4096} value={view.text} onChange={e => { if (textSearch) edit({ text: e.target.value }); }}/></label><label className="local-rows-case"><input ref={caseControl} type="checkbox" checked={view.matchCase} disabled={!caseSearch} aria-disabled={!caseSearch} onChange={e => { if (caseSearch) edit({ matchCase: e.target.checked }); }}/>Match case for text searches</label>
      </div><p>Entered text is literal, but browser text controls normalize CR and CRLF to LF. To distinguish original line endings, choose Exact escaped JSON string and paste the full escaped value, including double quotes. That mode is always case-sensitive; \r, \n and \r\n are distinct. Spaces, zeroes and special codes are not recoded. Empty-string and missing-property matching are distinct. Empty Contains text shows all rows; text entry and Match case are used only for text searches. Blank and number checks ignore those settings; your text is kept when you switch modes.</p>
      {(view.mode === "number" || view.mode === "not-number") && <p role="note">This checks the exact stored key with the same number parser as imported-data analysis: decimal points, comma thousands, and optional $ or % notation. Blank or whitespace strings and missing properties are excluded from both number checks. Field meaning, study-specific missing codes and valid statistics are not inferred. Stored values are never converted, recoded or saved.</p>}
      <button type="button" aria-disabled={!snapshot || capturing || searching} onClick={() => { if (!searching) void findRows(); }}>Find rows</button> <button type="button" aria-disabled={!searching} onClick={() => { if (!searching) return; searchEpoch.current++; searchOwner.current?.abort(); setSearching(false); setMatches(null); setSearchMessage("Search canceled. Showing all snapshot rows; your study was not changed."); }}>Cancel row search</button> <button type="button" onClick={() => { edit(emptyView); setSelected(null); }}>Clear row and field searches</button>
      {searchMessage && <p role="status">{searchMessage}</p>}<p role="status">Rows {rowWindow.start}–{rowWindow.end} of {positions.length.toLocaleString()} matching ({snapshot?.rows.length.toLocaleString() ?? 0} stored); fields {colWindow.start}–{colWindow.end} of {columns.length} matching ({snapshot?.columns.length ?? 0} stored/declared keys). {matches?.owner === snapshot ? `Applied display search: ${matches.label}` : "Showing all snapshot rows; Find rows applies the current search."}</p>
      <StoredFieldFormatSummary snapshot={snapshot} field={view.field} unavailable={capturing} onInspect={mode => { edit({ mode }); void findRows(mode); }}/>
      <PageControls kind="rows" page={rowWindow.page} pages={rowWindow.pages} onPage={rowPage => setSavedView({ ...view, rowPage })}/><PageControls kind="fields" page={colWindow.page} pages={colWindow.pages} onPage={columnPage => setSavedView({ ...view, columnPage })}/>
      <div className="complete-table-scroll" tabIndex={0} role="region" aria-label="Stored raw rows, scroll horizontally if needed"><table><caption>Original stored strings — current row and field pages. Select a cell for its full exact value.</caption><thead><tr><th scope="col">Source row position</th>{shownColumns.map(c => <th scope="col" key={c.key}><code>{JSON.stringify(c.key)}</code><small>{c.label}</small></th>)}</tr></thead><tbody>{snapshot && shownRows.map(row => <tr key={row}><th scope="row">{row + 1}</th>{shownColumns.map(c => { const has = Object.hasOwn(snapshot.rows[row], c.key), value = has ? snapshot.rows[row][c.key] : "", preview = has ? JSON.stringify(value.slice(0, 80)) : "No stored property"; return <td key={c.key}><CellButton fallback={fallback} onClick={() => setSelected({ owner: snapshot, row, key: c.key })} aria-label={`Inspect raw value, source row ${row + 1}, stored key ${JSON.stringify(c.key)}: ${preview.slice(0, 100)}`}>{preview.slice(0, 100)}{value.length > 80 || preview.length > 100 ? "…" : ""}</CellButton></td>; })}</tr>)}</tbody></table>{snapshot && (!shownRows.length || !shownColumns.length) && <p>No rows or fields match this view. Clear searches to browse the complete snapshot.</p>}</div>
      <section aria-label="Exact stored value"><h3>Exact stored value</h3><p>{cell ? `Source row ${cell.row + 1}, key ${JSON.stringify(cell.key)}. ${own ? `Own stored string: ${raw.length.toLocaleString()} UTF-16 code units. The escaped JSON value below is reversible and distinguishes CR, LF and CRLF.` : "This row has no own stored property for this key; this is different from an empty string."}` : "Select a visible cell to inspect its full raw value. This selection can remain visible independently of paging or display search."}</p><label>Readable value preview (browser normalizes line endings)<textarea readOnly rows={4} value={raw}/></label><label>Exact escaped JSON value<textarea readOnly rows={4} value={cell && own ? JSON.stringify(raw) : ""}/></label></section>
      <details><summary>Inspection limits and meaning</summary><p>Complete local-file studies only, including prepared copies: up to 50,000 rows, 200 distinct keys, 500,000 stored cells and 8 Mi source characters. Each value may contain up to 65,536 characters. Remote and preview-only rows are not substituted. Snapshot capture and value search yield between chunks and can be canceled; final source verification is synchronous. No native browser speed or memory guarantee is implied. Row positions are file positions, not respondent identities. Values may contain sensitive respondent text; this view makes no network request or export.</p></details>
    </section>
  </div>, portal);
}
