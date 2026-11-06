import { expect, it } from "vitest";
import reference from "./linear-model-numpy-reference.json";
import { fitLinearModel, predictLinearModel, evaluateLinearModel, splitModelCases, type NumericModelCase } from "../linearModelMath";
const cases: NumericModelCase[] = reference.cases;

it("fits the 25,000-row boundary with six predictors and rejects larger studies", () => {
  const large = Array.from({ length: 25000 }, (_, index) => {
    const predictors = [index % 17 - 8, index * 7 % 23 - 11, index * 11 % 29 - 14, index * 13 % 31 - 15, index * 17 % 37 - 18, index * 19 % 41 - 20];
    return { row: index + 1, predictors, outcome: 4 + predictors.reduce((sum, value, column) => sum + value * (column + 1) / 10, 0) };
  });
  const split = splitModelCases(large, 12345), fit = fitLinearModel(split.training), holdout = evaluateLinearModel(fit, split.holdout);
  expect(split.training).toHaveLength(20000); expect(split.holdout).toHaveLength(5000);
  expect(fit.intercept).toBeCloseTo(4, 10); fit.coefficients.forEach((value, column) => expect(value).toBeCloseTo((column + 1) / 10, 10));
  expect(holdout.rmse).toBeLessThan(1e-10);
  expect(() => splitModelCases([...large, { ...large[0], row: 25001 }], 12345)).toThrow("25,000");
});

it("matches an independent original-unit NumPy SVD fit, split, metrics and VIF", () => {
  const original = structuredClone(cases), split = splitModelCases(cases, reference.seed);
  expect(split.training.map(row => row.row)).toEqual(reference.trainingRows); expect(split.holdout.map(row => row.row)).toEqual(reference.holdoutRows);
  const fit = fitLinearModel(split.training);
  expect(fit.intercept).toBeCloseTo(reference.intercept, 10);
  fit.coefficients.forEach((value, index) => expect(value).toBeCloseTo(reference.coefficients[index], 10));
  fit.standardizedCoefficients.forEach((value, index) => expect(value).toBeCloseTo(reference.standardizedCoefficients[index], 10));
  fit.vif.forEach((value, index) => expect(value).toBeCloseTo(reference.vif[index], 10));
  for (const [rows, expected, training] of [[split.training, reference.training, true], [split.holdout, reference.holdout, false]] as const) {
    const actual = evaluateLinearModel(fit, rows, training);
    for (const key of ["rmse", "mae", "baselineRmse", "rSquared", "residualMean"] as const) expect(actual[key]).toBeCloseTo(expected[key], 10);
    if (training) expect(actual.adjustedRSquared).toBeCloseTo(reference.training.adjustedRSquared!, 10); else expect(actual.adjustedRSquared).toBeNull();
  }
  expect(cases).toEqual(original);
});
it("matches the generated NIST Wampler1 polynomial reference within stated binary64 tolerances", () => {
  // NIST StRD Wampler1: generated21rows, coefficientsB0..B5=1, R²=1.
  // https://www.itl.nist.gov/div898/strd/lls/data/Wampler1.shtml
  const data = Array.from({ length: 21 }, (_, x) => ({ row: x + 1, predictors: Array.from({ length: 5 }, (_, power) => x ** (power + 1)), outcome: Array.from({ length: 6 }, (_, power) => x ** power).reduce((a, b) => a + b, 0) }));
  const fit = fitLinearModel(data), metrics = evaluateLinearModel(fit, data, true);
  expect(fit.intercept).toBeCloseTo(1, 6); fit.coefficients.forEach(value => expect(value).toBeCloseTo(1, 6));
  expect(metrics.rSquared).toBeCloseTo(1, 14); expect(metrics.rmse).toBeLessThan(1e-7);
});
it("recovers exact multivariable associations and centered predictions", () => {
  const data = cases.map(row => ({ ...row, outcome: 3 + 2 * row.predictors[0] - 0.5 * row.predictors[1] }));
  const fit = fitLinearModel(data);
  expect(fit.intercept).toBeCloseTo(3, 12); expect(fit.coefficients[0]).toBeCloseTo(2, 12); expect(fit.coefficients[1]).toBeCloseTo(-0.5, 12);
  data.forEach(row => expect(predictLinearModel(fit, row.predictors)).toBeCloseTo(row.outcome, 11));
  const metrics = evaluateLinearModel(fit, data, true);
  expect(metrics.rSquared).toBeCloseTo(1, 14); expect(metrics.diagnostics.reduce((sum, row) => sum + row.leverage!, 0)).toBeCloseTo(3, 10);
});
it("preserves predictions under unit rescaling, predictor permutation and outcome offset", () => {
  const fit = fitLinearModel(cases), changed = cases.map(row => ({ ...row, outcome: row.outcome + 1e6, predictors: [row.predictors[1] * 1e6, row.predictors[0] * 1e-6] }));
  const other = fitLinearModel(changed);
  expect(other.coefficients[0] * 1e6).toBeCloseTo(fit.coefficients[1], 7); expect(other.coefficients[1] * 1e-6).toBeCloseTo(fit.coefficients[0], 7);
  changed.forEach((row, index) => expect(predictLinearModel(other, row.predictors) - 1e6).toBeCloseTo(predictLinearModel(fit, cases[index].predictors), 7));
});
it.each(["constant predictor", "constant outcome", "collinear", "near collinear", "duplicate rows", "invalid", "too large", "unequal columns", "too few", "too many predictors"])("refuses unsupported %s inputs without changing them", kind => {
  let data = structuredClone(cases);
  if (kind === "constant predictor") data.forEach(row => { row.predictors[0] = 1; });
  if (kind === "constant outcome") data.forEach(row => { row.outcome = 1; });
  if (kind === "collinear") data.forEach(row => { row.predictors[1] = 2 * row.predictors[0]; });
  if (kind === "near collinear") data.forEach(row => { row.predictors[1] = row.predictors[0] + row.predictors[1] * 1e-12; });
  if (kind === "duplicate rows") data[1].row = data[0].row;
  if (kind === "invalid") data[0].outcome = NaN;
  if (kind === "too large") data[0].outcome = 1e13;
  if (kind === "unequal columns") data[0].predictors.pop();
  if (kind === "too few") data = data.slice(0, 3);
  if (kind === "too many predictors") data.forEach(row => { row.predictors = Array(7).fill(row.predictors[0]); });
  const original = structuredClone(data); expect(() => fitLinearModel(data)).toThrow(); expect(data).toEqual(original);
});
it("reports held-out failure and undefined constant-outcome R² without clamping to a good score", () => {
  const fit = fitLinearModel(cases);
  const reversed = cases.slice(0, 20).map(row => ({ ...row, outcome: -100 * row.outcome }));
  expect(evaluateLinearModel(fit, reversed).rSquared).toBeLessThan(0);
  const constant = reversed.map(row => ({ ...row, outcome: 5 }));
  expect(evaluateLinearModel(fit, constant).rSquared).toBeNull(); expect(evaluateLinearModel(fit, constant).baselineRmse).toBeGreaterThan(0);
});
it("is reproducible by seed and never shares a row between training and holdout", () => {
  const a = splitModelCases(cases, 42), b = splitModelCases(cases, 42), c = splitModelCases(cases, 43);
  expect(a).toEqual(b); expect(a.holdout).not.toEqual(c.holdout); expect(new Set([...a.training, ...a.holdout].map(row => row.row)).size).toBe(cases.length);
  expect(a.training.some(row => a.holdout.some(other => other.row === row.row))).toBe(false);
});
it.each([0, -1, 0.5, 4294967296, NaN])("refuses invalid split seed %s", seed => expect(() => splitModelCases(cases, seed)).toThrow());
it("does not label out-of-training-range cases as training leverage", () => {
  const fit = fitLinearModel(cases), metrics = evaluateLinearModel(fit, [{ row: 999, outcome: 10, predictors: [100, 200] }]);
  expect(metrics.diagnostics[0]).toMatchObject({ leverage: null, outsideTrainingRange: true });
});
