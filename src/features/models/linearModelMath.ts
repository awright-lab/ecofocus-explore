import { FiniteNumericSum } from "../data/finiteNumericSum";

export interface NumericModelCase { row: number; outcome: number; predictors: number[] }
export interface LinearTrainingFit {
  intercept: number;
  coefficients: number[];
  standardizedCoefficients: number[];
  predictorMeans: number[];
  predictorScales: number[];
  predictorRanges: Array<{ min: number; max: number }>;
  outcomeMean: number;
  outcomeScale: number;
  centeredIntercept: number;
  inverseR: number[][];
  vif: number[];
  trainingRows: number;
}
export interface ModelCaseDiagnostic { row: number; actual: number; predicted: number; residual: number; leverage: number | null; outsideTrainingRange: boolean }
export interface LinearModelMetrics { rows: number; rmse: number; mae: number; baselineRmse: number; rSquared: number | null; adjustedRSquared: number | null; residualMean: number; diagnostics: ModelCaseDiagnostic[] }
export const maximumModelRows = 25000;
export const maximumModelPredictors = 6;
export const maximumModelMagnitude = 1e12;

function total(values: number[]): number {
  const sum = new FiniteNumericSum(); values.forEach(value => sum.add(value));
  const result = sum.value();
  if (result === null) throw Error("The model exceeded finite numerical range. Change the variables or their units.");
  return result;
}
const dot = (a: number[], b: number[]) => total(a.map((value, index) => value * b[index]));
// Scale before squaring: raw squared residuals can underflow even when an
// individual residual and its RMSE are representable in binary64.
function stableNorm(values: number[]): number {
  const scale = Math.max(...values.map(Math.abs));
  if (scale === 0) return 0;
  if (!Number.isFinite(scale)) throw Error("A model diagnostic exceeded supported numerical range.");
  const norm = scale * Math.sqrt(total(values.map(value => (value / scale) ** 2)));
  if (!Number.isFinite(norm)) throw Error("A model diagnostic exceeded supported numerical range.");
  return norm;
}
function checkCases(cases: NumericModelCase[], predictors?: number) {
  const p = predictors ?? cases[0]?.predictors.length;
  if (!Number.isSafeInteger(p) || p < 1 || p > maximumModelPredictors || !cases.length || cases.length > maximumModelRows) throw Error("Choose one to six numeric predictors and at most 25,000 complete rows.");
  const ids = new Set<number>();
  for (const row of cases) {
    if (!Number.isSafeInteger(row.row) || row.row < 1 || ids.has(row.row) || row.predictors.length !== p || ![row.outcome, ...row.predictors].every(value => Number.isFinite(value) && Math.abs(value) <= maximumModelMagnitude)) throw Error("Model rows have duplicate identities, incompatible variables or values outside the supported finite range (absolute value at most 1e12).");
    ids.add(row.row);
  }
  return p;
}
function center(values: number[], label: string) {
  const mean = total(values) / values.length;
  const scale = stableNorm(values.map(value => value - mean)) / Math.sqrt(values.length - 1);
  const largest = Math.max(...values.map(Math.abs));
  if (!Number.isFinite(scale) || scale === 0 || scale / Math.max(largest, Number.MIN_VALUE) < 1e-12) throw Error(`${label} is constant or too close to numerical resolution in the training rows. Choose a different field or units.`);
  if (scale < 1e-150) throw Error(`${label} has a training standard deviation below the supported 1e-150 range. Rescale its units before fitting; no reliable model diagnostics were produced.`);
  return { mean, scale };
}

/** Centered/scaled Householder QR, including an intercept. No normal equations. */
export function fitLinearModel(cases: NumericModelCase[]): LinearTrainingFit {
  const p = checkCases(cases), n = cases.length, dimensions = p + 1;
  if (n <= dimensions) throw Error("More training rows than model parameters are required.");
  const x = Array.from({ length: p }, (_, column) => center(cases.map(row => row.predictors[column]), `Predictor ${column + 1}`));
  const y = center(cases.map(row => row.outcome), "Outcome");
  const a = cases.map(row => [1, ...row.predictors.map((value, column) => (value - x[column].mean) / x[column].scale)]);
  const rhs = cases.map(row => (row.outcome - y.mean) / y.scale);
  for (let column = 0; column < dimensions; column++) {
    const vector = a.slice(column).map(row => row[column]);
    const norm = Math.sqrt(dot(vector, vector));
    if (!Number.isFinite(norm) || norm < 1e-10 * Math.sqrt(n)) throw Error("Predictors are numerically dependent. Remove a redundant predictor before fitting.");
    const diagonal = vector[0] >= 0 ? -norm : norm;
    vector[0] -= diagonal;
    const factor = 2 / dot(vector, vector);
    for (let other = column; other < dimensions; other++) {
      const projection = factor * dot(vector, a.slice(column).map(row => row[other]));
      for (let row = column; row < n; row++) a[row][other] -= projection * vector[row - column];
    }
    const projection = factor * dot(vector, rhs.slice(column));
    for (let row = column; row < n; row++) rhs[row] -= projection * vector[row - column];
    a[column][column] = diagonal;
    for (let row = column + 1; row < n; row++) a[row][column] = 0;
  }
  const beta = Array<number>(dimensions).fill(0);
  for (let row = dimensions - 1; row >= 0; row--) beta[row] = (rhs[row] - total(beta.slice(row + 1).map((value, index) => value * a[row][row + 1 + index]))) / a[row][row];
  const inverseR = Array.from({ length: dimensions }, () => Array<number>(dimensions).fill(0));
  for (let target = 0; target < dimensions; target++) for (let row = dimensions - 1; row >= 0; row--) inverseR[row][target] = ((row === target ? 1 : 0) - total(inverseR.slice(row + 1).map((values, index) => a[row][row + 1 + index] * values[target]))) / a[row][row];
  const coefficients = beta.slice(1).map((value, index) => value * y.scale / x[index].scale);
  const centeredIntercept = y.mean + beta[0] * y.scale;
  const intercept = total([centeredIntercept, ...coefficients.map((value, index) => -value * x[index].mean)]);
  const vif = Array.from({ length: p }, (_, index) => Math.max(1, dot(inverseR[index + 1], inverseR[index + 1]) * (n - 1)));
  if (![intercept, centeredIntercept, ...coefficients, ...beta, ...vif, ...inverseR.flat()].every(Number.isFinite)) throw Error("The model is numerically unstable. Choose different predictors or units.");
  return { intercept, coefficients, standardizedCoefficients: beta.slice(1), predictorMeans: x.map(item => item.mean), predictorScales: x.map(item => item.scale), predictorRanges: Array.from({ length: p }, (_, column) => ({ min: Math.min(...cases.map(row => row.predictors[column])), max: Math.max(...cases.map(row => row.predictors[column])) })), outcomeMean: y.mean, outcomeScale: y.scale, centeredIntercept, inverseR, vif, trainingRows: n };
}

export function predictLinearModel(fit: LinearTrainingFit, predictors: number[]) {
  if (predictors.length !== fit.coefficients.length || !predictors.every(value => Number.isFinite(value) && Math.abs(value) <= maximumModelMagnitude)) throw Error("Prediction variables do not match the supported model.");
  return total([fit.centeredIntercept, ...predictors.map((value, index) => ((value - fit.predictorMeans[index]) / fit.predictorScales[index]) * fit.standardizedCoefficients[index] * fit.outcomeScale)]);
}
export function evaluateLinearModel(fit: LinearTrainingFit, cases: NumericModelCase[], training = false): LinearModelMetrics {
  const p = checkCases(cases, fit.coefficients.length), dimensions = p + 1;
  const diagnostics = cases.map(row => {
    const predicted = predictLinearModel(fit, row.predictors), residual = row.outcome - predicted;
    const design = [1, ...row.predictors.map((value, index) => (value - fit.predictorMeans[index]) / fit.predictorScales[index])];
    const projection = Array.from({ length: dimensions }, (_, column) => total(design.map((value, index) => value * fit.inverseR[index][column])));
    const leverage = training ? dot(projection, projection) : null;
    if (!Number.isFinite(residual) || leverage !== null && (!Number.isFinite(leverage) || leverage < -1e-10 || leverage > 1 + 1e-8)) throw Error("A diagnostic exceeded supported numerical range.");
    return { row: row.row, actual: row.outcome, predicted, residual, leverage: leverage === null ? null : Math.max(0, Math.min(1, leverage)), outsideTrainingRange: row.predictors.some((value, index) => value < fit.predictorRanges[index].min || value > fit.predictorRanges[index].max) };
  });
  const residualNorm = stableNorm(diagnostics.map(row => row.residual)), mean = total(cases.map(row => row.outcome)) / cases.length;
  const outcomeNorm = stableNorm(cases.map(row => row.outcome - mean));
  const rawRSquared = outcomeNorm > 0 ? 1 - (residualNorm / outcomeNorm) ** 2 : null;
  const rSquared = rawRSquared !== null && Number.isFinite(rawRSquared) ? rawRSquared : null;
  const adjustedRSquared = training && rSquared !== null && cases.length > dimensions ? 1 - (1 - rSquared) * (cases.length - 1) / (cases.length - dimensions) : null;
  return { rows: cases.length, rmse: residualNorm / Math.sqrt(cases.length), mae: total(diagnostics.map(row => Math.abs(row.residual))) / cases.length, baselineRmse: stableNorm(cases.map(row => row.outcome - fit.outcomeMean)) / Math.sqrt(cases.length), rSquared, adjustedRSquared, residualMean: total(diagnostics.map(row => row.residual)) / cases.length, diagnostics };
}

export function splitModelCases(cases: NumericModelCase[], seed: number) {
  checkCases(cases);
  if (cases.length < 50 || !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw Error("Use at least 50 complete rows and an integer split seed from 1 to 4294967295.");
  const shuffled = [...cases]; let state = seed >>> 0;
  for (let index = shuffled.length - 1; index > 0; index--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const selected = Math.floor((state >>> 0) / 4294967296 * (index + 1));
    [shuffled[index], shuffled[selected]] = [shuffled[selected], shuffled[index]];
  }
  const holdoutRows = Math.round(cases.length * 0.2);
  return { training: shuffled.slice(holdoutRows), holdout: shuffled.slice(0, holdoutRows) };
}
