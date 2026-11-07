import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { measureWorkspaceStorage } from "../document/workspacePersistence";

type Summary = ReturnType<typeof measureWorkspaceStorage>;
type Entry = { kind: "study"; key: string; name: string; search: string; textBytes: number; study: Summary["studies"][number] }
  | { kind: "snapshot"; key: string; name: string; search: string; textBytes: number; snapshot: Summary["snapshots"][number]; date: string };
const pageSize = 10;

export function formatStorageSize(bytes: number) {
  if (bytes >= 1024 ** 4) return `${(bytes / (1024 ** 4)).toFixed(2)} TiB`;
  if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GiB`;
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function WorkspaceStorageInventory({ summary, current, canReview }: { summary: Summary; current: boolean; canReview: boolean }) {
  const [view, setView] = useState<"studies" | "snapshots">("studies"), [query, setQuery] = useState("");
  const [order, setOrder] = useState("largest"), [page, setPage] = useState(0);
  const search = useRef<HTMLInputElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef<HTMLElement | null>(null), pageFocusOwner = useRef<HTMLButtonElement | null>(null);
  const entries = useMemo<Entry[]>(() => view === "studies" ? summary.studies.map(study => ({
    kind: "study", key: study.key, name: study.title, search: `${study.title} ${study.scope}`.toLowerCase(), textBytes: study.textBytes, study,
  })) : summary.snapshots.map(snapshot => {
    const timestamp = Date.parse(snapshot.publishedAt);
    const date = Number.isFinite(timestamp) ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(timestamp) : "Date unavailable";
    return { kind: "snapshot", key: snapshot.key, name: `${snapshot.title} ${snapshot.versionLabel}`, search: `${snapshot.title} ${snapshot.versionLabel} ${date} ${snapshot.publishedAt}`.toLowerCase(), textBytes: snapshot.textBytes, snapshot, date };
  }), [summary, view]);
  const filtered = useMemo(() => entries.filter(entry => entry.search.includes(query.trim().toLowerCase())).sort((a, b) => order === "largest"
    ? b.textBytes - a.textBytes || a.key.localeCompare(b.key) : a.name.localeCompare(b.name) || a.key.localeCompare(b.key)), [entries, query, order]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1), shownPage = Math.min(page, lastPage);
  const start = shownPage * pageSize, visible = filtered.slice(start, start + pageSize);
  useLayoutEffect(() => {
    if (page !== shownPage) setPage(shownPage);
    const owner = pageFocusOwner.current; pageFocusOwner.current = null;
    if (owner && document.activeElement === owner) { heading.current?.focus(); return; }
    const previous = focused.current;
    const disabled = previous instanceof HTMLButtonElement && previous.disabled;
    if (previous && (!previous.isConnected || disabled) && (!document.activeElement || document.activeElement === document.body || disabled && document.activeElement === previous)) {
      focused.current = null; (disabled ? heading.current : search.current)?.focus();
    }
  });
  function changeView(next: typeof view) { setView(next); setQuery(""); setPage(0); }
  function turnPage(event: MouseEvent<HTMLButtonElement>, next: number) { pageFocusOwner.current = document.activeElement === event.currentTarget ? event.currentTarget : null; setPage(next); }
  const label = view === "studies" ? "Study copies" : "Local snapshots";
  return <section className="storage-inventory" aria-label="Storage inventory" onFocusCapture={event => { focused.current = event.target as HTMLElement; }} onBlurCapture={event => { focused.current = null; if (pageFocusOwner.current === event.target) pageFocusOwner.current = null; }}>
    <div className="storage-inventory__views" role="group" aria-label="Choose storage inventory">
      <button type="button" className="workspace-home-secondary" aria-pressed={view === "studies"} onClick={() => changeView("studies")}>Study copies ({summary.studies.length.toLocaleString()})</button>
      <button type="button" className="workspace-home-secondary" aria-pressed={view === "snapshots"} onClick={() => changeView("snapshots")}>Snapshots ({summary.snapshots.length.toLocaleString()})</button>
    </div>
    <div className="storage-inventory__controls">
      <label>Find {view === "studies" ? "a study or version" : "a snapshot or report"}<input ref={search} type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <label>Sort storage records<select value={order} onChange={event => { setOrder(event.target.value); setPage(0); }}><option value="largest">Largest first</option><option value="name">Name A to Z</option></select></label>
    </div>
    <h3 ref={heading} tabIndex={-1} aria-live="polite">{label}: {filtered.length ? `${(start + 1).toLocaleString()}–${Math.min(start + pageSize, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}` : "0 results"}</h3>
    {visible.length ? <div className="workspace-storage-panel__table" tabIndex={0} role="region" aria-label={`${label} storage records`}><table>
      <caption>{view === "studies" ? "Study copies included in the current save" : "Historical snapshots included in the current save"}</caption>
      <thead>{view === "studies" ? <tr><th scope="col">Study and version</th><th scope="col">Stored coverage</th><th scope="col">Text estimate</th></tr> : <tr><th scope="col">Report and version</th><th scope="col">Includes</th><th scope="col">Total text estimate</th><th scope="col">Review</th></tr>}</thead>
      <tbody>{visible.map(entry => entry.kind === "study" ? <tr key={entry.key}><th scope="row">{entry.study.title}<small>{entry.study.scope}</small></th>
        <td>{entry.study.storedRows.toLocaleString()} / {entry.study.declaredRows.toLocaleString()} rows<br />{entry.study.storedFields.toLocaleString()} / {entry.study.declaredFields.toLocaleString()} fields</td><td>{formatStorageSize(entry.textBytes)}</td></tr>
        : <tr key={entry.key}><th scope="row">{entry.snapshot.title}<small>{entry.snapshot.versionLabel} · {entry.date}</small></th><td>{entry.snapshot.studyCount.toLocaleString()} study {entry.snapshot.studyCount === 1 ? "copy" : "copies"}<small>{entry.snapshot.pageCount.toLocaleString()} report {entry.snapshot.pageCount === 1 ? "page" : "pages"}</small></td>
          <td>{formatStorageSize(entry.textBytes)}<small>{formatStorageSize(entry.snapshot.studyTextBytes)} in study copies</small></td><td>{current && canReview && entry.snapshot.canOpen && entry.snapshot.localPath
            ? <a href={entry.snapshot.localPath} aria-label={`Open local snapshot ${entry.snapshot.versionLabel} of ${entry.snapshot.title}`}>Open local snapshot</a>
            : <span>{!current ? "Refresh details to open" : !canReview ? "Save or retry before opening" : "Version link unavailable"}</span>}</td></tr>)}</tbody>
    </table></div> : <p>{query.trim() ? `No ${view === "studies" ? "study copies" : "snapshots"} match this search.` : view === "studies" ? "No imported study copies are stored in this workspace." : "No historical snapshots are stored in this workspace."}</p>}
    <div className="storage-inventory__pages" role="group" aria-label="Storage inventory pages"><button type="button" className="workspace-home-secondary" disabled={shownPage === 0} onClick={event => turnPage(event, shownPage - 1)}>Previous storage records</button>
      <span>Page {(shownPage + 1).toLocaleString()} of {(lastPage + 1).toLocaleString()}</span><button type="button" className="workspace-home-secondary" disabled={shownPage === lastPage} onClick={event => turnPage(event, shownPage + 1)}>Next storage records</button></div>
    <p className="workspace-storage-panel__note">Snapshot totals include their historical study copies and report content. Current library copies count separately; historical study-copy sizes are already inside each snapshot total. Snapshot links open versions saved in this browser. Links require a readable saved copy and no pending save. Refresh details after saving or changing the workspace.</p>
  </section>;
}
