import type { ReactNode } from "react";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { AnalysisLibrarySection, QueryEditorSection, SourcePickerSection } from "./DataExplorerSections";

type DataLibraryIconName = "dataset" | "variable" | "filter" | "segment" | "banner" | "chart";

function DataLibraryIcon({ icon }: { icon: DataLibraryIconName }) {
  const paths: Record<DataLibraryIconName, ReactNode> = {
    dataset: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    variable: <><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M3.5 19h17" /></>,
    filter: <><path d="M5 6h14l-5.5 6.3V18l-3 1v-6.7z" /></>,
    segment: <><path d="M12 4 20 12l-8 8-8-8z" /><circle cx="12" cy="12" r="2" /></>,
    banner: <><path d="M5 5h14v12H5z" /><path d="M8 20h8" /><path d="M12 17v3" /></>,
    chart: <><path d="M5 19V5" /><path d="M5 19h15" /><rect x="8" y="11" width="2.8" height="5" rx=".8" /><rect x="13" y="8" width="2.8" height="8" rx=".8" /><rect x="18" y="6" width="2.8" height="10" rx=".8" /></>
  };

  return (
    <svg className="data-library-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

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
              <span><DataLibraryIcon icon="dataset" /></span>
              <div>
                <strong>2026 EcoFocus Study</strong>
                <small>12,540 responses</small>
              </div>
            </button>
            <button type="button" className="mockup-library-row quiet" onClick={() => setExploreView("source")}>
              <span><DataLibraryIcon icon="dataset" /></span>
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
                <span><DataLibraryIcon icon="variable" /></span>
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
                <span><DataLibraryIcon icon="filter" /></span>
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
                <span><DataLibraryIcon icon="segment" /></span>
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
                <span><DataLibraryIcon icon="banner" /></span>
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
                <span><DataLibraryIcon icon="chart" /></span>
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
