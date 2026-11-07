// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import App from '../../../App';
import { excelFindingFixture } from './excelFindingFixture';
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace } from '../../document/workspacePersistence';
import { workspaceSaveSession } from '../../document/workspaceSaveSession';
async function until(check: () => boolean) {
  for (let i = 0; i < 500 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
  expect(check(), document.body.textContent?.slice(-1000)).toBe(true);
}
it('actual App navigates an advisory, protects canvas keys and reopens its unchanged report and study', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal('fetch', vi.fn());
  const f = await excelFindingFixture(); localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }))).toBe(true);
  const original = structuredClone(loadDashboardWorkspace()), host = document.createElement('div'); document.body.append(host);
  window.history.replaceState(null, '', `/#/reports/${f.draft.id}`); let root = createRoot(host);
  const button = (label: string) => Array.from(document.querySelectorAll('button')).find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)!;
  try {
    await act(async () => root.render(<App />)); await until(() => !!document.querySelector('details.export-menu'));
    await act(async () => document.querySelector('details.export-menu')!.setAttribute('open', ''));
    await act(async () => button('Review before exporting').click()); await until(() => !!document.querySelector('[role="dialog"]'));
    await act(async () => button('Check Excel workbook').click()); await until(() => !!document.querySelector('[aria-label="Checked Excel plan"]'));
    const finding = button(`Inspect affected cell ${f.sheetName}, ${f.address}`); expect(finding).toBeDefined(); finding.focus();
    await act(async () => finding.click());
    const inspector = document.querySelector<HTMLElement>('[aria-label="Planned cell inspector"]')!;
    expect(document.activeElement).toBe(inspector); expect(inspector.querySelector('textarea')!.value).toBe(String(f.value));
    for (const key of ['Delete', 'Backspace', 'ArrowRight']) await act(async () => inspector.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
    await act(async () => button('Return to worksheet cell').click()); expect(document.activeElement).toBe(button(`Inspect planned cell ${f.address}`));
    expect(loadDashboardWorkspace().reports.map(record => record.draft)).toEqual(original.reports.map(record => record.draft));
    expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets); expect(workspaceSaveSession.hasPending()).toBe(false);
    await act(async () => button('Close review').click()); await act(async () => root.unmount()); workspaceSaveSession.remember(null);
    root = createRoot(host); await act(async () => root.render(<App />)); await until(() => !!document.querySelector('details.export-menu'));
    expect(document.querySelector('[aria-label="Checked Excel plan"]')).toBeNull();
    expect(loadDashboardWorkspace().reports.map(record => record.draft)).toEqual(original.reports.map(record => record.draft));
    expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets); expect(fetch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); }
}, 45_000);
