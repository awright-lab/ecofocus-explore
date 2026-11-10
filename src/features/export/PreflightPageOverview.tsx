import { useId, useLayoutEffect, useRef } from "react";
import type { PreflightIssue } from "./reportPreflight";
import "./preflight-page-overview.css";

type ReviewedPage = { pageId: string; title: string; issues: PreflightIssue[] };

/** Read-only navigation through the existing preflight findings, not an export approval. */
export function PreflightPageOverview({ pages, selectedId, onSelect }: { pages: ReviewedPage[]; selectedId?: string; onSelect: (pageId: string) => void }) {
  const overviewId = useId(), heading = useRef<HTMLHeadingElement | null>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const displaced = useRef<HTMLButtonElement | null>(null);
  const flagged = pages.map((page, index) => ({ page, ordinal: index + 1 })).filter(({ page }) => page.issues.length > 0);
  const total = flagged.reduce((count, { page }) => count + page.issues.length, 0);
  useLayoutEffect(() => {
    const previous = displaced.current; displaced.current = null;
    if (previous && !previous.isConnected && (!document.activeElement || document.activeElement === document.body) && heading.current?.isConnected && !heading.current.closest("[hidden], [inert]")) heading.current.focus();
  });
  function controlRef(id: string, node: HTMLButtonElement | null) {
    const previous = controls.current.get(id);
    if (!node && previous === document.activeElement) displaced.current = previous;
    if (node) controls.current.set(id, node); else controls.current.delete(id);
  }
  return <section className="preflight-page-overview" aria-labelledby={`${overviewId}-title`}>
    <h3 id={`${overviewId}-title`} ref={heading} tabIndex={-1}>Report attention overview</h3>
    <p>{flagged.length} {flagged.length === 1 ? "page needs" : "pages need"} attention across {total} recorded {total === 1 ? "check" : "checks"}. Choose a page to review its preview and findings below.</p>
    {flagged.length > 0 ? <ul>{flagged.map(({ page, ordinal }) => {
      const counts = new Map<string, number>();
      for (const issue of page.issues) counts.set(issue.check, (counts.get(issue.check) ?? 0) + 1);
      const descriptionId = `${overviewId}-checks-${ordinal}`;
      return <li key={page.pageId}><button type="button" ref={node => controlRef(page.pageId, node)} aria-label={`Review page ${ordinal}: ${page.title}`} aria-describedby={descriptionId} aria-pressed={selectedId === page.pageId} onClick={() => onSelect(page.pageId)}><strong>Page {ordinal}: {page.title}</strong><span id={descriptionId}>{page.issues.length} {page.issues.length === 1 ? "check" : "checks"}: {Array.from(counts, ([check, count]) => `${check} (${count})`).join("; ")}</span></button></li>;
    })}</ul> : <p>No pages need attention in these checks. Other format checks still run during export; inspect the generated file before sharing.</p>}
    <p className="preflight-page-overview-note">Counts describe the checks already shown in this review, not issue severity or export readiness. Optional image decoding and Excel worksheet reviews below are separate.</p>
  </section>;
}
