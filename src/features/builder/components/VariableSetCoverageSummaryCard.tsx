import type { VariableSetRecodeCoverageView } from "./variableSetValidationModel";

interface VariableSetCoverageSummaryCardProps {
  coverage: VariableSetRecodeCoverageView;
}

function labelsSummary(labels: string[]) {
  if (labels.length === 0) return "None";
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

export function VariableSetCoverageSummaryCard({ coverage }: VariableSetCoverageSummaryCardProps) {
  return (
    <div className={`variable-set-coverage-card ${coverage.status}`}>
      <div className="explorer-section-header">
        <strong>Coverage summary</strong>
        <small>{coverage.coverageLabel}</small>
      </div>
      <div className="variable-set-coverage-grid">
        <div>
          <span>Covered</span>
          <strong>{coverage.coveredOptionCount}/{coverage.totalOptionCount}</strong>
        </div>
        <div>
          <span>Uncovered</span>
          <strong>{coverage.uncoveredOptionCount}</strong>
        </div>
        <div>
          <span>Multiply used</span>
          <strong>{coverage.multiplyUsedOptionCount}</strong>
        </div>
      </div>
      <small>{coverage.helper}</small>
      <div className="variable-set-coverage-lists">
        <span>Uncovered: {labelsSummary(coverage.uncoveredOptionLabels)}</span>
        <span>Multiply used: {labelsSummary(coverage.multiplyUsedOptionLabels)}</span>
      </div>
    </div>
  );
}
