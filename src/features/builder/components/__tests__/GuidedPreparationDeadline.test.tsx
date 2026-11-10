// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { GuidedDataQueryModal } from '../GuidedDataQueryModal';
import { guidedPreviewFixture } from '../../../data/__tests__/guidedPreviewFixture';
import { ControlledPreviewWorker, guidedBackgroundProps } from './guidedBackgroundFixture';
it('recovers the real dialog from preparation timeout, preserves focus/source and accepts a fresh retry', async () => {
  const f = await guidedPreviewFixture(8000), before = JSON.stringify(f.dataset), create = vi.fn(async () => null);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('Worker', ControlledPreviewWorker); vi.stubGlobal('fetch', vi.fn());
  ControlledPreviewWorker.instances = [];
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const button = (text: string) => Array.from(document.querySelectorAll('button')).find(n => n.textContent?.trim() === text)!;
  try {
    await act(async () => root.render(<GuidedDataQueryModal props={guidedBackgroundProps(f.dataset, { addTileFromImportedDatasetField: create })} onClose={() => {}} />));
    const action = button('Calculate preview in background'); action.focus();
    vi.useFakeTimers(); const schedule = globalThis.setTimeout;
    const slow = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number, ...args: unknown[]) => schedule(callback, delay === 0 ? 1000 : delay, ...args)) as typeof setTimeout);
    await act(async () => action.click()); expect(button('Create table').disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(document.querySelector('[aria-label="Analysis result preview"]')?.textContent).toMatch(/Preparing.*30 seconds/);
    expect(ControlledPreviewWorker.instances).toHaveLength(0); expect(button('Create table').disabled).toBe(false);
    expect(document.activeElement).toBe(action); expect(action.textContent).toBe('Calculate preview in background');
    expect(create).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(f.dataset)).toBe(before);
    slow.mockRestore(); await act(async () => action.click()); await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(ControlledPreviewWorker.instances).toHaveLength(1); await act(async () => ControlledPreviewWorker.instances[0].complete());
    expect(document.querySelector('[aria-label="Analysis result preview"] table')).not.toBeNull();
    expect(document.activeElement).toBe(action); expect(action.textContent).toBe('Recalculate preview in background');
    expect(create).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(f.dataset)).toBe(before);
  } finally { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
