import {
  AnalysisLibrarySection,
  QueryEditorSection,
  SourcePickerSection,
} from "./DataExplorerSections";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";

export function DataWorkbench(props: AnalysisAuthoringPanelProps) {
  const importedStudies = props.importedDatasets ?? [];
  return (
    <div className="studio-data-workbench">
      <div className="studio-workbench-intro">
        <span className="studio-eyebrow">ANALYSIS WORKBENCH</span>
        <p>
          Full control over your sources, analytical logic, and reusable
          outputs.
        </p>
      </div>
      {importedStudies.length > 0 && (
        <div className="studio-workbench-import-handoff">
          <p>
            Sources and Query use your selected question or variable set.
            To analyze an imported study, open its guided setup.
          </p>
          {importedStudies.map((importedStudy) => <button
            key={importedStudy.id}
            type="button"
            onClick={() => props.openGuidedDataQuery({
              outputMode: "table",
              importedDatasetId: importedStudy.id,
            })}
          >
            Analyze {importedStudy.title}
          </button>)}
        </div>
      )}
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
