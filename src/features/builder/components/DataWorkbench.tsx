import {
  AnalysisLibrarySection,
  QueryEditorSection,
  SourcePickerSection,
} from "./DataExplorerSections";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";

export function DataWorkbench(props: AnalysisAuthoringPanelProps) {
  return (
    <div className="studio-data-workbench">
      <div className="studio-workbench-intro">
        <span className="studio-eyebrow">ANALYSIS WORKBENCH</span>
        <p>
          Full control over your sources, analytical logic, and reusable
          outputs.
        </p>
      </div>
      <nav
        className="studio-workbench-tabs"
        aria-label="Advanced analysis tools"
      >
        {(
          [
            ["source", "Sources"],
            ["analyze", "Query"],
            ["library", "Saved"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={props.exploreView === id ? "active" : ""}
            aria-pressed={props.exploreView === id}
            onClick={() => props.setExploreView(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {props.exploreView === "source" && <SourcePickerSection {...props} />}
      {props.exploreView === "analyze" && <QueryEditorSection {...props} />}
      {props.exploreView === "library" && <AnalysisLibrarySection {...props} />}
    </div>
  );
}
