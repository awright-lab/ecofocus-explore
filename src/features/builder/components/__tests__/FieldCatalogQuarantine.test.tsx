// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { DataExplorerPanel } from '../DataExplorerPanel';
import type { AnalysisAuthoringPanelProps } from '../AnalysisAuthoringPanel';
import { importDatasetBuffer } from '../../../data/datasetImportModel';
import { listImportedDatasetFieldsFromNetlify, type NetlifyDatasetFieldListResult } from '../../../data/netlifyDatasetStore';
vi.mock('../../../data/netlifyDatasetStore', () => ({ listImportedDatasetFieldsFromNetlify: vi.fn() }));
it('quarantines old selected details during fresh retry, failure and replacement without the old ID', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Answer\nYes\nNo\n').buffer, 'synthetic-catalog.csv');
  const dataset = { ...parsed.dataset!, fieldCount: 240, rows: [], remote: { provider: 'netlify' as const, projectUrl: '', bucket: '', objectPath: 'synthetic.csv', uploadedAt: '2026-11-07T00:00:00Z' } };
  dataset.fields[0] = { ...dataset.fields[0], id: 'old0', label: 'Cached stale field' };
  const before = JSON.stringify(dataset), open = vi.fn();
  const props = { leftPanelView: 'data', sourceSearch: '', setSourceSearch: () => {}, importedDatasets: [dataset], liveDatasetSources: [], filteredQuestions: [], savedFilters: [], savedSegmentProfiles: [], savedBanners: [], openGuidedDataQuery: open, removeImportedDataset: () => null } as unknown as AnalysisAuthoringPanelProps;
  const pending: Array<{ offset: number; resolve: (page: NetlifyDatasetFieldListResult) => void; reject: (error: Error) => void }> = [];
  vi.mocked(listImportedDatasetFieldsFromNetlify).mockImplementation(args => new Promise((resolve, reject) => pending.push({ offset: args.offset, resolve, reject })));
  const page = (offset: number, prefix = 'old', total = 240): NetlifyDatasetFieldListResult => ({ datasetId: dataset.id, total, offset, limit: 120, fields: Array.from({ length: 120 }, (_, i) => ({ ...dataset.fields[0], id: `${prefix}${offset + i}`, sourceColumn: `${prefix} column ${offset + i}`, label: `${prefix} field ${offset + i}`, type: 'text', modelingRole: 'raw_variable' })) });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const detail = () => host.querySelector('.variable-tree-detail-card');
  const button = (text: string) => Array.from(host.querySelectorAll('button')).find(n => n.textContent?.trim() === text)!;
  try {
    await act(async () => root.render(<DataExplorerPanel {...props} />));
    expect(detail()).toBeNull();
    // A generic create action must not pass cached remote field metadata.
    await act(async () => button('Create analysis').click());
    expect(open).toHaveBeenLastCalledWith({ outputMode: 'table' });
    await act(async () => button('Browse fields, filters, segments, and banners').click());
    expect(pending).toHaveLength(1);
    await act(async () => pending[0].resolve(page(0)));
    expect(detail()?.textContent).toContain('old field 0');
    const selected = Array.from(host.querySelectorAll<HTMLButtonElement>('.variable-tree-row__select')).find(node => node.querySelector('strong')?.textContent === 'old field 5')!;
    expect(selected).toBeDefined();
    await act(async () => selected.click());
    expect(detail()?.textContent).toContain('old field 5');
    await act(async () => {
      const viewport = host.querySelector('.variable-tree-viewport') as HTMLElement;
      viewport.scrollTop = 3360; viewport.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    // The viewport applies scroll with requestAnimationFrame.
    await act(async () => new Promise(resolve => setTimeout(resolve, 40)));
    expect(pending.some(p => p.offset === 120)).toBe(true);
    await act(async () => pending.find(p => p.offset === 120)!.resolve(page(120, 'old', 241)));
    expect(detail()).toBeNull();
    await act(async () => button('Retry loading fields').click());
    expect(detail()).toBeNull();
    const failed = pending.slice(2); expect(failed.length).toBeGreaterThan(0);
    await act(async () => failed.forEach(p => p.reject(new Error('Fresh catalog unavailable'))));
    expect(detail()).toBeNull(); expect(host.textContent).toContain('Fresh catalog unavailable');
    const start = pending.length;
    await act(async () => button('Retry loading fields').click());
    expect(detail()).toBeNull();
    await act(async () => pending.slice(start).forEach(p => p.resolve(page(p.offset, 'fresh'))));
    expect(detail()?.textContent).toContain('fresh field');
    expect(detail()?.textContent).not.toContain('Cached stale field');
    expect(detail()?.textContent).not.toContain('old field');
    expect(JSON.stringify(dataset)).toBe(before);
  } finally { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); }
});
