import type { AnalysisWeightDiagnosticsView } from "./analysisWeightDiagnosticsModel";

interface AnalysisWeightDiagnosticsCardProps {
  view: AnalysisWeightDiagnosticsView;
}

export function AnalysisWeightDiagnosticsCard({ view }: AnalysisWeightDiagnosticsCardProps) {
  return (
    <div className={`analysis-weight-diagnostics-card ${view.status}`}>
      <div>
        <span>{view.label}</span>
        <strong>{view.value}</strong>
        <p>{view.helper}</p>
      </div>
      <div className="explorer-chip-row">
        {view.chips.map((chip) => (
          <span className="explorer-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
