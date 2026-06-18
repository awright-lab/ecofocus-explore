import type { AnalysisWeightDiagnosticsView, AnalysisWeightMismatchView } from "./analysisWeightDiagnosticsModel";

interface AnalysisWeightDiagnosticsCardProps {
  view: AnalysisWeightDiagnosticsView;
  mismatch?: AnalysisWeightMismatchView | null;
}

export function AnalysisWeightDiagnosticsCard({ view, mismatch }: AnalysisWeightDiagnosticsCardProps) {
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
      {mismatch && (
        <div className="analysis-weight-mismatch-cue">
          <strong>{mismatch.label}</strong>
          <span>{mismatch.message}</span>
          <small>{mismatch.helper}</small>
          <div className="explorer-chip-row">
            {mismatch.chips.map((chip) => (
              <span className="explorer-chip warning-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
