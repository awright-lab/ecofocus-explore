// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../App';
import { createPublishedSnapshot, createReportRecord, makeBuilderReportPath, makePublishedViewerPath, normalizeDashboardWorkspace, parseWorkspaceRoute, saveDashboardWorkspace, workspaceStorageKey } from '../workspacePersistence';
import { initialDashboard } from '../documentSeeds';
import { workspaceSaveSession } from '../workspaceSaveSession';
const mounted = vi.hoisted(() => vi.fn());
vi.mock('../../builder/BuilderApp', () => ({ default: () => { mounted(); return <main>Selected report editor</main>; } }));
vi.mock('../../workspace/WorkspaceHome', () => ({ WorkspaceHome: () => <main>Report library</main> }));

describe('unavailable workspace links', () => {
  let root: Root, host: HTMLDivElement, saved: string;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); mounted.mockClear(); localStorage.clear();
    workspaceSaveSession.remember(null);
    const report = createReportRecord(structuredClone(initialDashboard));
    const workspace = normalizeDashboardWorkspace({ reports: [report], activeReportId: report.id, importedDatasets: [] });
    const published = createPublishedSnapshot(workspace, report.draft);
    expect(saveDashboardWorkspace(published.workspace)).toBe(true);
    saved = localStorage.getItem(workspaceStorageKey)!;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '#/'); });
  async function open(hash: string) {
    window.history.replaceState(null, '', hash);
    await act(async () => { root.render(<App />); });
  }
  it.each(['#/reports/not_here', '#/published/not_here/missing', `#/published/${initialDashboard.id}/missing`])('does not substitute another draft for %s', async hash => {
    await open(hash);
    expect(host.textContent).toContain('unavailable'); expect(host.querySelector('a[href="#/"]')).toBeTruthy();
    expect(mounted).not.toHaveBeenCalled(); expect(localStorage.getItem(workspaceStorageKey)).toBe(saved);
  });
  it('survives a malformed encoded link without changing stored data', async () => {
    await open('#/reports/%E0%A4%A'); expect(host.textContent).toContain('unavailable');
    expect(mounted).not.toHaveBeenCalled(); expect(localStorage.getItem(workspaceStorageKey)).toBe(saved);
  });
  it('returns to the library and opens an existing report after an unavailable link', async () => {
    await open('#/reports/not_here');
    await act(async () => { window.history.replaceState(null, '', '#/'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(host.textContent).toContain('Report library');
    await act(async () => { window.history.replaceState(null, '', makeBuilderReportPath(initialDashboard.id)); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(host.textContent).toContain('Selected report editor');
  });
  it('round trips reserved and Unicode identifiers exactly once', () => {
    const id = 'report /?#%\u96ea', snapshot = 'snapshot/%2F?';
    expect(parseWorkspaceRoute(makeBuilderReportPath(id))).toMatchObject({ mode: 'builder', reportId: id });
    expect(parseWorkspaceRoute(makePublishedViewerPath(id, snapshot))).toEqual({ mode: 'published', reportId: id, snapshotId: snapshot });
  });
  it.each(['#/reports//internal_mvp', '#/published/internal_mvp//snapshot', '#//reports/internal_mvp', '#/reports/internal_mvp//', '#/unknown', '#/published/internal_mvp'])('rejects malformed path %s', hash => {
    expect(parseWorkspaceRoute(hash)).toEqual({ mode: 'invalid', reportId: null });
  });
  it('retains the active-report alias and one conventional trailing slash', () => {
    expect(parseWorkspaceRoute('#/reports/')).toEqual({ mode: 'builder', reportId: null });
    expect(parseWorkspaceRoute('#/reports/internal_mvp/')).toEqual({ mode: 'builder', reportId: initialDashboard.id });
  });
});
