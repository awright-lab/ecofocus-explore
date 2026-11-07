import { useId, useMemo, useRef, useState } from "react";
import type { DashboardDraft } from "../../../shared/types/dashboard";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { buildReportPreflight } from "./reportPreflight";

export function ExportPreflightDialog({ dashboard, onClose }: { dashboard: DashboardDraft; onClose: () => void }) {
  const dialog = useRef<HTMLElement | null>(null), titleId = useId(), helperId = useId();
  useModalAccessibility(dialog, onClose);
  const pages = useMemo(() => buildReportPreflight(dashboard), [dashboard]);
  const [selectedId, setSelectedId] = useState(pages[0]?.pageId ?? "");
  const selected = pages.find(page => page.pageId === selectedId) ?? pages[0];
  const attention = pages.filter(page => page.issues.length).length;
  return <div className="export-preflight-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={helperId} className="export-preflight-dialog" onMouseDown={event => event.stopPropagation()}>
      <header><div><h2 id={titleId}>Review before exporting</h2><p id={helperId}>Check analysis settings, page boundaries, overlapping analyses, images and PDF layout. Other format limits and final asset rendering are checked during export.</p></div><button type="button" onClick={onClose}>Close review</button></header>
      <p role="status">{pages.length} {pages.length === 1 ? "page" : "pages"} reviewed · {attention} {attention === 1 ? "page needs" : "pages need"} attention</p>
      {selected ? <><label className="export-preflight-page">Review page<select value={selected.pageId} onChange={event => setSelectedId(event.target.value)}>{pages.map((page, index) => <option key={page.pageId} value={page.pageId}>{index + 1}. {page.title}{page.issues.length ? ` · ${page.issues.length} ${page.issues.length === 1 ? "check" : "checks"} to review` : ""}</option>)}</select></label>
        <div className="export-preflight-grid"><div className="export-preflight-preview">{selected.pdfSvg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selected.pdfSvg)}`} alt={`PDF layout preview of ${selected.title}`} /> : <p>A PDF layout preview is unavailable until the listed layout issue is resolved.</p>}</div>
          <div><h3>{selected.issues.length ? "Checks to review" : "No issues found in these checks"}</h3>{selected.issues.length ? <ul>{selected.issues.map((issue, index) => <li key={`${issue.check}:${issue.objectId ?? "page"}:${index}`}><strong>{issue.check}</strong><p>{issue.message}</p></li>)}</ul> : <p>Review the preview, then check the generated file before sharing it.</p>}</div></div>
      </> : <p>Add a page before exporting this report.</p>}
    </section>
  </div>;
}
