// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CategoricalFieldProfile } from '../CategoricalFieldProfile';
import { importDatasetBuffer } from '../../../data/datasetImportModel';
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(text = 'Answer,Record\nA,1\nA,2\nB,3\n,4\n') {
  const parsed = await importDatasetBuffer(new TextEncoder().encode(text).buffer, 'synthetic.csv'); const dataset = parsed.dataset!;
  await act(async () => root.render(<CategoricalFieldProfile dataset={dataset} field={dataset.fields[0]} />)); return dataset;
}
async function expand() { const details = host.querySelector('details')!; await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle', { bubbles: true })); }); }
it('keeps inspection optional and shows accessible counts with the correct denominator', async () => {
  const dataset = await render(), before = structuredClone(dataset);
  expect(host.querySelector('summary')?.textContent).toBe('Inspect response categories'); expect(host.querySelector('table')).toBeNull();
  await expand(); expect(host.textContent).toContain('3 nonblank responses');
  expect(host.querySelectorAll('tbody tr')).toHaveLength(2); expect(host.querySelector('tbody tr')?.textContent).toContain('66.7%');
  expect(host.querySelector('caption')?.textContent).toContain('Most common'); expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(3); expect(dataset).toEqual(before);
});
it('makes an all-blank profile explicitly unavailable for percentages', async () => {
  await render('Answer,Record\n,1\n,2\n'); await expand(); expect(host.querySelector('[role="status"]')?.textContent).toContain('Percentages are unavailable'); expect(host.querySelector('table')).toBeNull();
});
it('shows partial-data limitations instead of counting a remote preview', async () => {
  const dataset = await render(); dataset.rows = []; dataset.previewRows = dataset.previewRows.slice(0, 1);
  await act(async () => root.render(<CategoricalFieldProfile dataset={{ ...dataset }} field={dataset.fields[0]} />)); await expand();
  expect(host.textContent).toContain('partial preview'); expect(host.querySelector('table')).toBeNull();
});

it('recounts small same-reference category rows after they change',async()=>{
 const dataset=await render('Answer,Record\nA,1\nB,2\n');await expand();expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
 dataset.rows[0][dataset.fields[0].sourceColumn]='B';const before=structuredClone(dataset);await act(async()=>root.render(<CategoricalFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(host.querySelectorAll('tbody tr')).toHaveLength(1);expect(host.querySelector('tbody tr')?.textContent).toContain('B2100%');expect(dataset).toEqual(before);
});
it('updates small category labels when selected metadata changes in place',async()=>{
 const dataset=await render('Answer,Record\nA,1\nB,2\n');await expand();dataset.fields[0].valueLabels={A:'Alpha',B:'Beta'};const before=structuredClone(dataset);
 await act(async()=>root.render(<CategoricalFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(host.querySelector('tbody')?.textContent).toContain('Alpha');expect(host.querySelector('tbody')?.textContent).toContain('Beta');expect(dataset).toEqual(before);
});
