import type { VariableSetAuthoredRowAuditView } from "./variableSetValidationModel";

interface VariableSetAuthoredRowAuditCardProps {
  audit: VariableSetAuthoredRowAuditView;
}

export function VariableSetAuthoredRowAuditCard({ audit }: VariableSetAuthoredRowAuditCardProps) {
  return (
    <div className={`variable-set-audit-card ${audit.status}`}>
      <div className="explorer-section-header">
        <strong>Authored row audit</strong>
        <small>{audit.authoredRowCount} authored · {audit.problemRowCount} to review</small>
      </div>
      <div className="variable-set-audit-grid">
        <div>
          <span>Manual nets</span>
          <strong>{audit.manualNetCount}</strong>
        </div>
        <div>
          <span>Top boxes</span>
          <strong>{audit.topBoxCount}</strong>
        </div>
        <div>
          <span>Bottom boxes</span>
          <strong>{audit.bottomBoxCount}</strong>
        </div>
        <div>
          <span>Hidden rows</span>
          <strong>{audit.hiddenRowCount}</strong>
        </div>
        <div>
          <span>Empty authored</span>
          <strong>{audit.emptyAuthoredRowCount}</strong>
        </div>
        <div>
          <span>Overlapping rows</span>
          <strong>{audit.overlappingAuthoredRowCount}</strong>
        </div>
      </div>
      <small>{audit.helper}</small>
      {audit.overlappingSourceOptionCount > 0 && (
        <small>{audit.overlappingSourceOptionCount} source option{audit.overlappingSourceOptionCount === 1 ? "" : "s"} appear in more than one visible authored row.</small>
      )}
    </div>
  );
}
