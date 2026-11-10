// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useImportedFieldPages } from '../useImportedFieldPages';
import { listImportedDatasetFieldsFromNetlify, type NetlifyDatasetFieldListResult } from '../../../data/netlifyDatasetStore';
vi.mock('../../../data/netlifyDatasetStore', () => ({ listImportedDatasetFieldsFromNetlify: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
function page(offset: number, total = 6): NetlifyDatasetFieldListResult {
  return { datasetId: 'study', total, offset, limit: 2, fields: Array.from({ length: 2 }, (_, i) => ({
    id: `id${offset + i}`, sourceColumn: `column${offset + i}`, label: `Label ${offset + i}`,
    type: 'categorical', modelingRole: 'candidate_dimension', sampleValues: ['Yes'], nonEmptyCount: 1,
    distinctCount: 1, eligibleForFilter: true, eligibleForSegment: true, eligibleForBanner: true,
  })) };
}
for (const conflict of ['total', 'id', 'column'] as const) {
  for (const reverse of [false, true]) {
    it(`rejects ${conflict} conflicts in ${reverse ? 'reverse' : 'forward'} arrival order and isolates retry`, async () => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
      const pending: Array<{ offset: number; resolve: (value: NetlifyDatasetFieldListResult) => void }> = [];
      vi.mocked(listImportedDatasetFieldsFromNetlify).mockImplementation(args => new Promise(resolve => pending.push({ offset: args.offset, resolve })));
      let state!: ReturnType<typeof useImportedFieldPages>;
      function Harness() { state = useImportedFieldPages('study', '', 2); return <div>{state.error}</div>; }
      const first = page(0), second = page(2);
      if (conflict === 'total') second.total = 8;
      if (conflict === 'id') second.fields[0].id = first.fields[0].id;
      if (conflict === 'column') second.fields[0].sourceColumn = first.fields[0].sourceColumn;
      const unchanged = JSON.stringify([first, second]);
      try {
        await act(async () => root.render(<Harness />));
        await act(async () => state.load(0, 6));
        const order = reverse ? [1, 0] : [0, 1];
        await act(async () => pending[order[0]].resolve(order[0] === 0 ? first : second));
        expect(Object.keys(state.pages)).toHaveLength(1);
        await act(async () => pending[order[1]].resolve(order[1] === 0 ? first : second));
        expect(state.catalogInvalid).toBe(true); expect(state.pages).toEqual({}); expect(state.total).toBeNull();
        expect(state.error).toMatch(/catalog changed/);
        await act(async () => state.load(0, 6)); expect(pending).toHaveLength(3);
        await act(async () => state.retry()); expect(pending).toHaveLength(6);
        expect(state.catalogInvalid).toBe(true);
        // The old third response must not enter the fresh catalog, even after retry.
        await act(async () => pending[2].resolve(page(4, 99))); expect(state.pages).toEqual({});
        for (let i = 3; i < 6; i++) await act(async () => pending[i].resolve(page(pending[i].offset)));
        expect(state.total).toBe(6); expect(Object.keys(state.pages)).toHaveLength(3); expect(state.error).toBeNull();
        expect(JSON.stringify([first, second])).toBe(unchanged);
      } finally { await act(async () => root.unmount()); host.remove(); }
    });
  }
}
it('ignores previous-search responses and preserves a consistent out-of-order catalog', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const pending: Array<(value: NetlifyDatasetFieldListResult) => void> = [];
  vi.mocked(listImportedDatasetFieldsFromNetlify).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  let state!: ReturnType<typeof useImportedFieldPages>;
  function Harness({ search }: { search: string }) { state = useImportedFieldPages('study', search, 2); return null; }
  try {
    await act(async () => root.render(<Harness search="old" />)); await act(async () => state.load(0, 2));
    await act(async () => root.render(<Harness search="new" />)); await act(async () => state.load(0, 4));
    await act(async () => pending[2](page(2))); await act(async () => pending[0](page(0, 99)));
    await act(async () => pending[1](page(0)));
    expect(state.total).toBe(6); expect(state.catalogInvalid).toBe(false); expect(Object.keys(state.pages)).toHaveLength(2);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
