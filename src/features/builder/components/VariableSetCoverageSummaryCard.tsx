import { useState } from "react";
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
  const [showUncoveredOptions, setShowUncoveredOptions] = useState(false);
  const [showMultiplyUsedOptions, setShowMultiplyUsedOptions] = useState(false);
  const hasUncoveredOptions = coverage.uncoveredOptionLabels.length > 0;
  const hasMultiplyUsedOptions = coverage.multiplyUsedOptionLabels.length > 0;

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
      {(hasUncoveredOptions || hasMultiplyUsedOptions) && (
        <div className="variable-set-coverage-actions">
          {hasUncoveredOptions && (
            <button
              type="button"
              className={showUncoveredOptions ? "secondary variable-set-coverage-action active" : "secondary variable-set-coverage-action"}
              onClick={() => setShowUncoveredOptions((current) => !current)}
            >
              {showUncoveredOptions ? "Hide uncovered options" : "Show uncovered options"}
            </button>
          )}
          {hasMultiplyUsedOptions && (
            <button
              type="button"
              className={showMultiplyUsedOptions ? "secondary variable-set-coverage-action active" : "secondary variable-set-coverage-action"}
              onClick={() => setShowMultiplyUsedOptions((current) => !current)}
            >
              {showMultiplyUsedOptions ? "Hide multiply used options" : "Show multiply used options"}
            </button>
          )}
        </div>
      )}
      <div className="variable-set-coverage-lists">
        <span>Uncovered: {labelsSummary(coverage.uncoveredOptionLabels)}</span>
        <span>Multiply used: {labelsSummary(coverage.multiplyUsedOptionLabels)}</span>
      </div>
      {showUncoveredOptions && (
        <div className="variable-set-coverage-focus">
          <span>Uncovered question options</span>
          <div className="explorer-chip-row">
            {coverage.uncoveredOptionLabels.map((label) => (
              <span className="explorer-chip warning-chip" key={label}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      {showMultiplyUsedOptions && (
        <div className="variable-set-coverage-focus">
          <span>Multiply used question options</span>
          <div className="explorer-chip-row">
            {coverage.multiplyUsedOptionLabels.map((label) => (
              <span className="explorer-chip warning-chip" key={label}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
