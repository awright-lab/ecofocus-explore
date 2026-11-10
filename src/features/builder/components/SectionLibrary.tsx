import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardPage, SavedCompositionBlock } from "../../../../shared/types/dashboard";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import { compositionBlockCategoryLabel, compositionBlockCategoryOptions } from "./compositionBlockModel";
import { currentSectionDestination, inspectSection, resolveSection, resolveSectionInsertion, searchSections, sectionGeometry, sectionKey, sectionLibraryLimits, type SectionCriteria, type SectionEntry, type SectionReceipt } from "./sectionLibraryModel";
import { SectionPreview } from "./SectionPreview";
import "./section-library.css";

type Details = Pick<SavedCompositionBlock, "label" | "description" | "category">;
export interface SectionLibraryProps {
  curated: SavedCompositionBlock[]; saved: SavedCompositionBlock[]; pages: DashboardPage[]; activePage: DashboardPage;
  onInsertSaved: (block: SavedCompositionBlock) => boolean; onInsertCurated: (block: SavedCompositionBlock) => boolean;
  onUpdate: (block: SavedCompositionBlock, details: Details) => void; onDelete: (block: SavedCompositionBlock) => void;
}
export function SectionLibrary(props: SectionLibraryProps) {
  const [open, setOpen] = useState(false);
  return <section className="section-library-entry" data-style-category="layouts">
    <h3>Reusable sections</h3><p>{props.curated.length} curated starters · {props.saved.length} saved blocks</p>
    <p>See the layout, inspect stored content, then insert an editable copy.</p>
    <button type="button" className="secondary" onClick={() => setOpen(true)}>Browse sections <span aria-hidden="true">↗</span></button>
    {!props.saved.length && <small>Save selected objects as a block to add your own reusable sections.</small>}
    {open && <SectionGallery {...props} onClose={() => setOpen(false)}/>}
  </section>;
}
export function SectionGallery({ onClose, ...props }: SectionLibraryProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const current = useRef(props); useLayoutEffect(() => { current.current = props; });
  const [criteria, setCriteria] = useState<SectionCriteria>({ query: "", source: "all", category: "" });
  const [pagination, setPagination] = useState({ key: "", page: 0 });
  const key = JSON.stringify(criteria), result = searchSections(props.curated, props.saved, criteria, pagination.key === key ? pagination.page : 0);
  const [selection, setSelection] = useState<SectionReceipt | null>(null), [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Details>({ label: "", description: "", category: "custom" });
  const [issue, setIssue] = useState(""), [status, setStatus] = useState("");
  const nodes = useRef(new Map<string, HTMLButtonElement>()), pendingFocus = useRef<string | null>(null), origin = useRef<string | null>(null);
  const id = useId();
  const back = () => { setSelection(null); setEditing(false); pendingFocus.current = origin.current; setIssue(""); };
  const editTrigger = useRef<HTMLButtonElement>(null), wasEditing = useRef(false);
  useLayoutEffect(() => { if (wasEditing.current && !editing && selection) editTrigger.current?.focus(); wasEditing.current = editing; }, [editing, selection]);
  useModalAccessibility(dialog, () => { if (editing) { setEditing(false); setIssue(""); } else if (selection) back(); else onClose(); });
  useLayoutEffect(() => { if (pendingFocus.current) { (nodes.current.get(pendingFocus.current) ?? search.current)?.focus(); pendingFocus.current = null; } });
  const focusedCard = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => { if (!selection && focusedCard.current && !focusedCard.current.isConnected && document.activeElement === document.body) { search.current?.focus(); focusedCard.current = null; } });
  const inspectionHeading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (selection) inspectionHeading.current?.focus(); }, [selection]);
  function inspect(entry: SectionEntry, focusKey: string) {
    try {
      const now = current.current;
      const matches = (entry.source === "curated" ? now.curated : now.saved).filter(block => block.id === entry.id);
      if (matches.length !== 1 || matches[0] !== entry.block) { setIssue("This section changed or its identity is ambiguous. Search again."); return; }
      origin.current = focusKey; setSelection(inspectSection(entry, now.activePage)); setEditing(false); setIssue(""); setStatus("");
    } catch { setIssue("This section cannot be inspected safely. No content was changed."); }
  }
  function insert() {
    if (!selection) return;
    const now = current.current;
    try {
      const resolved = resolveSectionInsertion(selection, now.curated, now.saved, now.pages, now.activePage);
      if (!resolved.block) { setIssue(resolved.issue); return; }
      const inserted = (selection.source === "saved" ? now.onInsertSaved : now.onInsertCurated)(resolved.block);
      if (!inserted) { setIssue("The existing insertion command could not insert this section. Nothing was added; review the destination."); return; }
      onClose();
    } catch { setIssue("The section could not be validated for insertion. Review it again before retrying."); }
  }
  function manage(action: "save" | "delete") {
    if (!selection || selection.source !== "saved") return;
    const now = current.current;
    try {
      if (!currentSectionDestination(selection, now.pages, now.activePage)) { setIssue("The destination or report changed. Return to the gallery and review this section again."); return; }
      const resolved = resolveSection(selection, now.curated, now.saved);
      if (!resolved.block) { setIssue(resolved.issue); return; }
      if (action === "save") { if (!draft.label.trim()) { setIssue("Enter a section name before saving details."); return; } now.onUpdate(resolved.block, { ...draft, label: draft.label.trim() }); setStatus("Section details updated."); }
      else { now.onDelete(resolved.block); setStatus("Saved section deleted."); }
      back();
    } catch { setIssue("The saved section could not be validated. Return to the gallery and review it again."); }
  }
  const count = Math.max(1, Math.ceil(result.total / sectionLibraryLimits.pageSize));
  const block = selection?.snapshot, geometry = block ? sectionGeometry(block) : null;
  return createPortal(<div className="section-library-backdrop" onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
    <div ref={dialog} className="section-gallery" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} data-canvas-keyboard-scope="controls" onKeyDown={event => event.stopPropagation()}>
      <header><div><span className="section-eyebrow">DESIGN LIBRARY</span><h2 id={`${id}-title`}>Browse sections</h2><p>Reusable layouts with stored content. Choose a section to inspect before inserting.</p></div><button type="button" onClick={onClose} aria-label="Close section library">Close ✕</button></header>
      <div className="section-gallery-scroll">
        {issue && <p className="section-issue" role="alert">{issue}</p>}{status && <p role="status">{status}</p>}
        {!selection ? <>
          <div className="section-gallery-filters">
            <label>Search sections<input ref={search} type="search" maxLength={200} value={criteria.query} placeholder="Name, description, or category…" onChange={event => { setCriteria({ ...criteria, query: event.target.value }); setIssue(""); }}/></label>
            <label>Source<select aria-label="Section source" value={criteria.source} onChange={event => setCriteria({ ...criteria, source: event.target.value as SectionCriteria["source"] })}><option value="all">All sections</option><option value="curated">Curated starters</option><option value="saved">Saved blocks</option></select></label>
            <label>Category<select aria-label="Section category" value={criteria.category} onChange={event => setCriteria({ ...criteria, category: event.target.value })}><option value="">All categories</option>{compositionBlockCategoryOptions.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
          </div>
          <p role="status" className="section-count">{result.total ? `${result.page * 12 + 1}–${Math.min((result.page + 1) * 12, result.total)} of ${result.total} sections` : "0 sections"}. Search covers names, descriptions and category names.</p>
          {result.issue && <p role="alert">{result.issue}</p>}
          {!result.total && <div className="section-empty"><h3>No sections found</h3><p>Try another search or category. Save selected report objects as a block to build your library.</p></div>}
          <div className="section-gallery-grid">{result.entries.map((entry, index) => {
            const ordinal = result.page * 12 + index, focusKey = JSON.stringify([sectionKey(entry), ordinal]);
            const preview = sectionGeometry(entry.block), noteId = `${id}-preview-${index}`;
            const note = preview.issue ? `Preview unsupported: ${preview.issue}` : `${preview.counts.analyses ? "Cached analysis · not the selected study. " : "Partial stored-layout preview. "}${preview.partial}`;
            return <button type="button" className="section-card" key={focusKey} ref={node => { if (node) nodes.current.set(focusKey, node); else nodes.current.delete(focusKey); }} onFocus={event => { focusedCard.current = event.currentTarget; }} onBlur={() => { focusedCard.current = null; }} aria-label={`Inspect ${entry.block.label}, ${entry.source === "curated" ? "curated starter" : "saved block"}, section ${ordinal + 1} of ${result.total}`} aria-describedby={noteId} onClick={() => inspect(entry, focusKey)}>
              <div aria-hidden="true"><SectionPreview block={entry.block}/></div><div className="section-card-caption"><span className={`section-source ${entry.source}`}>{entry.source === "curated" ? "Curated starter" : "Saved block"}</span><strong>{entry.block.label}</strong><small>{compositionBlockCategoryLabel(entry.block.category)} · {entry.block.items.length} objects</small><p>{entry.block.description}</p><small id={noteId} className="section-card-preview-note">{note}</small><span className="section-inspect-link">Inspect section <span aria-hidden="true">↗</span></span></div>
            </button>;
          })}</div>
          <nav className="section-pagination" aria-label="Section pagination">{[["First", 0, result.page === 0], ["Previous", result.page - 1, result.page === 0], ["Next", result.page + 1, result.page >= count - 1], ["Last", count - 1, result.page >= count - 1]].map(([label, next, disabled], index) => <span key={String(label)}>{index === 2 && <span className="section-page-count">Page {result.page + 1} of {count}</span>}<button type="button" aria-label={`Sections: ${label}`} aria-disabled={Boolean(disabled)} onClick={() => { if (!disabled) setPagination({ key, page: Number(next) }); }}>{label}</button></span>)}</nav>
        </> : block && geometry && <section className="section-inspection" aria-label="Section inspection">
          <button type="button" onClick={back}>← Back to gallery</button>
          <div className="section-inspection-grid"><div><SectionPreview block={block}/><p className="section-preview-note">Partial visual preview: text and analytical marks may be shortened; gradients, borders and effects may be simplified. Relative positions, sizes and layer order are preserved when supported.</p>{geometry.counts.analyses > 0 && <p className="section-cache-note">Cached analytical preview — stored results only. This section does not use the selected study, and no query is executed.</p>}{geometry.partial && <p className="section-preview-note">{geometry.partial}</p>}</div>
          <div className="section-inspection-details"><span className={`section-source ${selection.source}`}>{selection.source === "curated" ? "Curated starter" : "Saved block"}</span><h3 ref={inspectionHeading} tabIndex={-1}>{block.label}</h3><p>{block.description || "No description provided."}</p><dl><dt>Category</dt><dd>{compositionBlockCategoryLabel(block.category)}</dd><dt>Stored dimensions</dt><dd>{block.summary.width} × {block.summary.height} report units</dd><dt>Objects</dt><dd>{block.items.length} total · {geometry.counts.analyses} analyses · {geometry.counts.text} text · {geometry.counts.shapes} shapes · {geometry.counts.images} images</dd><dt>Stored status</dt><dd>{geometry.counts.hidden} hidden · {geometry.counts.locked} locked</dd><dt>Destination reviewed</dt><dd>Page {selection.destination.order}: {selection.destination.title}</dd></dl>
          <p>Insert creates an editable copy. Existing insertion behavior makes copied objects visible and unlocked. Hidden objects are omitted from this stored-content preview.</p>
          {geometry.issue && <p role="status">Preview unsupported: {geometry.issue}</p>}{!block.items.length && <p role="status">This section is empty; there is nothing to insert.</p>}
          {editing ? <form onSubmit={event => { event.preventDefault(); manage("save"); }}><label>Block name<input autoFocus value={draft.label} onChange={event => setDraft({ ...draft, label: event.target.value })}/></label><label>Editorial role<select aria-label="Editorial role" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as Details["category"] })}>{compositionBlockCategoryOptions.map(category => <option value={category.id} key={category.id}>{category.label}</option>)}</select></label><label>Description<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/></label><div className="section-detail-actions"><button type="submit">Save details</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div></form> : <div className="section-detail-actions"><button type="button" className="section-insert" disabled={Boolean(geometry.issue) || !block.items.length} onClick={insert}>Insert section</button>{selection.source === "saved" && <><button ref={editTrigger} type="button" onClick={() => { setDraft({ label: block.label, description: block.description, category: block.category }); setEditing(true); }}>Edit</button><button type="button" onClick={() => manage("delete")}>Delete</button></>}</div>}
          </div></div>
        </section>}
      </div>
      <footer>Browsing does not insert content. {selection ? "Escape returns to the gallery." : "Escape closes the library."}</footer>
    </div>
  </div>, document.fullscreenElement ?? document.body);
}
