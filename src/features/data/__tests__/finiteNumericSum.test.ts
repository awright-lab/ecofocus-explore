import { describe, expect, it } from 'vitest';
import { FiniteNumericSum } from '../finiteNumericSum';
import { importDatasetBuffer } from '../datasetImportModel';
import { runImportedDatasetQuery } from '../importedDatasetAnalytics';
import { buildImportedNumericProfile } from '../importedNumericProfile';

function sum(values: number[]) {
  const accumulator = new FiniteNumericSum();
  for (const value of values) accumulator.add(value);
  return accumulator.value();
}
function permutations(values: number[]): number[][] {
  return values.length ? values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest])) : [[]];
}

describe('finite binary64 summation', () => {
  // Reference results independently obtained with Python math.fsum. These
  // include failures of a single compensation term and naive partial reduction.
  it.each([
    [[1e16, 1, -1e16], 1],
    [[1e16, 1, 1e-16, -1e16, -1], 1e-16],
    [[1e16, 1, 1e-16], 10000000000000002],
    [[-1e16, -1, -1e-16], -10000000000000002],
  ] as const)('retains cancellation and final rounding for every order of %j', (values, expected) => {
    for (const order of permutations([...values])) expect(sum(order)).toBe(expected);
  });
  it('retains repeated small observations and subnormals', () => {
    expect(sum([1, ...Array(10000).fill(1e-16), -1])).toBe(1e-12);
    expect(sum([Number.MIN_VALUE, Number.MIN_VALUE, -Number.MIN_VALUE])).toBe(Number.MIN_VALUE);
    expect(sum([])).toBe(0); expect(sum([-0, 0])).toBe(0);
  });
  it('does not collapse or mutate the accumulator when reading an intermediate value', () => {
    const accumulator = new FiniteNumericSum();
    accumulator.add(1e16); accumulator.add(1); expect(accumulator.value()).toBe(1e16);
    accumulator.add(-1e16); expect(accumulator.value()).toBe(1); expect(accumulator.value()).toBe(1);
  });
  it('makes invalid input and intermediate overflow sticky', () => {
    for (const values of [[1e308, 1e308, -1e308], [Infinity, 1], [NaN, 1]]) {
      expect(sum(values)).toBeNull();
    }
  });
  it.each(['sum', 'average'] as const)('uses accurate %s values per filtered cell and preserves raw data', async metric => {
    const parsed = await importDatasetBuffer(new TextEncoder().encode('Group,Amount,Banner,Keep\nA,1e16,X,yes\nA,1,X,yes\nA,-1e16,X,yes\nA,2,Y,yes\nA,invalid,Y,yes\nB,7,X,yes\nA,999,X,no\n').buffer, 'synthetic.csv');
    const dataset = parsed.dataset!;
    dataset.fields[1] = { ...dataset.fields[1], type: 'numeric', modelingRole: 'candidate_measure' };
    const before = structuredClone(dataset);
    const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], measureField: dataset.fields[1], bannerField: dataset.fields[2], filter: { field: dataset.fields[3], value: 'yes' }, metric, chartType: 'table' });
    const row = result.table.find(row => row.label === 'A')!;
    const x = result.columns.find(column => column.label === 'X')!.id;
    const y = result.columns.find(column => column.label === 'Y')!.id;
    expect(row.values[x]).toBe(metric === 'sum' ? 1 : 1 / 3); expect(row.bases[x]).toBe(3);
    expect(row.values[y]).toBe(2); expect(row.bases[y]).toBe(1);
    expect(dataset).toEqual(before);
  });
  it('uses the same improved total and mean for the profile', async () => {
    const parsed = await importDatasetBuffer(new TextEncoder().encode('Amount\n1e16\n1\n-1e16\n').buffer, 'synthetic.csv');
    const dataset = parsed.dataset!, before = structuredClone(dataset);
    expect(buildImportedNumericProfile(dataset, dataset.fields[0])).toMatchObject({ total: 1, mean: 1 / 3, valid: 3 });
    expect(dataset).toEqual(before);
  });
  it.each(['sum', 'average'] as const)('rejects an overflowing %s cell without changing the source', async metric => {
    const parsed = await importDatasetBuffer(new TextEncoder().encode('Group,Amount\nA,1e308\nA,1e308\nA,-1e308\n').buffer, 'synthetic.csv');
    const dataset = parsed.dataset!;
    dataset.fields[1] = { ...dataset.fields[1], type: 'numeric', modelingRole: 'candidate_measure' };
    const before = structuredClone(dataset);
    expect(() => runImportedDatasetQuery({ dataset, field: dataset.fields[0], measureField: dataset.fields[1], metric, chartType: 'table' })).toThrow('supported number range');
    expect(dataset).toEqual(before);
  });
});
