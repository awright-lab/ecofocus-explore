import { PreflightPageOverview } from "./PreflightPageOverview";
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
      <PreflightPageOverview pages={pages} selectedId={selected?.pageId} onSelect={pageId => {
        if (dashboard.pages.filter(page => page.id === pageId).length !== 1 || pages.filter(page => page.pageId === pageId).length !== 1) { setNavigationError("This page is no longer available. Close and reopen the review to check the current report."); return; }
        setSelectedId(pageId); setNavigationError(null);
      }} />
      {selected ? <><label className="export-preflight-page">Review page<select value={selected.pageId} onChange={event => { setSelectedId(event.target.value); setNavigationError(null); }}>{pages.map((page, index) => <option key={page.pageId} value={page.pageId}>{index + 1}. {page.title}{page.issues.length ? ` · ${page.issues.length} ${page.issues.length === 1 ? "check" : "checks"} to review` : ""}</option>)}</select></label>
        <div className="export-preflight-grid"><div className="export-preflight-preview">{selected.pdfSvg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selected.pdfSvg)}`} alt={`PDF layout preview of ${selected.title}`} /> : <p>A PDF layout preview is unavailable until the listed layout issue is resolved.</p>}</div>
          <div><h3>{selected.issues.length ? "Checks to review" : "No issues found in these checks"}</h3>{selected.issues.length ? <ul>{selected.issues.map((issue, index) => <li key={`${issue.check}:${issue.objectId ?? "page"}:${index}`}><strong>{issue.check}</strong><p>{issue.message}</p>{onShowIssue && <button type="button" onClick={event => showIssue({ reportId: dashboard.id, pageId: selected.pageId, objectId: issue.objectId }, event.currentTarget)}>{issue.objectId === undefined ? "Show page properties" : "Show object properties"}</button>}</li>)}</ul> : <p>Review the preview, then check the generated file before sharing it.</p>}</div></div>
        <section aria-label="PowerPoint editability">
          <h3>PowerPoint editability</h3>
          <p>This is a composition check, not a PowerPoint rendering test or export approval. Resolve the checks above and inspect the generated file before sharing.</p>
          {selected.pptxEditability.available ? <>
            <p>{selected.pptxEditability.mode === "complete_visual" ? "One complete slide image" : selected.pptxEditability.editableObjects + selected.pptxEditability.editableCharts > 0 ? "Ordered transparent image layers with editable objects" : "Ordered image layers without editable objects"}</p>
            <p>{selected.pptxEditability.editableObjects} editable text or shape objects; {selected.pptxEditability.editableCharts} editable chart bodies; {selected.pptxEditability.imageObjects} objects included only in image layers.</p>
            <p>{selected.pptxEditability.rasterLayers} raster image layers preserve the page background and image-only content. Native chart layout and text wrapping may differ in PowerPoint.</p>
            <p>The background and chart titles, labels outside the chart body, and context remain in image layers. These layers follow the report stacking order; tables and unsupported objects remain images. Image-only content stays editable in the builder.</p>
            {selected.pptxEditability.reason && <p>{selected.pptxEditability.reason}</p>}
            {selected.pptxEditability.detailsOmitted ? <p>Individual object details are omitted above the 500-object inspection limit. The exporter uses a complete slide image.</p> : selected.pptxEditability.objects.length > 0 && <details><summary>Object editability ({selected.pptxEditability.objects.length})</summary><ul>{selected.pptxEditability.objects.map((object, index) => <li key={index}>{object.name}: {object.mode}</li>)}</ul></details>}
          </> : <p>Object editability could not be inspected. The report was kept unchanged; export still performs its own validation.</p>}
        </section>
      </> : <p>Add a page before exporting this report.</p>}
      <EmbeddedImageReview dashboard={dashboard} />
      <ExcelWorkbookReview dashboard={dashboard} />
    </section>
  </div>;
}
