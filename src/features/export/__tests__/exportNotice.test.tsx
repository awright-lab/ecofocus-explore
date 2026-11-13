// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ExportJobStatus } from '../../builder/components/BuilderChrome';
import type { ExportJobView } from '../useExportJob';

it('offers a keyboard-focusable dismiss action only for terminal notices and restores focus', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const dismiss = vi.fn(() => true), cancel = vi.fn();
  const job: ExportJobView = { target: 'pdf', reportTitle: 'Synthetic', phase: 'running', progress: { stage: 'preparing' } };
  const render = (view: ExportJobView) => <><details className="export-menu"><summary>Export</summary></details><ExportJobStatus exportJob={view} onCancelExport={cancel} onDismissExport={dismiss} /></>;
  await act(async () => root.render(render(job)));
  expect(host.querySelector('[aria-label="Dismiss export notice"]')).toBeNull();
  expect(host.textContent).toContain('Cancel export');
  await act(async () => root.render(render({ ...job, phase: 'canceling' })));
  expect(host.querySelector('[aria-label="Dismiss export notice"]')).toBeNull();
  for (const phase of ['complete', 'canceled', 'error'] as const) {
    await act(async () => root.render(render({ ...job, phase, message: 'Synthetic result' })));
    const status = host.querySelector('.export-job-status')!;
    expect(status.getAttribute('role')).toBe(phase === 'error' ? 'alert' : 'status');
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Dismiss export notice"]')!;
    button.focus(); expect(document.activeElement).toBe(button);
    await act(async () => button.click());
    expect(document.activeElement).toBe(host.querySelector('summary'));
  }
  expect(dismiss).toHaveBeenCalledTimes(3);
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});
