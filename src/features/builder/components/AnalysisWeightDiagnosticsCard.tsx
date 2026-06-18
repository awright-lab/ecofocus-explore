import type { AnalysisContextMismatchView, AnalysisWeightDiagnosticsView } from "./analysisWeightDiagnosticsModel";

interface AnalysisWeightDiagnosticsCardProps {
  view: AnalysisWeightDiagnosticsView;
  mismatches?: Array<AnalysisContextMismatchView | null | undefined>;
}

export function AnalysisWeightDiagnosticsCard({ view, mismatches = [] }: AnalysisWeightDiagnosticsCardProps) {
  const visibleMismatches = mismatches.filter((mismatch): mismatch is AnalysisContextMismatchView => Boolean(mismatch));

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
      {visibleMismatches.map((mismatch) => (
        <div className="analysis-weight-mismatch-cue" key={mismatch.label}>
          <div>
            <strong>{mismatch.label}</strong>
            <span>{mismatch.message}</span>
            <small>{mismatch.helper}</small>
          </div>
          <div className="explorer-chip-row">
            {mismatch.chips.map((chip) => (
              <span className="explorer-chip warning-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
