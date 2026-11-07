import type { AnalyticsQueryResponse } from "./analytics";

export interface CellFormulaOperand { id: string; label: string; sourceCategoryKey: string; value: number }
export interface CellFormulaSpec {
  version: 1;
  expression: string;
  label: string;
  binding: string;
  input: {
    a: CellFormulaOperand;
    b: CellFormulaOperand;
    column: { id: string; label: string; sourceCategoryKey?: string };
    metric: AnalyticsQueryResponse["metric"];
    base: number;
  };
}
