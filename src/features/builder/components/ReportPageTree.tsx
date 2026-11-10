import { ReportNavigator, NavigatorPagination, NavigatorPreview } from "./ReportNavigator";
import { searchReportObjects, reportObjectMatchKey, resolveReportObjectMatch, type ReportObjectMatch } from "./reportObjectSearch";
import "./report-object-search.css";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { themePreviewBackground } from "../builderHelpers";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, PageTemplatePreset, PageThemePreset } from "../../../../shared/types/dashboard";
import type { MultiSelectedObject, ReportTreeSelectionCue } from "../builderTypes";

type ReportPageTreeProps = {
  sortedPages: DashboardPage[];
  activePage: DashboardPage;
  selectedTileId: string | null;
  selectedElementId: string | null;
  multiSelectedObjects: MultiSelectedObject[];
  toggleMultiSelectedObject: (item: MultiSelectedObject) => void;
  clearMultiSelection: () => void;
  pageTemplates: PageTemplatePreset[];
  pageThemes: PageThemePreset[];
  setActivePageId: (pageId: string) => void;
  selectPage: () => void;
  selectTile: (tileId: string) => void;
  selectElement: (elementId: string) => void;
  recordReportTreeSelectionCue: (cue: Omit<NonNullable<ReportTreeSelectionCue>, "createdAt">) => void;
  updateTile: (tileId: string, updates: Partial<DashboardTile>) => void;
  updateElement: (elementId: string, updates: Partial<DashboardCanvasElement>) => void;
  renamePage: (pageId: string, title: string) => void;
  addPage: (template?: PageTemplatePreset) => void;
  duplicateActivePage: () => void;
  duplicatePageById: (pageId: string) => void;
  deleteActivePage: () => void;
  deletePageById: (pageId: string) => void;
  movePage: (pageId: string, direction: "up" | "down") => void;
};

function pageObjectCount(page: DashboardPage) {
  return page.tiles.length + page.elements.length;
}

function pageTemplateTheme(template: PageTemplatePreset, pageThemes: PageThemePreset[]) {
  return pageThemes.find((theme) => theme.id === template.pageThemeId);
}

function elementTypeLabel(element: DashboardCanvasElement) {
  if (element.type === "rectangle" || element.type === "circle") return "Shape";
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
}

function objectStatus(item: DashboardTile | DashboardCanvasElement) {
  const states = [item.hidden ? "Hidden" : null, item.locked ? "Locked" : null].filter(Boolean);
  return states.length ? states.join(" · ") : "Visible";
}

function pageProvenanceLabel(page: DashboardPage) {
  if (page.provenance?.status === "template-derived" && page.provenance.templateLabel) {
    return `From template: ${page.provenance.templateLabel}`;
  }
  if (page.provenance?.themeLabel) {
    return `From theme: ${page.provenance.themeLabel}`;
  }
  return "Custom page";
}

function pageMasterLabel(page: DashboardPage) {
  if (page.provenance?.masterStatus === "master-based" && page.provenance.masterLabel) {
    return `From master: ${page.provenance.masterLabel}`;
  }
  return "No master";
}

export function ReportPageTree({
  sortedPages,
  activePage,
  selectedTileId,
  selectedElementId,
  multiSelectedObjects,
  toggleMultiSelectedObject,
  clearMultiSelection,
  pageTemplates,
  pageThemes,
  setActivePageId,
  selectPage,
  selectTile,
  selectElement,
  recordReportTreeSelectionCue,
  updateTile,
  updateElement,
  renamePage,
  addPage,
  duplicateActivePage,
  duplicatePageById,
  deleteActivePage,
  deletePageById,
  movePage
}: ReportPageTreeProps) {
  const [navigatorQuery, setNavigatorQuery] = useState<string | null>(null);
  const [pageBatch, setPageBatch] = useState(0);
  const [objectBatches, setObjectBatches] = useState<Record<string, number>>({});
  const pageBatchSize = 12, objectBatchSize = 25;
  const [pageSearch, setPageSearch] = useState("");
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [expandedPageIds, setExpandedPageIds] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const pageButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingPageFocus = useRef<string | null>(null);
  const outlineId = useId();
  useEffect(() => {
    if (!pendingPageFocus.current) return;
    const position = searchReportObjects(sortedPages, pageSearch).pages.findIndex(page => page.id === pendingPageFocus.current);
    if (position >= 0 && Math.floor(position / pageBatchSize) !== pageBatch) { setPageBatch(Math.floor(position / pageBatchSize)); return; }
    const target = pageButtons.current.get(pendingPageFocus.current) ?? searchInput.current;
    pendingPageFocus.current = null;
    target?.focus();
  });
  const normalizedSearch = pageSearch.trim().toLowerCase();
  const search = searchReportObjects(sortedPages, pageSearch);
  const visiblePages = search.pages;
  const currentBatch = Math.min(pageBatch, Math.max(0, Math.ceil(visiblePages.length / pageBatchSize) - 1));
  const [searchIssue, setSearchIssue] = useState("");
  const searchResultNodes = useRef(new Map<string, HTMLButtonElement>());
  const displacedSearchResult = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const displaced = displacedSearchResult.current; displacedSearchResult.current = null;
    if (displaced && !displaced.isConnected && (!document.activeElement || document.activeElement === document.body) && searchInput.current?.isConnected && !searchInput.current.closest("[hidden], [inert]")) searchInput.current.focus();
  });
  function searchResultRef(key: string, node: HTMLButtonElement | null) {
    const previous = searchResultNodes.current.get(key);
    if (!node && previous === document.activeElement) displacedSearchResult.current = previous;
    if (node) searchResultNodes.current.set(key, node); else searchResultNodes.current.delete(key);
  }
  function chooseSearchMatch(match: ReportObjectMatch) {
    const current = resolveReportObjectMatch(sortedPages, pageSearch, match);
    if (!current) { setSearchIssue("That match changed or was removed. Search again; no report content was changed."); return; }
    setSearchIssue("");
    if (current.kind === "tile") selectPageTile(current.page, current.object); else selectPageElement(current.page, current.object);
  }

  function startRename(page: DashboardPage) {
    setActivePageId(page.id);
    selectPage();
    setRenamingPageId(page.id);
    setRenameDraft(page.title);
  }

  function saveRename(page: DashboardPage) {
    pendingPageFocus.current = page.id;
    renamePage(page.id, renameDraft || page.title);
    setRenamingPageId(null);
    setRenameDraft("");
  }

  function cancelRename() {
    pendingPageFocus.current = renamingPageId;
    setRenamingPageId(null);
    setRenameDraft("");
  }

  function deleteOutlinePage(page: DashboardPage, currentPageAction = false) {
    if (sortedPages.length <= 1) return;
    const index = sortedPages.findIndex(item => item.id === page.id);
    if (index < 0) return;
    const remaining = sortedPages.filter(item => item.id !== page.id);
    if (!remaining.length) return;
    pendingPageFocus.current = currentPageAction ? remaining[0].id : remaining[Math.min(index, remaining.length - 1)].id;
    if (currentPageAction) deleteActivePage(); else deletePageById(page.id);
  }

  function moveOutlinePage(page: DashboardPage, direction: "up" | "down") {
    const index = sortedPages.findIndex(item => item.id === page.id);
    const next = index + (direction === "up" ? -1 : 1);
    if (index < 0 || next < 0 || next >= sortedPages.length) return;
    pendingPageFocus.current = page.id;
    movePage(page.id, direction);
  }

  function handleRenameKeyDown(event: React.KeyboardEvent<HTMLInputElement>, page: DashboardPage) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      saveRename(page);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelRename();
    }
  }

  function toggleExpandedPage(pageId: string) {
    setExpandedPageIds((current) => (current.includes(pageId) ? current.filter((id) => id !== pageId) : [...current, pageId]));
  }

  function isMultiSelected(item: MultiSelectedObject) {
    return multiSelectedObjects.some((selected) => selected.id === item.id && selected.type === item.type);
  }

  function toggleTreeMultiSelect(event: React.ChangeEvent<HTMLInputElement>, page: DashboardPage, item: MultiSelectedObject) {
    event.stopPropagation();
    if (page.id !== activePage.id) return;
    toggleMultiSelectedObject(item);
  }

  function selectPageTile(page: DashboardPage, tile: DashboardTile) {
    setPageBatch(Math.max(0, Math.floor(visiblePages.findIndex(item => item.id === page.id) / pageBatchSize)));
    setActivePageId(page.id);
    recordReportTreeSelectionCue({
      objectId: tile.id,
      objectKind: "tile",
      objectLabel: tile.title || tile.name,
      objectType: getChartTypeLabel(tile.visualization),
      pageId: page.id,
      pageTitle: page.title
    });
    selectTile(tile.id);
  }

  function selectPageElement(page: DashboardPage, element: DashboardCanvasElement) {
    setPageBatch(Math.max(0, Math.floor(visiblePages.findIndex(item => item.id === page.id) / pageBatchSize)));
    setActivePageId(page.id);
    recordReportTreeSelectionCue({
      objectId: element.id,
      objectKind: "element",
      objectLabel: element.name,
      objectType: elementTypeLabel(element),
      pageId: page.id,
      pageTitle: page.title
    });
    selectElement(element.id);
  }

  function toggleTileHidden(event: React.MouseEvent<HTMLButtonElement>, tile: DashboardTile) {
    event.stopPropagation();
    updateTile(tile.id, { hidden: !tile.hidden });
  }

  function toggleTileLocked(event: React.MouseEvent<HTMLButtonElement>, tile: DashboardTile) {
    event.stopPropagation();
    updateTile(tile.id, { locked: !tile.locked });
  }

  function toggleElementHidden(event: React.MouseEvent<HTMLButtonElement>, element: DashboardCanvasElement) {
    event.stopPropagation();
    updateElement(element.id, { hidden: !element.hidden });
  }

  function toggleElementLocked(event: React.MouseEvent<HTMLButtonElement>, element: DashboardCanvasElement) {
    event.stopPropagation();
    updateElement(element.id, { locked: !element.locked });
  }

  return (
    <>
      <div className="panel-title">
        <h2>Pages</h2>
      </div>
      <button type="button" className="report-browse-button" onClick={() => setNavigatorQuery("")}>Browse report <span aria-hidden="true">↗</span></button>
      {navigatorQuery !== null && <ReportNavigator pages={sortedPages} activePageId={activePage.id} initialQuery={navigatorQuery} onClose={() => setNavigatorQuery(null)} onPage={page => { setPageBatch(Math.max(0, Math.floor(visiblePages.findIndex(item => item.id === page.id) / pageBatchSize))); setActivePageId(page.id); selectPage(); }} onObject={match => { setPageBatch(Math.max(0, Math.floor(visiblePages.findIndex(item => item.id === match.page.id) / pageBatchSize))); if (match.kind === "tile") selectPageTile(match.page, match.object); else selectPageElement(match.page, match.object); }} />}
      <div className="report-tree-summary">
        <div>
          <span>Report tree</span>
          <strong>{sortedPages.length} pages</strong>
        </div>
        <small>{sortedPages.reduce((total, page) => total + pageObjectCount(page), 0)} objects</small>
        {multiSelectedObjects.length > 0 && (
          <button type="button" className="mini-button" onClick={clearMultiSelection}>
            Clear {multiSelectedObjects.length}
          </button>
        )}
      </div>
      <label>
        Search pages
        <input type="search" maxLength={200} ref={searchInput} value={pageSearch} aria-describedby={`${outlineId}-status`} onChange={(event) => { setPageSearch(event.target.value); setPageBatch(0); setSearchIssue(""); }} onKeyDown={event => { if (event.key === "Escape" && pageSearch && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); setPageSearch(""); setSearchIssue(""); } }} placeholder="Page, chart name, or written text" />
      </label>
      <p id={`${outlineId}-status`} role="status">{visiblePages.length} of {sortedPages.length} pages. {normalizedSearch && `${search.total} matching objects. `}Open a page before changing its objects.</p>
      {search.issue && <p className="report-object-search-note" role="status">{search.issue}</p>}
      {searchIssue && <p role="alert">{searchIssue}</p>}
      {normalizedSearch && search.matches.length > 0 && <section className="report-object-search-results" aria-label="Matching report objects" data-canvas-keyboard-scope="controls">
        <h3>Jump to a matching object</h3>
        <p className="report-object-search-note">{search.textIncluded ? "Search finds page titles, object names, source field labels, and authored text." : "These matches include names and source field labels only."} {search.total > search.matches.length && `Showing the first ${search.matches.length} of ${search.total} objects. Browse all matches to see every result. `}The page tree below remains available.</p>
        <button type="button" onClick={() => setNavigatorQuery(pageSearch)}>Browse all {search.total} matching objects</button>
        <ul>{search.matches.map((match, matchIndex) => {
          const key = reportObjectMatchKey(match), label = match.kind === "tile" ? match.object.title || match.object.name : match.object.name;
          const type = match.kind === "tile" ? getChartTypeLabel(match.object.visualization) : elementTypeLabel(match.object);
          const excerptId = `${outlineId}-search-excerpt-${matchIndex}`;
          const internalName = match.kind === "tile" && match.object.name !== label ? match.object.name : "", nameId = `${outlineId}-search-name-${matchIndex}`;
          const selected = match.page.id === activePage.id && (match.kind === "tile" ? selectedTileId === match.object.id : selectedElementId === match.object.id);
          return <li key={key}><button type="button" className="report-object-match" ref={node => searchResultRef(key, node)} aria-pressed={selected} aria-label={`Find ${type} ${label}, matching object ${matchIndex + 1} of ${search.total}, page ${match.page.order}: ${match.page.title}. ${objectStatus(match.object)}.`} aria-describedby={[match.excerpt ? excerptId : "", internalName ? nameId : ""].filter(Boolean).join(" ") || undefined} onClick={() => chooseSearchMatch(match)}><strong>{label}</strong><small>Page {match.page.order}: {match.page.title} · {type} · {objectStatus(match.object)}</small>{internalName && <small id={nameId} className="report-object-internal-name">Analysis name: {internalName}</small>}{match.excerpt && <small id={excerptId}>{match.excerpt}</small>}</button></li>;
        })}</ul>
      </section>}
      <nav className="page-list report-page-tree" aria-label="Report pages and objects">
        {visiblePages.slice(currentBatch * pageBatchSize, (currentBatch + 1) * pageBatchSize).map((page) => {
          const pageIndex = sortedPages.findIndex((item) => item.id === page.id);
          const isFirstPage = pageIndex <= 0;
          const isLastPage = pageIndex === sortedPages.length - 1;
          const isRenaming = renamingPageId === page.id;
          const isExpanded = expandedPageIds.includes(page.id);
          const objectListId = `${outlineId}-objects-${pageIndex}`;
          const pageObjects = isExpanded ? [...page.tiles, ...page.elements].sort((first, second) => first.layout.zIndex - second.layout.zIndex) : [];
          const objectBatch = Math.min(objectBatches[page.id] ?? 0, Math.max(0, Math.ceil(pageObjects.length / objectBatchSize) - 1));

          return (
            <div className={page.id === activePage.id ? "report-page-group active" : "report-page-group"} key={page.id}>
              <div className="report-page-node-row">
                {isRenaming ? (
                  <div className="page-tab report-page-node report-page-rename active">
                    <span>{page.order}</span>
                    <div className="report-page-node__body">
                      <input
                        aria-label={`Rename page ${page.order}: ${page.title}`}
                        aria-describedby={`${objectListId}-rename-help`}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => handleRenameKeyDown(event, page)}
                        autoFocus
                      />
                      <small id={`${objectListId}-rename-help`}>Press Enter to save, Escape to cancel</small>
                    </div>
                  </div>
                ) : (
                  <button
                    ref={node => { if (node) pageButtons.current.set(page.id, node); else pageButtons.current.delete(page.id); }}
                    type="button"
                    aria-current={page.id === activePage.id ? "page" : undefined}
                    aria-label={`Open page ${page.order}: ${page.title}`}
                    className={page.id === activePage.id ? "page-tab report-page-node active" : "page-tab report-page-node"}
                    onClick={() => {
                      setActivePageId(page.id);
                      selectPage();
                    }}
                  >
                    <span>{page.order}</span>
                    <div className="report-page-node__body">
                      <strong>{page.title}</strong>
                      <small>
                        {page.tiles.length} analyses · {page.elements.length} objects
                      </small>
                      <small className="report-page-provenance">{pageProvenanceLabel(page)}</small>
                      <small className="report-page-master">{pageMasterLabel(page)}</small>
                    </div>
                    <div className="report-page-thumbnail" aria-hidden="true"><NavigatorPreview page={page} /></div>
                  </button>
                )}
                <div className="report-page-node-actions" aria-label={`Page actions for ${page.title}`}>
                  {isRenaming ? (
                    <>
                      <button type="button" className="mini-button" aria-label={`Save name for page ${page.order}: ${page.title}`} onClick={() => saveRename(page)}>
                        Save
                      </button>
                      <button type="button" className="mini-button" aria-label={`Cancel renaming page ${page.order}: ${page.title}`} onClick={cancelRename}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="mini-button" aria-expanded={isExpanded} aria-controls={isExpanded ? objectListId : undefined} aria-label={`${isExpanded ? "Hide" : "Show"} objects on page ${page.order}: ${page.title}`} onClick={() => toggleExpandedPage(page.id)}>
                        {isExpanded ? "Hide" : "Objects"}
                      </button>
                      <details className="page-action-menu">
                        <summary aria-label={`More actions for page ${page.order}: ${page.title}`}>•••</summary>
                        <div>
                          <button type="button" onClick={() => startRename(page)}>
                            Rename
                          </button>
                          <button type="button" onClick={() => duplicatePageById(page.id)}>
                            Duplicate
                          </button>
                          <button type="button" disabled={isFirstPage} onClick={() => moveOutlinePage(page, "up")}>
                            Move up
                          </button>
                          <button type="button" disabled={isLastPage} onClick={() => moveOutlinePage(page, "down")}>
                            Move down
                          </button>
                          <button type="button" className="danger" disabled={sortedPages.length <= 1} onClick={() => deleteOutlinePage(page)}>
                            Delete
                          </button>
                        </div>
                      </details>
                    </>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div id={objectListId} className="report-page-object-list" role="group" aria-label={`Objects on page ${page.order}: ${page.title}`}>
                  {pageObjects.length === 0 ? (
                    <small className="report-page-object-empty">No objects on this page yet.</small>
                  ) : (
                    pageObjects.slice(objectBatch * objectBatchSize, (objectBatch + 1) * objectBatchSize).map((item, localIndex) => {
                      const objectIndex = objectBatch * objectBatchSize + localIndex;
                      const context = `object ${objectIndex + 1} on page ${page.order}: ${page.title}`;
                      if ("visualization" in item) {
                        const multiSelected = isMultiSelected({ id: item.id, type: "tile" });
                        const canMultiSelect = page.id === activePage.id;
                        return (
                          <div className={page.id === activePage.id && selectedTileId === item.id ? "report-page-object-row active" : multiSelected && canMultiSelect ? "report-page-object-row multi-selected" : "report-page-object-row"} key={item.id}>
                            <label className="report-page-object-check" title={canMultiSelect ? "Add to multi-selection" : "Switch to this page before multi-selecting"}>
                              <input
                                type="checkbox"
                                aria-label={`Include analysis ${item.title || item.name}, ${context}, in selection`}
                                checked={canMultiSelect && multiSelected}
                                disabled={!canMultiSelect}
                                onChange={(event) => toggleTreeMultiSelect(event, page, { id: item.id, type: "tile" })}
                              />
                            </label>
                            <button type="button" className="report-page-object-select" aria-label={`Select analysis ${item.title || item.name}, ${context}. ${objectStatus(item)}.`} aria-describedby={item.name && item.name !== (item.title || item.name) ? `${outlineId}-object-name-${pageIndex}-${objectIndex}` : undefined} aria-pressed={page.id === activePage.id && selectedTileId === item.id} onClick={() => selectPageTile(page, item)}>
                              <span>{item.title || item.name}</span>
                              {item.name && item.name !== (item.title || item.name) && <small className="report-object-internal-name" id={`${outlineId}-object-name-${pageIndex}-${objectIndex}`}>Analysis name: {item.name}</small>}
                              <small>{getChartTypeLabel(item.visualization)} · {objectStatus(item)}</small>
                            </button>
                            <div className="report-page-object-actions" role="group" aria-label={`Actions for analysis ${item.title || item.name}, ${context}`}>
                              <button type="button" className="mini-button" disabled={!canMultiSelect} aria-label={`${item.hidden ? "Show" : "Hide"} analysis ${item.title || item.name}, ${context}`} onClick={(event) => toggleTileHidden(event, item)}>
                                {item.hidden ? "Show" : "Hide"}
                              </button>
                              <button type="button" className="mini-button" disabled={!canMultiSelect} aria-label={`${item.locked ? "Unlock" : "Lock"} analysis ${item.title || item.name}, ${context}`} onClick={(event) => toggleTileLocked(event, item)}>
                                {item.locked ? "Unlock" : "Lock"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const multiSelected = isMultiSelected({ id: item.id, type: "element" });
                      const canMultiSelect = page.id === activePage.id;
                      return (
                        <div className={page.id === activePage.id && selectedElementId === item.id ? "report-page-object-row active" : multiSelected && canMultiSelect ? "report-page-object-row multi-selected" : "report-page-object-row"} key={item.id}>
                          <label className="report-page-object-check" title={canMultiSelect ? "Add to multi-selection" : "Switch to this page before multi-selecting"}>
                            <input
                              type="checkbox"
                              aria-label={`Include ${elementTypeLabel(item)} ${item.name}, ${context}, in selection`}
                              checked={canMultiSelect && multiSelected}
                              disabled={!canMultiSelect}
                              onChange={(event) => toggleTreeMultiSelect(event, page, { id: item.id, type: "element" })}
                            />
                          </label>
                          <button type="button" className="report-page-object-select" aria-label={`Select ${elementTypeLabel(item)} ${item.name}, ${context}. ${objectStatus(item)}.`} aria-pressed={page.id === activePage.id && selectedElementId === item.id} onClick={() => selectPageElement(page, item)}>
                            <span>{item.name}</span>
                            <small>{elementTypeLabel(item)} · {objectStatus(item)}</small>
                          </button>
                          <div className="report-page-object-actions" role="group" aria-label={`Actions for ${elementTypeLabel(item)} ${item.name}, ${context}`}>
                            <button type="button" className="mini-button" disabled={!canMultiSelect} aria-label={`${item.hidden ? "Show" : "Hide"} ${elementTypeLabel(item)} ${item.name}, ${context}`} onClick={(event) => toggleElementHidden(event, item)}>
                              {item.hidden ? "Show" : "Hide"}
                            </button>
                            <button type="button" className="mini-button" disabled={!canMultiSelect} aria-label={`${item.locked ? "Unlock" : "Lock"} ${elementTypeLabel(item)} ${item.name}, ${context}`} onClick={(event) => toggleElementLocked(event, item)}>
                              {item.locked ? "Unlock" : "Lock"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {pageObjects.length > objectBatchSize && <NavigatorPagination page={objectBatch} total={pageObjects.length} size={objectBatchSize} label={`Objects on page ${page.order} pagination`} onChange={next => setObjectBatches(current => ({ ...current, [page.id]: next }))} />}
                </div>
              )}
            </div>
          );
        })}
        {visiblePages.length === 0 && <div className="empty-state compact">No pages match {search.textIncluded ? "that search" : "the names-only search"}.</div>}
      </nav>
      {visiblePages.length > pageBatchSize && <NavigatorPagination page={currentBatch} total={visiblePages.length} size={pageBatchSize} onChange={setPageBatch} label="Pages outline pagination" />}
      <div className="brand-card-actions">
        <button type="button" className="secondary" onClick={() => addPage()}>
          New page
        </button>
        <button type="button" className="secondary" onClick={duplicateActivePage}>
          Duplicate page
        </button>
      </div>
      <button type="button" className="secondary" onClick={() => deleteOutlinePage(activePage, true)} disabled={sortedPages.length <= 1}>
        Delete current page
      </button>
      <div className="explorer-section-card">
        <div className="explorer-section-header">
          <strong>Page templates</strong>
          <small>{pageTemplates.length} ready to use</small>
        </div>
        <div className="brand-theme-list">
          {pageTemplates.map((template) => (
            <button type="button" key={template.id} className="brand-theme-card" onClick={() => addPage(template)}>
              <span
                className="brand-theme-preview"
                style={{ background: themePreviewBackground(pageTemplateTheme(template, pageThemes)) }}
              />
              <div>
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
