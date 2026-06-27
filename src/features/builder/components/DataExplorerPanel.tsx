import { defaultDataset } from "../builderConstants";
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
        <div className="data-library-hero">
          <div>
            <span>Active dataset</span>
            <strong>{defaultDataset.label}</strong>
          </div>
          <small>{defaultDataset.description}</small>
          <div className="data-library-chips">
            <span>{defaultDataset.questions.length} variables</span>
            <span>{defaultDataset.dimensions.length} banners</span>
          </div>
        </div>
        <div className="mockup-library-stack" aria-label="Data library overview">
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Datasets</strong>
              <button type="button" onClick={() => setExploreView("source")}>+</button>
            </div>
            <button type="button" className="mockup-library-row active" onClick={() => setExploreView("source")}>
              <span>▤</span>
              <div>
                <strong>{defaultDataset.label}</strong>
                <small>{defaultDataset.wave} wave · min base {defaultDataset.minBaseWarning}</small>
              </div>
            </button>
            <button type="button" className="mockup-library-row quiet" onClick={() => setExploreView("source")}>
              <span>▤</span>
              <div>
                <strong>2024 EcoFocus Study</strong>
                <small>Wave comparison source</small>
              </div>
            </button>
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Variables</strong>
              <button type="button" onClick={() => setExploreView("source")}>+</button>
            </div>
            {filteredQuestions.slice(0, 5).map((question) => (
              <button type="button" className="mockup-library-row compact" key={question.id} onClick={() => setExploreView("source")}>
                <span>▥</span>
                <strong>{question.shortLabel}</strong>
              </button>
            ))}
          </section>
          <section className="mockup-library-section">
            <div className="mockup-library-section__header">
              <strong>Filters</strong>
              <button type="button" onClick={() => setExploreView("library")}>+</button>
            </div>
            {(savedFilters.length > 0 ? savedFilters.slice(0, 3).map((filter) => filter.label) : ["Region: Global", "Age: All shoppers", "Employment: All"]).map((label) => (
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
            {(savedSegmentProfiles.length > 0 ? savedSegmentProfiles.slice(0, 3).map((segment) => segment.label) : ["Eco engaged", "Convenience seekers", "Price focused"]).map((label, index) => (
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
        <div className="explore-flow-tabs">
          <button type="button" className={exploreView === "source" ? "active" : ""} onClick={() => setExploreView("source")}>
            Sources
          </button>
          <button type="button" className={exploreView === "analyze" ? "active" : ""} onClick={() => setExploreView("analyze")}>
            Query
          </button>
          <button type="button" className={exploreView === "library" ? "active" : ""} onClick={() => setExploreView("library")}>
            Saved
          </button>
        </div>
        <details className="explore-step-card compact">
          <summary>
            {exploreView === "source" && <><span>Source context</span><strong>Choose a variable or set</strong></>}
            {exploreView === "analyze" && <><span>Query context</span><strong>Shape the analysis</strong></>}
            {exploreView === "library" && <><span>Reusable context</span><strong>Use saved analytical assets</strong></>}
          </summary>
          {exploreView === "source" && <small>Pick a saved variable set or question. You can click to load it or drag it straight onto the canvas.</small>}
          {exploreView === "analyze" && <small>Adjust banner, metric, weight, filter, and chart type for the currently selected source before adding a tile.</small>}
          {exploreView === "library" && <small>Turn the current setup into reusable variable sets, banners, filters, or weights for faster reporting.</small>}
        </details>

        {exploreView === "source" && <SourcePickerSection {...props} />}
        {exploreView === "analyze" && <QueryEditorSection {...props} />}
        {exploreView === "library" && <AnalysisLibrarySection {...props} />}
      </div>
    </>
  );
}
