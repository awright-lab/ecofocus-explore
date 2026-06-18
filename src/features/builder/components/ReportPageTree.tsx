import { useMemo, useState } from "react";
import { themePreviewBackground } from "../builderHelpers";
import type { DashboardPage, PageTemplatePreset, PageThemePreset } from "../../../../shared/types/dashboard";

type ReportPageTreeProps = {
  sortedPages: DashboardPage[];
  activePage: DashboardPage;
  pageTemplates: PageTemplatePreset[];
  pageThemes: PageThemePreset[];
  setActivePageId: (pageId: string) => void;
  selectPage: () => void;
  addPage: (template?: PageTemplatePreset) => void;
  duplicateActivePage: () => void;
  deleteActivePage: () => void;
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
  addPage,
  duplicateActivePage,
  deleteActivePage
}: ReportPageTreeProps) {
  const [pageSearch, setPageSearch] = useState("");
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
        {visiblePages.map((page) => (
          <button
            type="button"
            key={page.id}
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
        ))}
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
