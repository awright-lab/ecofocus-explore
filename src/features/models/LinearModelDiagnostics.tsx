import { useId, useState } from "react";
import type { ModelCaseDiagnostic } from "./linearModelMath";
import type { LinearModelRun } from "./linearModelJob";
import { importedFieldDisplayLabel } from "../data/datasetModelingModel";

export function modelNumber(value: number | null) {
  if (value === null) return "Unavailable";
  if (value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e7)) return value.toExponential(4);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(value);
}
function Plot({ cases, title, x, y, xLabel, yLabel, diagonal = false }: { cases: ModelCaseDiagnostic[]; title: string; x: (row: ModelCaseDiagnostic) => number; y: (row: ModelCaseDiagnostic) => number; xLabel: string; yLabel: string; diagonal?: boolean }) {
  const id = useId(), width = 500, height = 300, left = 70, right = 20, top = 20, bottom = 60;
  const xs = cases.map(x), ys = cases.map(y);
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (diagonal) { const min = Math.min(xmin, ymin), max = Math.max(xmax, ymax); xmin = ymin = min; xmax = ymax = max; }
  if (xmin === xmax) { xmin -= 1; xmax += 1; } if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const sx = (value: number) => left + (value - xmin) / (xmax - xmin) * (width - left - right);
  const sy = (value: number) => height - bottom - (value - ymin) / (ymax - ymin) * (height - top - bottom);
  const indices = new Set([0, cases.length - 1, xs.indexOf(Math.min(...xs)), xs.indexOf(Math.max(...xs)), ys.indexOf(Math.min(...ys)), ys.indexOf(Math.max(...ys))]);
  const count = Math.min(500, cases.length);
  for (let index = 0; index < count && indices.size < count; index++) indices.add(Math.floor(index * (cases.length - 1) / Math.max(1, count - 1)));
  for (let index = 0; indices.size < count; index++) indices.add(index);
  const shown = [...indices].sort((a, b) => a - b).map(index => cases[index]);
  return <figure className="model-plot"><figcaption>{title}</figcaption><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={id}>
    <title id={id}>{title}. Showing {shown.length} of {cases.length} cases; numeric values are available in the diagnostic table.</title>
    <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#647b6d" /><line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#647b6d" />
    {diagonal ? <line x1={sx(xmin)} y1={sy(ymin)} x2={sx(xmax)} y2={sy(ymax)} stroke="#a66f2e" strokeDasharray="5 4" /> : ymin <= 0 && ymax >= 0 && <line x1={left} y1={sy(0)} x2={width - right} y2={sy(0)} stroke="#a66f2e" strokeDasharray="5 4" />}
    {shown.map(row => <circle key={row.row} cx={sx(x(row))} cy={sy(y(row))} r={3} fill="#28715b" opacity={0.55}><title>Import row {row.row}: actual {row.actual}; predicted {row.predicted}; residual {row.residual}</title></circle>)}
    <text x={left} y={height - bottom + 18} fontSize={11}>{modelNumber(xmin)}</text><text x={width - right} y={height - bottom + 18} textAnchor="end" fontSize={11}>{modelNumber(xmax)}</text>
    <text x={left - 7} y={top + 5} textAnchor="end" fontSize={11}>{modelNumber(ymax)}</text><text x={left - 7} y={height - bottom} textAnchor="end" fontSize={11}>{modelNumber(ymin)}</text>
    <text x={(left + width - right) / 2} y={height - 12} textAnchor="middle" fontSize={13}>{xLabel}</text><text transform={`translate(15 ${(height - bottom + top) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13}>{yLabel}</text>
  </svg><small>{shown.length} displayed of {cases.length}; extremes included, axes use all cases. Inspect largest errors in the table.</small></figure>;
}
export function LinearModelDiagnostics({ run }: { run: LinearModelRun }) {
  const [split, setSplit] = useState<"training" | "holdout">("holdout"), [largest, setLargest] = useState(false), [page, setPage] = useState(0);
  const metrics = run[split], data = largest ? [...metrics.diagnostics].sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual) || a.row - b.row) : [...metrics.diagnostics].sort((a, b) => a.row - b.row);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(data.length / 25) - 1));
  const outside = run.holdout.diagnostics.filter(row => row.outsideTrainingRange).length;
  return <section aria-label="Linear model results">
    <h3>Review fit and holdout performance</h3>
    <p><strong>Associations, not causes.</strong> A coefficient describes this fitted linear relationship while other selected predictors are held fixed. It does not identify what would happen after an intervention.</p>
    <div className="model-metrics-grid">{(["training", "holdout"] as const).map(key => <section key={key} aria-label={`${key === "training" ? "Training" : "Holdout"} model metrics`}><h4>{key === "training" ? "Training fit" : "Held-out check"} · {run[key].rows} rows</h4><dl>{([
      ["R²", run[key].rSquared], ["RMSE", run[key].rmse], ["Mean absolute error", run[key].mae], ["Training-mean baseline RMSE", run[key].baselineRmse], ...(key === "training" ? [["Adjusted R²", run[key].adjustedRSquared]] : []),
    ] as Array<[string, number | null]>).map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value === null ? "Undefined" : String(value)}>{modelNumber(value)}</dd></div>)}</dl></section>)}</div>
    <p>RMSE and absolute error use outcome units; lower means less error on these rows. The baseline always predicts the training outcome mean. Each R² uses that split's own outcome mean; holdout R² can be negative or undefined. Numbers are rounded for display; hover for stored precision.</p>
    {run.holdout.rmse >= run.holdout.baselineRmse && <p className="model-notice">On this split, the model did not beat the training-mean baseline. Do not treat training fit as evidence of predictive usefulness.</p>}
    {outside > 0 && <p>{outside} of {run.holdout.rows} holdout rows have a predictor outside its training range. This makes extrapolation relevant; no predictions for future populations are established.</p>}
    <h3>Conditional associations</h3>
    <div className="model-table"><table><caption>Exploratory linear-model coefficients — no significance tests or confidence intervals</caption><thead><tr><th scope="col">Term</th><th scope="col">Slope in original units</th><th scope="col">Standardized association</th><th scope="col">Variance inflation factor</th></tr></thead><tbody>
      <tr><th scope="row">Intercept</th><td title={String(run.fit.intercept)}>{modelNumber(run.fit.intercept)}</td><td>Not applicable</td><td>Not applicable</td></tr>
      {run.context.predictors.map((field, index) => <tr key={field.id}><th scope="row">{importedFieldDisplayLabel(field)}<small>Raw column: {field.sourceColumn}</small></th><td title={String(run.fit.coefficients[index])}>{modelNumber(run.fit.coefficients[index])}</td><td title={String(run.fit.standardizedCoefficients[index])}>{modelNumber(run.fit.standardizedCoefficients[index])}</td><td title={String(run.fit.vif[index])}>{modelNumber(run.fit.vif[index])}</td></tr>)}
    </tbody></table></div>
    <p>Standardized associations use training standard deviations of each predictor and the outcome; they are not causal importance rankings. VIF describes predictor overlap; larger values indicate less stable separate coefficients. The intercept at zero predictors may lie outside the observed data.</p>
    {run.fit.vif.some(value => value > 5) && <p className="model-notice">At least one VIF exceeds 5, a screening flag used here rather than a universal validity threshold. Inspect redundant predictors; none were removed automatically.</p>}
    <h3>Inspect model errors</h3><label>Diagnostic split<select value={split} onChange={event => { setSplit(event.target.value as typeof split); setPage(0); }}><option value="holdout">Held-out rows</option><option value="training">Training rows</option></select></label>
    <p>Patterns, widening residual spread or unusual cases can reveal a poor model even with high R². Normality, independence and constant variance are not certified by these plots. Row order is import order, not inferred time.</p>
    <div className="model-plots"><Plot cases={metrics.diagnostics} title={`${split === "holdout" ? "Holdout" : "Training"}: residuals versus predictions`} x={row => row.predicted} y={row => row.residual} xLabel="Predicted outcome" yLabel="Actual − predicted" /><Plot cases={metrics.diagnostics} title={`${split === "holdout" ? "Holdout" : "Training"}: actual versus predicted`} x={row => row.predicted} y={row => row.actual} xLabel="Predicted outcome" yLabel="Actual outcome" diagonal /><Plot cases={metrics.diagnostics} title={`${split === "holdout" ? "Holdout" : "Training"}: residuals in import order`} x={row => row.row} y={row => row.residual} xLabel="Import row position" yLabel="Actual − predicted" /></div>
    <label className="model-inline"><input type="checkbox" checked={largest} onChange={event => { setLargest(event.target.checked); setPage(0); }} />Show largest absolute errors first</label>
    <div className="model-table"><table><caption>{split === "holdout" ? "Holdout" : "Training"} case diagnostics — every case available through pagination</caption><thead><tr><th scope="col">Import row</th><th scope="col">Actual</th><th scope="col">Predicted</th><th scope="col">Residual</th><th scope="col">Training leverage</th></tr></thead><tbody>{data.slice(currentPage * 25, (currentPage + 1) * 25).map(row => <tr key={row.row}><th scope="row">{row.row}</th>{[row.actual, row.predicted, row.residual].map((value, index) => <td key={index} title={String(value)}>{modelNumber(value)}</td>)}<td>{row.leverage === null ? "Not a training row" : modelNumber(row.leverage)}</td></tr>)}</tbody></table></div>
    <p>Showing {currentPage * 25 + 1}–{Math.min((currentPage + 1) * 25, data.length)} of {data.length} cases. Row positions identify imported rows, not unique people. Large leverage describes unusual predictor combinations, not proof of actual influence or bad data.</p>
    <div className="model-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous model cases</button><button type="button" disabled={(currentPage + 1) * 25 >= data.length} onClick={() => setPage(currentPage + 1)}>Next model cases</button></div>
  </section>;
}
