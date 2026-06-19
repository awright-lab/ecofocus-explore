import type { AnalysisContextDiagnosticsSummaryView, AnalysisContextMismatchView, AnalysisWeightDiagnosticsView } from "./analysisWeightDiagnosticsModel";

interface AnalysisWeightDiagnosticsCardProps {
  view: AnalysisWeightDiagnosticsView;
  mismatches?: Array<AnalysisContextMismatchView | null | undefined>;
  mismatchSummary?: AnalysisContextDiagnosticsSummaryView | null;
}

export function AnalysisWeightDiagnosticsCard({ view, mismatches = [], mismatchSummary = null }: AnalysisWeightDiagnosticsCardProps) {
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
      {mismatchSummary && (
        <div className={`analysis-context-summary ${mismatchSummary.status}`}>
          <div>
            <strong>{mismatchSummary.label}</strong>
            <span>{mismatchSummary.message}</span>
            <small>{mismatchSummary.helper}</small>
          </div>
          <div className="explorer-chip-row">
            {mismatchSummary.chips.map((chip) => (
              <span className={chip.endsWith("differs") ? "explorer-chip warning-chip" : "explorer-chip"} key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}
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
