// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ExcelWorkbookReview } from '../ExcelWorkbookReview';
import * as model from '../excelPreflightModel';
import { excelFindingFixture } from './excelFindingFixture';
async function exercise(mode: 'navigate' | 'outside' | 'blur' | 'unfocused' | 'stale' | 'invalid') {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', vi.fn());
  const f = await excelFindingFixture(), before = JSON.stringify(f.draft);
  if (mode === 'invalid') {
    const original = model.checkExcelPreflight;
    vi.spyOn(model, 'checkExcelPreflight').mockImplementation(async (...args) => {
      const result = await original(...args); const issue = result.issues.find(issue => issue.address === f.address && issue.cell?.sheetIndex === 1)!;
      issue.cell = { ...issue.cell!, row: -1 }; return result;
    });
  }
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const button = (label: string) => Array.from(host.querySelectorAll('button')).find(node => node.textContent === label || node.getAttribute('aria-label') === label)!;
  try {
    await act(async () => root.render(<><button>Other action</button><ExcelWorkbookReview dashboard={f.draft} /></>));
    await act(async () => button('Check Excel workbook').click());
    for (let i = 0; i < 300 && !host.querySelector('[aria-label="Checked Excel plan"]'); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
    const action = button(`Inspect affected cell ${f.sheetName}, ${f.address}`); expect(action).toBeDefined(); action.focus();
    if (mode === 'unfocused') button('Other action').focus();
    if (mode === 'stale') f.draft.title += ' changed before click';
    await act(async () => { action.click(); if (mode === 'outside') button('Other action').focus(); if (mode === 'blur') action.blur(); });
    if (mode === 'stale') {
      expect(host.querySelector('[aria-label="Checked Excel plan"]')).toBeNull(); expect(host.textContent).toContain('The report changed');
    } else if (mode === 'invalid') {
      expect(host.textContent).toContain('no current cell location'); expect(host.querySelector('[aria-label="Planned cell inspector"] textarea')).toBeNull();
    } else {
      const inspector = host.querySelector<HTMLElement>('[aria-label="Planned cell inspector"]')!;
      expect(inspector.querySelector('textarea')!.value).toBe(String(f.value)); expect(inspector.textContent).toContain(f.address);
      expect(host.querySelector<HTMLSelectElement>('select')!.value).toBe('1');
      const cell = button(`Inspect planned cell ${f.address}`); expect(cell).toBeDefined();
      expect(host.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(25); expect(host.querySelectorAll('thead th').length).toBeLessThanOrEqual(9);
      expect(document.activeElement).toBe(mode === 'navigate' ? inspector : mode === 'outside' || mode === 'unfocused' ? button('Other action') : document.body);
      if (mode === 'navigate') { await act(async () => button('Return to worksheet cell').click()); expect(document.activeElement).toBe(cell); }
    }
    expect(fetch).not.toHaveBeenCalled();
    const expected = JSON.parse(before); if (mode === 'stale') expected.title += ' changed before click';
    expect(JSON.stringify(f.draft)).toBe(JSON.stringify(expected));
  } finally { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
}
it.each(['navigate', 'outside', 'blur', 'unfocused', 'stale', 'invalid'] as const)('navigates a real off-window finding safely: %s', async mode => exercise(mode));
