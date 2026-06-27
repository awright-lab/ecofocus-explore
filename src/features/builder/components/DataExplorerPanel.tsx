import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { AnalysisLibrarySection, QueryEditorSection, SourcePickerSection } from "./DataExplorerSections";

export function DataExplorerPanel(props: AnalysisAuthoringPanelProps) {
  const {
    leftPanelView,
    exploreView,
    setExploreView,
    filteredQuestions,
    savedVariableSets,
    savedFilters,
    savedSegmentProfiles,
    savedBanners,
    savedAnalyticalTemplates,
    sourceSearch,
    setSourceSearch
  } = props;

  if (leftPanelView !== "data") {
    return null;
  }

  return (
    <>
      <div className="panel-title data-library-title">
        <span>Navigation + sources</span>
        <h2>Data Library</h2>
      </div>
      <div className="data-explorer">
        <label className="data-library-search" aria-label="Search data library">
          <input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Search data library" />
        </label>
        <div className="mockup-library-stack" aria-label="Data library overview">
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Datasets</strong>
              <button type="button" onClick={() => setExploreView("source")}>+</button>
            </div>
            <button type="button" className="mockup-library-row active" onClick={() => setExploreView("source")}>
              <span>◉</span>
              <div>
                <strong>2026 EcoFocus Study</strong>
                <small>12,540 responses</small>
              </div>
            </button>
            <button type="button" className="mockup-library-row quiet" onClick={() => setExploreView("source")}>
              <span>◎</span>
              <div>
                <strong>2024 EcoFocus Study</strong>
                <small>8,750 responses</small>
              </div>
            </button>
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Variables</strong>
              <button type="button" onClick={() => setExploreView("source")}>+</button>
            </div>
            {filteredQuestions.slice(0, 4).map((question) => (
              <button type="button" className="mockup-library-row compact" key={question.id} onClick={() => setExploreView("source")}>
                <span>▥</span>
                <strong>{question.shortLabel}</strong>
              </button>
            ))}
            <button type="button" className="mockup-library-link" onClick={() => setExploreView("source")}>View all variables ({filteredQuestions.length})</button>
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Filters</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(savedFilters.length > 0 ? savedFilters.slice(0, 3).map((filter) => filter.label) : ["Region: Global", "Age: 18–65+", "Employment: All"]).map((label) => (
              <button type="button" className="mockup-library-row compact" key={label} onClick={() => setExploreView("library")}>
                <span>▽</span>
                <strong>{label}</strong>
              </button>
            ))}
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Segments</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(savedSegmentProfiles.length > 0 ? savedSegmentProfiles.slice(0, 3).map((segment) => segment.label) : ["Gen Z (18–27)", "Millennials (28–43)", "Parents"]).map((label, index) => (
              <button type="button" className="mockup-library-row compact with-count" key={label} onClick={() => setExploreView("library")}>
                <span>◇</span>
                <strong>{label}</strong>
                <small>{[2312, 4598, 3764][index]?.toLocaleString()}</small>
              </button>
            ))}
          </section>
          <section className="mockup-library-section quieter">
            <div className="mockup-library-section__header">
              <strong>Banners</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(savedBanners.length > 0 ? savedBanners.slice(0, 2).map((banner) => banner.label) : ["Key takeaway", "Section divider"]).map((label) => (
              <button type="button" className="mockup-library-row compact" key={label} onClick={() => setExploreView("library")}>
                <span>▭</span>
                <strong>{label}</strong>
              </button>
            ))}
          </section>
          <section className="mockup-library-section quieter">
            <div className="mockup-library-section__header">
              <strong>Saved charts</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(savedAnalyticalTemplates.length > 0 ? savedAnalyticalTemplates.slice(0, 3).map((template) => template.label) : savedVariableSets.slice(0, 3).map((item) => item.label)).map((label) => (
              <button type="button" className="mockup-library-row compact" key={label} onClick={() => setExploreView("library")}>
                <span>▥</span>
                <strong>{label}</strong>
              </button>
            ))}
          </section>
        </div>
        <button type="button" className="new-data-query-button" onClick={() => setExploreView("analyze")}>＋ New data query</button>
        {exploreView === "analyze" && <QueryEditorSection {...props} />}
        {exploreView === "library" && <AnalysisLibrarySection {...props} />}
        {exploreView === "source" && sourceSearch.trim() && <SourcePickerSection {...props} />}
      </div>
    </>
  );
}
