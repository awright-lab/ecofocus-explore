import { useMemo, useState } from "react";
import type React from "react";
import { themePreviewBackground } from "../builderHelpers";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, PageTemplatePreset, PageThemePreset } from "../../../../shared/types/dashboard";
import type { ReportTreeSelectionCue } from "../builderTypes";

type ReportPageTreeProps = {
  sortedPages: DashboardPage[];
  activePage: DashboardPage;
  selectedTileId: string | null;
  selectedElementId: string | null;
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
  const normalizedSearch = pageSearch.trim().toLowerCase();
  const visiblePages = useMemo(
    () =>
      normalizedSearch
        ? sortedPages.filter((page) => {
            const pageText = `${page.title} ${page.order} ${page.tiles.map((tile) => tile.title).join(" ")} ${page.elements.map((element) => element.name).join(" ")}`;
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
    renamePage(page.id, renameDraft || page.title);
    setRenamingPageId(null);
    setRenameDraft("");
  }

  function cancelRename() {
    setRenamingPageId(null);
    setRenameDraft("");
  }

  function handleRenameKeyDown(event: React.KeyboardEvent<HTMLInputElement>, page: DashboardPage) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveRename(page);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }

  function toggleExpandedPage(pageId: string) {
    setExpandedPageIds((current) => (current.includes(pageId) ? current.filter((id) => id !== pageId) : [...current, pageId]));
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
      </div>
      <label>
        Search pages
        <input value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} placeholder="Page title, number, or object" />
      </label>
      <div className="page-list report-page-tree">
        {visiblePages.map((page) => {
          const pageIndex = sortedPages.findIndex((item) => item.id === page.id);
          const isFirstPage = pageIndex <= 0;
          const isLastPage = pageIndex === sortedPages.length - 1;
          const isRenaming = renamingPageId === page.id;
          const isExpanded = expandedPageIds.includes(page.id);
          const pageObjects = [...page.tiles, ...page.elements].sort((first, second) => first.layout.zIndex - second.layout.zIndex);

          return (
            <div className={page.id === activePage.id ? "report-page-group active" : "report-page-group"} key={page.id}>
              <div className="report-page-node-row">
                {isRenaming ? (
                  <div className="page-tab report-page-node report-page-rename active">
                    <span>{page.order}</span>
                    <div className="report-page-node__body">
                      <input
                        aria-label={`Rename ${page.title}`}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => handleRenameKeyDown(event, page)}
                        autoFocus
                      />
                      <small>Press Enter to save, Escape to cancel</small>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
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
                  </button>
                )}
                <div className="report-page-node-actions" aria-label={`Page actions for ${page.title}`}>
                  {isRenaming ? (
                    <>
                      <button type="button" className="mini-button" onClick={() => saveRename(page)}>
                        Save
                      </button>
                      <button type="button" className="mini-button" onClick={cancelRename}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="mini-button" onClick={() => toggleExpandedPage(page.id)}>
                        {isExpanded ? "Hide" : "Objects"}
                      </button>
                      <button type="button" className="mini-button" onClick={() => startRename(page)}>
                        Rename
                      </button>
                      <button type="button" className="mini-button" onClick={() => duplicatePageById(page.id)}>
                        Copy
                      </button>
                      <button type="button" className="mini-button" disabled={sortedPages.length <= 1} onClick={() => deletePageById(page.id)}>
                        Delete
                      </button>
                    </>
                  )}
                  <button type="button" className="mini-button" disabled={isFirstPage} onClick={() => movePage(page.id, "up")}>
                    Up
                  </button>
                  <button type="button" className="mini-button" disabled={isLastPage} onClick={() => movePage(page.id, "down")}>
                    Down
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="report-page-object-list">
                  {pageObjects.length === 0 ? (
                    <small className="report-page-object-empty">No objects on this page yet.</small>
                  ) : (
                    pageObjects.map((item) => {
                      if ("visualization" in item) {
                        return (
                          <div className={selectedTileId === item.id ? "report-page-object-row active" : "report-page-object-row"} key={item.id}>
                            <button type="button" className="report-page-object-select" onClick={() => selectPageTile(page, item)}>
                              <span>{item.title || item.name}</span>
                              <small>{getChartTypeLabel(item.visualization)} · {objectStatus(item)}</small>
                            </button>
                            <div className="report-page-object-actions" aria-label={`Object actions for ${item.title || item.name}`}>
                              <button type="button" className="mini-button" onClick={(event) => toggleTileHidden(event, item)}>
                                {item.hidden ? "Show" : "Hide"}
                              </button>
                              <button type="button" className="mini-button" onClick={(event) => toggleTileLocked(event, item)}>
                                {item.locked ? "Unlock" : "Lock"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className={selectedElementId === item.id ? "report-page-object-row active" : "report-page-object-row"} key={item.id}>
                          <button type="button" className="report-page-object-select" onClick={() => selectPageElement(page, item)}>
                            <span>{item.name}</span>
                            <small>{elementTypeLabel(item)} · {objectStatus(item)}</small>
                          </button>
                          <div className="report-page-object-actions" aria-label={`Object actions for ${item.name}`}>
                            <button type="button" className="mini-button" onClick={(event) => toggleElementHidden(event, item)}>
                              {item.hidden ? "Show" : "Hide"}
                            </button>
                            <button type="button" className="mini-button" onClick={(event) => toggleElementLocked(event, item)}>
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
      </div>
      <div className="brand-card-actions">
        <button type="button" className="secondary" onClick={() => addPage()}>
          New page
        </button>
        <button type="button" className="secondary" onClick={duplicateActivePage}>
          Duplicate page
        </button>
      </div>
      <button type="button" className="secondary" onClick={deleteActivePage} disabled={sortedPages.length <= 1}>
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
