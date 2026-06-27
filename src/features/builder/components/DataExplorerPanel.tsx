import { defaultDataset } from "../builderConstants";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { AnalysisLibrarySection, QueryEditorSection, SourcePickerSection } from "./DataExplorerSections";

export function DataExplorerPanel(props: AnalysisAuthoringPanelProps) {
  const { leftPanelView, exploreView, setExploreView } = props;

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
