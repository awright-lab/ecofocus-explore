import { useMemo, useState } from "react";
import type React from "react";
import { themePreviewBackground } from "../builderHelpers";
import type { DashboardPage, PageTemplatePreset, PageThemePreset } from "../../../../shared/types/dashboard";

type ReportPageTreeProps = {
  sortedPages: DashboardPage[];
  activePage: DashboardPage;
  pageTemplates: PageTemplatePreset[];
  pageThemes: PageThemePreset[];
  setActivePageId: (pageId: string) => void;
  selectPage: () => void;
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

export function ReportPageTree({
  sortedPages,
  activePage,
  pageTemplates,
  pageThemes,
  setActivePageId,
  selectPage,
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

          return (
            <div className={page.id === activePage.id ? "report-page-node-row active" : "report-page-node-row"} key={page.id}>
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
