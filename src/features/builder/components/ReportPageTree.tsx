import { useEffect, useId, useMemo, useRef, useState } from "react";
import type React from "react";
import { themePreviewBackground } from "../builderHelpers";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import { DocumentPreview } from "../../document/DocumentPreview";
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
    const target = pageButtons.current.get(pendingPageFocus.current) ?? searchInput.current;
    pendingPageFocus.current = null;
    target?.focus();
  });
  const normalizedSearch = pageSearch.trim().toLowerCase();
  const visiblePages = useMemo(
    () =>
      normalizedSearch
        ? sortedPages.filter((page) => {
            const pageText = `${page.title} ${page.order} ${page.tiles.map((tile) => `${tile.title} ${tile.name}`).join(" ")} ${page.elements.map((element) => element.name).join(" ")}`;
            return pageText.toLowerCase().includes(normalizedSearch);
          })
        : sortedPages,
    [normalizedSearch, sortedPages]
  );

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
        <input ref={searchInput} value={pageSearch} aria-describedby={`${outlineId}-status`} onChange={(event) => setPageSearch(event.target.value)} placeholder="Page title, number, or object" />
      </label>
      <p id={`${outlineId}-status`} role="status">{visiblePages.length} of {sortedPages.length} pages. Open a page before changing its objects.</p>
      <nav className="page-list report-page-tree" aria-label="Report pages and objects">
        {visiblePages.map((page) => {
          const pageIndex = sortedPages.findIndex((item) => item.id === page.id);
          const isFirstPage = pageIndex <= 0;
          const isLastPage = pageIndex === sortedPages.length - 1;
          const isRenaming = renamingPageId === page.id;
          const isExpanded = expandedPageIds.includes(page.id);
          const objectListId = `${outlineId}-objects-${pageIndex}`;
          const pageObjects = [...page.tiles, ...page.elements].sort((first, second) => first.layout.zIndex - second.layout.zIndex);

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
                    <div className="report-page-thumbnail" aria-hidden="true"><DocumentPreview page={page} /></div>
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
                    pageObjects.map((item, objectIndex) => {
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
                            <button type="button" className="report-page-object-select" aria-label={`Select analysis ${item.title || item.name}, ${context}. ${objectStatus(item)}.`} aria-pressed={page.id === activePage.id && selectedTileId === item.id} onClick={() => selectPageTile(page, item)}>
                              <span>{item.title || item.name}</span>
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
                </div>
              )}
            </div>
          );
        })}
        {visiblePages.length === 0 && <div className="empty-state compact">No pages match that search.</div>}
      </nav>
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
