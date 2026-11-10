import { Component, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DashboardPage } from "../../../../shared/types/dashboard";
import { DocumentPreview } from "../../document/DocumentPreview";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import { reportObjectMatchKey, resolveReportObjectMatch, searchReportObjects, type ReportObjectFilters, type ReportObjectMatch } from "./reportObjectSearch";
import "./report-navigator.css";

export const navigatorLimits = { pages: 12, objects: 25 } as const;
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <span className="navigator-preview-error">Preview unavailable. You can still open this page.</span> : this.props.children; }
}
export function NavigatorPreview({ page }: { page: DashboardPage }) {
  return <PreviewBoundary key={page.id}><DocumentPreview page={page} /></PreviewBoundary>;
}
export function NavigatorPagination({ page, total, size, onChange, label }: { page: number; total: number; size: number; onChange: (page: number) => void; label: string }) {
  const count = Math.max(1, Math.ceil(total / size));
  return <nav className="navigator-pagination" aria-label={label}>
    <button type="button" aria-disabled={!page} onClick={() => { if (page > 0) onChange(0); }} aria-label={`${label}: first`}>First</button>
    <button type="button" aria-disabled={!page} onClick={() => { if (page > 0) onChange(page - 1); }} aria-label={`${label}: previous`}>Previous</button>
    <span>Page {page + 1} of {count}</span>
    <button type="button" aria-disabled={page >= count - 1} onClick={() => { if (page < count - 1) onChange(page + 1); }} aria-label={`${label}: next`}>Next</button>
    <button type="button" aria-disabled={page >= count - 1} onClick={() => { if (page < count - 1) onChange(count - 1); }} aria-label={`${label}: last`}>Last</button>
  </nav>;
}
function matchLabel(match: ReportObjectMatch) { return match.kind === "tile" ? match.object.title || match.object.name : match.object.name; }
function matchType(match: ReportObjectMatch) { return match.kind === "tile" ? "Analysis" : match.object.type === "rectangle" || match.object.type === "circle" ? "Shape" : match.object.type; }
function status(match: ReportObjectMatch) { return `${match.object.hidden ? "Hidden" : "Visible"} · ${match.object.locked ? "Locked" : "Unlocked"}`; }

export function ReportNavigator({ pages, activePageId, initialQuery = "", onClose, onPage, onObject }: {
  pages: DashboardPage[]; activePageId: string; initialQuery?: string;
  onClose: () => void; onPage: (page: DashboardPage) => void; onObject: (match: ReportObjectMatch) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null), searchInput = useRef<HTMLInputElement>(null);
  useModalAccessibility(dialog, onClose);
  const id = useId();
  const [mode, setMode] = useState<"pages" | "objects">(initialQuery ? "objects" : "pages");
  const [query, setQuery] = useState(initialQuery), [filters, setFilters] = useState<ReportObjectFilters>({});
  const [pagination, setPagination] = useState({ criteria: "", index: 0 });
  const [issue, setIssue] = useState("");
  const criteria = JSON.stringify([mode, query, filters]);
  const requested = pagination.criteria === criteria ? pagination.index : 0;
  const all = mode === "objects" ? searchReportObjects(pages, query, { browse: true, filters, offset: requested * navigatorLimits.objects, limit: navigatorLimits.objects }) : null;
  const pageMatches = mode === "pages" ? pages.filter(page => `${page.order} ${page.title}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const total = all?.total ?? pageMatches.length, size = mode === "pages" ? navigatorLimits.pages : navigatorLimits.objects;
  const index = Math.min(requested, Math.max(0, Math.ceil(total / size) - 1));
  const result = all && index !== requested ? searchReportObjects(pages, query, { browse: true, filters, offset: index * size, limit: size }) : all;
  const setIndex = (next: number) => { setPagination({ criteria, index: next }); setIssue(""); };
  // Same-reference updates are intentional: identity and eligibility are checked on every render and activation.
  const current = useRef({ pages, query, filters, criteria });
  useLayoutEffect(() => { current.current = { pages, query, filters, criteria }; });
  const focusedResult = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const node = focusedResult.current;
    if (node && !node.isConnected && document.activeElement === document.body) { searchInput.current?.focus(); focusedResult.current = null; }
  });
  function activate(match: ReportObjectMatch, receipt: string) {
    const now = current.current;
    const resolved = receipt === now.criteria ? resolveReportObjectMatch(now.pages, now.query, match, { browse: true, filters: now.filters }) : null;
    if (!resolved) { setIssue("That object changed, was removed, or no longer matches the filters. Search again. Nothing was changed."); searchInput.current?.focus(); return; }
    onObject(resolved); onClose();
  }
  function activatePage(pageId: string, receipt: string) {
    const now = current.current;
    const found = now.pages.filter(page => page.id === pageId);
    if (receipt !== now.criteria || found.length !== 1 || !`${found[0].order} ${found[0].title}`.toLowerCase().includes(now.query.trim().toLowerCase())) {
      setIssue("That page changed, was removed, no longer matches the search, or has an ambiguous identity. Nothing was changed.");
      searchInput.current?.focus(); return;
    }
    onPage(found[0]); onClose();
  }
  const active = pages.find(page => page.id === activePageId);
  const target = document.fullscreenElement ?? document.body;
  return createPortal(<div className="report-navigator-backdrop" onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
    <div ref={dialog} className="report-navigator" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} tabIndex={-1} data-canvas-keyboard-scope="controls" data-builder-shortcuts="off" onKeyDown={event => event.stopPropagation()}>
      <header className="navigator-header"><div><span className="navigator-eyebrow">REPORT NAVIGATOR</span><h2 id={`${id}-title`}>Your report, at a glance</h2><p id={`${id}-help`}>Explore pages or find an exact object. Opening hidden or locked objects keeps them hidden or locked.</p>{active && <p className="navigator-location">Current page {active.order}: {active.title}</p>}</div><button type="button" onClick={onClose} aria-label="Close report navigator">Close ✕</button></header>
      <div className="navigator-toolbar">
        <div className="navigator-modes" role="group" aria-label="Browse mode"><button type="button" aria-pressed={mode === "pages"} onClick={() => { setMode("pages"); setQuery(""); }}>Page overview</button><button type="button" aria-pressed={mode === "objects"} onClick={() => { setMode("objects"); setQuery(""); }}>Find objects</button></div>
        <label className="navigator-search">{mode === "pages" ? "Search page titles or numbers" : "Search object names and written text"}<input ref={searchInput} type="search" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setIssue(""); }} placeholder={mode === "pages" ? "Find a page…" : "Chart title, field label, or excerpt…"} /></label>
        {mode === "objects" && <div className="navigator-filters">
          <label>Page<select aria-label="Page" value={filters.pageId ?? ""} onChange={e => setFilters({ ...filters, pageId: e.target.value || undefined })}><option value="">All pages</option>{filters.pageId && !pages.some(page => page.id === filters.pageId) && <option value={filters.pageId}>Removed page — choose another</option>}{pages.map((page, ordinal) => <option key={`${page.id}:${ordinal}`} value={page.id}>{page.order}. {page.title}</option>)}</select></label>
          <label>Object type<select aria-label="Object type" value={filters.type ?? ""} onChange={e => setFilters({ ...filters, type: (e.target.value || undefined) as ReportObjectFilters["type"] })}><option value="">All types</option><option value="tile">All analyses</option><option value="chart">Charts</option><option value="table">Tables</option><option value="text">Text</option><option value="shape">Shape</option><option value="image">Image</option></select></label>
          <label>Visibility<select aria-label="Visibility" value={filters.visibility ?? ""} onChange={e => setFilters({ ...filters, visibility: (e.target.value || undefined) as ReportObjectFilters["visibility"] })}><option value="">Visible and hidden</option><option value="visible">Visible only</option><option value="hidden">Hidden only</option></select></label>
          <label>Lock status<select aria-label="Lock status" value={filters.locking ?? ""} onChange={e => setFilters({ ...filters, locking: (e.target.value || undefined) as ReportObjectFilters["locking"] })}><option value="">Locked and unlocked</option><option value="locked">Locked only</option><option value="unlocked">Unlocked only</option></select></label>
        </div>}
      </div>
      <div className="navigator-content">
        <p className="navigator-count" role="status">{total ? `${index * size + 1}–${Math.min((index + 1) * size, total)} of ${total}` : "0"} {mode === "pages" ? "pages" : "objects"}{mode === "objects" && ". Names, source labels and authored text only; no analytical data is searched."}</p>
        {result?.issue && <p role="status">{result.issue}</p>}{issue && <p role="alert">{issue}</p>}
        {!total && <div className="navigator-empty"><h3>No {mode === "pages" ? "pages" : "objects"} found</h3><p>{filters.pageId && !pages.some(page => page.id === filters.pageId) ? "The filtered page was removed. Choose another page or All pages." : "Try another search or broaden the filters."}</p></div>}
        {mode === "pages" ? <div className="navigator-page-grid">{pageMatches.slice(index * size, (index + 1) * size).map((page, ordinal) => { const pageId = page.id; return <button type="button" className="navigator-page-card" key={`${page.id}:${ordinal}`} aria-current={page.id === activePageId ? "page" : undefined} aria-label={`Open page ${page.order}: ${page.title}, ${page.tiles.length + page.elements.length} objects${page.id === activePageId ? ", current page" : ""}`} onFocus={event => { focusedResult.current = event.currentTarget; }} onBlur={() => { focusedResult.current = null; }} onClick={() => activatePage(pageId, criteria)}><div className="navigator-page-preview" aria-hidden="true"><NavigatorPreview page={page} /></div><div className="navigator-page-caption"><span className="navigator-page-number">{page.order}</span><div><strong>{page.title}</strong><small>{page.tiles.length} analyses · {page.elements.length} objects</small></div>{page.id === activePageId && <span className="navigator-current">Current</span>}</div></button>; })}</div> : <ol className="navigator-object-list" start={index * size + 1}>{result?.matches.map((match, ordinal) => <li key={`${reportObjectMatchKey(match)}:${ordinal}`}><button type="button" className="navigator-object" onFocus={event => { focusedResult.current = event.currentTarget; }} onBlur={() => { focusedResult.current = null; }} aria-label={`Find ${matchType(match)} ${matchLabel(match)}, object ${index * size + ordinal + 1} of ${total}, page ${match.page.order}: ${match.page.title}. ${status(match)}.`} aria-describedby={match.excerpt ? `${id}-excerpt-${ordinal}` : undefined} onClick={() => activate(match, criteria)}><span className="navigator-object-type">{matchType(match)}</span><span><strong>{matchLabel(match)}</strong><small>Page {match.page.order}: {match.page.title} · {status(match)}</small>{match.kind === "tile" && match.object.name !== matchLabel(match) && <small>Analysis name: {match.object.name}</small>}{match.excerpt && <span className="navigator-excerpt" id={`${id}-excerpt-${ordinal}`}>{match.excerpt}</span>}</span><span aria-hidden="true">↗</span></button></li>)}</ol>}
      </div>
      <footer><NavigatorPagination page={index} total={total} size={size} onChange={setIndex} label={mode === "pages" ? "Page overview pagination" : "Object results pagination"} /><small>Read-only navigation · Escape to close</small></footer>
    </div>
  </div>, target);
}
