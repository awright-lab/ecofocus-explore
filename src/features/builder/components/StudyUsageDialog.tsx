import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StudyUsageInspection } from "../../document/studyUsageInspection";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import "./complete-table-dialog.css";
import "./study-usage-dialog.css";

type Props = { datasetId: string; inspect: (datasetId: string) => StudyUsageInspection; onClose: () => void };
export function StudyUsageDialog({ datasetId, inspect, onClose }: Props) {
  const modal = useRef<HTMLElement | null>(null), closeOwner = useRef<HTMLElement | null>(null), latest = useRef(inspect); latest.current = inspect;
  const titleId = useId(), helpId = useId();
  const [portal] = useState(() => document.fullscreenElement ?? document.body);
  const [captured, setCaptured] = useState<{ snapshot: StudyUsageInspection | null; issue: string }>(() => read());
  const [view, setView] = useState<"references" | "copies" | "safeguards">("references"), [query, setQuery] = useState(""), [page, setPage] = useState(0);
  function read() {
    try { const snapshot = latest.current(datasetId); if (snapshot.datasetId !== datasetId) throw Error("Usage inspection returned a different study; no alternate source was shown."); return { snapshot, issue: "" }; }
    catch (error) { return { snapshot: null, issue: error instanceof Error ? error.message : "Usage could not be inspected. No data was changed." }; }
  }
  function refresh() { const next = read(); setCaptured(previous => next.snapshot ? next : { snapshot: previous.snapshot?.datasetId === datasetId ? previous.snapshot : null, issue: next.issue + (previous.snapshot?.datasetId === datasetId ? " Previous inspection kept; its timestamp still applies." : "") }); if (next.snapshot) setPage(0); }
  function close() { closeOwner.current = document.activeElement instanceof HTMLElement && modal.current?.contains(document.activeElement) ? document.activeElement : null; onClose(); }
  useModalAccessibility(modal, close, () => !!closeOwner.current && (document.activeElement === closeOwner.current || !closeOwner.current.isConnected && document.activeElement === document.body));
  const snapshot = captured.snapshot?.datasetId === datasetId ? captured.snapshot : null;
  const entries = useMemo(() => !snapshot ? [] : view !== "copies" ? (view === "references" ? snapshot.references : snapshot.safeguards).map((item, index) => ({ index, title: item.reportTitle, detail: item.location, identity: item.reportId })) : snapshot.copies.map((item, index) => ({ index, title: item.reportTitle, detail: `${item.versionLabel} | Published ${item.publishedAt} | Study ${item.studyTitle} | Import ${item.importedAt}`, identity: `${item.reportId} / ${item.snapshotId}` })), [snapshot, view]);
  const filtered = entries.filter(item => `${item.title}\n${item.detail}\n${item.identity}`.toLowerCase().includes(query.toLowerCase())), pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages - 1), visible = filtered.slice(currentPage * 20, (currentPage + 1) * 20);
  return createPortal(<div className="complete-table-backdrop" data-canvas-keyboard-scope="controls" onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
    <section ref={modal} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={helpId} className="complete-table-dialog study-usage-dialog" tabIndex={-1} onBlurCapture={event => { if (closeOwner.current === event.target) closeOwner.current = null; }}>
      <header><div><h2 id={titleId}>Where this study is used{snapshot ? `: ${snapshot.title}` : ""}</h2><p id={helpId}>Read-only reference snapshot. No rows, reports, editing history or browser storage are changed. This is not permission to remove a study.</p></div><button type="button" onClick={close}>Close study usage</button></header>
      <button type="button" onClick={refresh}>Refresh study usage</button>
      {captured.issue && <p role="status">{captured.issue}</p>}
      {snapshot && <><p>Study ID: <code>{snapshot.datasetId}</code>. Current import: {snapshot.importedAt}. Inspected: {snapshot.capturedAt}. {snapshot.context}. Refresh explicitly after changes; these details do not update automatically.</p>
        {snapshot.unknownDependencies && <p role="status" className="study-usage-note">Some saved insight plans cannot be read. Their complete source dependencies are unknown; the existing removal safeguards still apply.</p>}
        {snapshot.editorBlocker && <p role="status" className="study-usage-note">Current editor retention: {snapshot.editorBlocker}</p>}
        <div role="group" aria-label="Study usage views"><button type="button" aria-pressed={view === "references"} onClick={() => { setView("references"); setPage(0); }}>Current references ({snapshot.references.length})</button><button type="button" aria-pressed={view === "copies"} onClick={() => { setView("copies"); setPage(0); }}>Historical copies ({snapshot.copies.length})</button><button type="button" aria-pressed={view === "safeguards"} onClick={() => { setView("safeguards"); setPage(0); }}>Needs review ({snapshot.safeguards.length})</button></div>
      </>}
      <label>Find a report, item or version<input type="search" maxLength={4096} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label>
      <p role="status">{view === "references" ? "Recorded references" : view === "copies" ? "Historical copies" : "Review safeguards"}: {filtered.length ? `${currentPage * 20 + 1}-${Math.min((currentPage + 1) * 20, filtered.length)} of ${filtered.length}` : "0 matches"}.</p>
      <div className="complete-table-scroll" tabIndex={0} role="region" aria-label="Study usage records"><table><caption>{view === "references" ? "Recorded report and saved-item dependencies" : view === "copies" ? "Snapshot-owned study copies with this identifier" : "Reports and snapshots with unknown source dependencies"}</caption><thead><tr><th scope="col">Report or library</th><th scope="col">Recorded item or version</th><th scope="col">Identity</th></tr></thead><tbody>{visible.map(item => <tr key={item.index}><th scope="row">{item.title}</th><td>{item.detail}</td><td><code>{item.identity}</code></td></tr>)}</tbody></table>{!visible.length && <p>{query ? "No records match this search." : snapshot ? "No records in this view were found in this inspection. Other retention and removal checks may still apply." : "No usage snapshot available."}</p>}</div>
      <div className="complete-table-pager" role="group" aria-label="Study usage pages"><button type="button" aria-disabled={currentPage === 0} onClick={() => setPage(Math.max(0, currentPage - 1))}>Previous usage records</button><span>Page {currentPage + 1} of {pages}</span><button type="button" aria-disabled={currentPage === pages - 1} onClick={() => setPage(Math.min(pages - 1, currentPage + 1))}>Next usage records</button></div>
      <p className="study-usage-note">Current references use the same dependency rules as removal, including saved audiences, coding, analyses, calculations, layouts, evidence and legacy snapshot dependencies. Historical copies are separate snapshot-owned records; the same identifier does not prove the same data version. Removing the current library study does not remove those copies. This view shows recorded metadata only, not response rows, externally stored files or an exhaustive browser backup inventory. Removal always rechecks current state separately.</p>
    </section>
  </div>, portal);
}
