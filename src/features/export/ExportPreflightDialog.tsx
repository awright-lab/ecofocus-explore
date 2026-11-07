import { useId, useMemo, useRef, useState } from "react";
import type { DashboardDraft } from "../../../shared/types/dashboard";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { buildReportPreflight } from "./reportPreflight";
import { EmbeddedImageReview } from "./EmbeddedImageReview";
import { resolveExportIssueTarget, type ExportIssueTarget } from "./exportIssueTarget";
import { ExcelWorkbookReview } from "./ExcelWorkbookReview";

export function ExportPreflightDialog({ dashboard, onClose, activePageId, onShowIssue }: { dashboard: DashboardDraft; onClose: () => void; activePageId?: string; onShowIssue?: (target: ExportIssueTarget, canMoveFocus: () => boolean) => boolean }) {
  const dialog = useRef<HTMLElement | null>(null), titleId = useId(), helperId = useId();
  const navigationFocus = useRef<{ owner: HTMLButtonElement | null } | undefined>(undefined);
  useModalAccessibility(dialog, onClose, () => navigationFocus.current === undefined || navigationFocus.current.owner !== null);
  const pages = useMemo(() => buildReportPreflight(dashboard), [dashboard]);
  const [selectedId, setSelectedId] = useState(activePageId ?? pages[0]?.pageId ?? "");
  const selected = pages.find(page => page.pageId === selectedId) ?? pages[0];
  const [navigationError, setNavigationError] = useState<string | null>(null);
  function showIssue(target: ExportIssueTarget, control: HTMLButtonElement) {
    const request = { owner: document.activeElement === control ? control : null };
    navigationFocus.current = request;
    const canMoveFocus = () => navigationFocus.current === request && request.owner !== null;
    if (!resolveExportIssueTarget(dashboard, target) || !onShowIssue?.(target, canMoveFocus)) {
      navigationFocus.current = undefined;
      setNavigationError("This page or object is no longer available. Close and reopen the review to check the current report."); return;
    }
    onClose();
  }
  const attention = pages.filter(page => page.issues.length).length;
  return <div className="export-preflight-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={helperId} className="export-preflight-dialog" onBlurCapture={event => { if (navigationFocus.current?.owner === event.target) navigationFocus.current.owner = null; }} onMouseDown={event => event.stopPropagation()}>
      <header><div><h2 id={titleId}>Review before exporting</h2><p id={helperId}>Check analysis settings, page boundaries, overlapping analyses, images, PowerPoint layer preservation and PDF layout. The optional Excel review below inspects worksheet contents and format limits. Final rendering and other format checks still run during export.</p></div><button type="button" onClick={onClose}>Close review</button></header>
      <p role="status">{pages.length} {pages.length === 1 ? "page" : "pages"} reviewed · {attention} {attention === 1 ? "page needs" : "pages need"} attention</p>
      {navigationError && <p role="alert">{navigationError}</p>}
      {selected ? <><label className="export-preflight-page">Review page<select value={selected.pageId} onChange={event => { setSelectedId(event.target.value); setNavigationError(null); }}>{pages.map((page, index) => <option key={page.pageId} value={page.pageId}>{index + 1}. {page.title}{page.issues.length ? ` · ${page.issues.length} ${page.issues.length === 1 ? "check" : "checks"} to review` : ""}</option>)}</select></label>
        <div className="export-preflight-grid"><div className="export-preflight-preview">{selected.pdfSvg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selected.pdfSvg)}`} alt={`PDF layout preview of ${selected.title}`} /> : <p>A PDF layout preview is unavailable until the listed layout issue is resolved.</p>}</div>
          <div><h3>{selected.issues.length ? "Checks to review" : "No issues found in these checks"}</h3>{selected.issues.length ? <ul>{selected.issues.map((issue, index) => <li key={`${issue.check}:${issue.objectId ?? "page"}:${index}`}><strong>{issue.check}</strong><p>{issue.message}</p>{onShowIssue && <button type="button" onClick={event => showIssue({ reportId: dashboard.id, pageId: selected.pageId, objectId: issue.objectId }, event.currentTarget)}>{issue.objectId === undefined ? "Show page properties" : "Show object properties"}</button>}</li>)}</ul> : <p>Review the preview, then check the generated file before sharing it.</p>}</div></div>
      </> : <p>Add a page before exporting this report.</p>}
      <EmbeddedImageReview dashboard={dashboard} />
      <ExcelWorkbookReview dashboard={dashboard} />
    </section>
  </div>;
}
