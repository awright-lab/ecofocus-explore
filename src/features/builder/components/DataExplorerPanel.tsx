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
      <div className="panel-title">
        <h2>Explore</h2>
      </div>
      <div className="data-explorer">
        <div className="color-summary-card">
          <div>
            <span>Dataset</span>
            <strong>{defaultDataset.label}</strong>
          </div>
          <small>{defaultDataset.description}</small>
        </div>
        <div className="explore-flow-tabs">
          <button type="button" className={exploreView === "source" ? "active" : ""} onClick={() => setExploreView("source")}>
            1. Source
          </button>
          <button type="button" className={exploreView === "analyze" ? "active" : ""} onClick={() => setExploreView("analyze")}>
            2. Analyze
          </button>
          <button type="button" className={exploreView === "library" ? "active" : ""} onClick={() => setExploreView("library")}>
            3. Library
          </button>
        </div>
        <div className="explore-step-card">
          {exploreView === "source" && (
            <>
              <div>
                <span>Step 1</span>
                <strong>Choose a source</strong>
              </div>
              <small>Pick a saved variable set or question. You can click to load it or drag it straight onto the canvas.</small>
            </>
          )}
          {exploreView === "analyze" && (
            <>
              <div>
                <span>Step 2</span>
                <strong>Shape the analysis</strong>
              </div>
              <small>Adjust banner, metric, weight, filter, and chart type for the currently selected source before adding a tile.</small>
            </>
          )}
          {exploreView === "library" && (
            <>
              <div>
                <span>Step 3</span>
                <strong>Save reusable objects</strong>
              </div>
              <small>Turn the current setup into reusable variable sets, banners, filters, or weights for faster reporting.</small>
            </>
          )}
        </div>

        {exploreView === "source" && <SourcePickerSection {...props} />}
        {exploreView === "analyze" && <QueryEditorSection {...props} />}
        {exploreView === "library" && <AnalysisLibrarySection {...props} />}
      </div>
    </>
  );
}
