import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { buildExportPackageConfirmationView } from '../builder/builderPublishModel';
import { downloadDashboardExportSpec } from '../builder/builderExportPackage';
import { checkExport, exportProgress, type ExportStage } from './exportControl';
import type { CoreExportTarget } from './coreDocumentExports';
import type { DashboardDraft, DashboardPage } from '../../../shared/types/dashboard';

export type ExportJobView = { target: CoreExportTarget; reportTitle: string; phase: 'running' | 'canceling' | 'complete' | 'canceled' | 'error'; progress: ExportStage; message?: string };
type ActiveJob = { controller: AbortController; scope: string };
let activeJob: ActiveJob | null = null;
let activeView: ExportJobView | null = null;
const listeners = new Set<() => void>();
function publishActive(view: ExportJobView | null) { activeView = view; listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function cancelActive() { if (!activeJob) return; activeJob.controller.abort(); if (activeView?.phase === 'running') publishActive({ ...activeView, phase: 'canceling' }); }
export function useExportJob(dashboard: DashboardDraft, pages: DashboardPage[], scope: { reportId: string; viewer: boolean; isCurrent: () => boolean }) {
  const owner = useRef<{ controller: AbortController; scope: string } | null>(null), mounted = useRef(true);
  const [view, setView] = useState<ExportJobView | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const sharedView = useSyncExternalStore(subscribe, () => activeView, () => null);
  const viewScope = useRef('');
  const scopeKey = JSON.stringify([scope.reportId, scope.viewer]);
  const latest = useRef(scopeKey); latest.current = scopeKey;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (owner.current === activeJob) cancelActive(); }; }, []);
  useEffect(() => { if (owner.current && owner.current.scope !== scopeKey) { cancelActive(); setView(current => current?.phase === 'running' ? { ...current, phase: 'canceling' } : current); } else if (!owner.current) setView(null); }, [scopeKey]);
  function cancel() { cancelActive(); if (mounted.current) setView(current => current?.phase === 'running' ? { ...current, phase: 'canceling' } : current); }
  function dismiss(expected: ExportJobView) {
    if (activeJob || viewRef.current !== expected || !['complete', 'canceled', 'error'].includes(expected.phase)) return false;
    viewRef.current = null;
    setView(current => current === expected ? null : current);
    return true;
  }
  async function start(target: CoreExportTarget) {
    if (activeJob) return;
    const controller = new AbortController(), job = { controller, scope: scopeKey }; owner.current = job; activeJob = job;
    let snapshot: { dashboard: DashboardDraft; pages: DashboardPage[] };
    try { snapshot = structuredClone({ dashboard, pages }); }
    catch (error) { owner.current = null; if (activeJob === job) activeJob = null; viewScope.current = scopeKey; if (mounted.current) setView({ target, reportTitle: dashboard.title, phase: 'error', progress: { stage:'preparing' }, message: error instanceof Error ? error.message : 'The report snapshot could not be captured.' }); return; }
    viewScope.current = scopeKey;
    const initial: ExportJobView = { target, reportTitle: snapshot.dashboard.title, phase: 'running', progress: { stage:'preparing' } }; setView(initial); publishActive(initial);
    const current = () => { if (owner.current !== job || latest.current !== job.scope || !scope.isCurrent()) throw new DOMException('Export context changed.', 'AbortError'); };
    const control = { signal: controller.signal, assertCurrent: current, onProgress: (progress: ExportStage) => { if (activeJob === job && activeView?.phase === 'running') publishActive({ ...activeView, progress }); if (mounted.current && owner.current === job) setView(currentView => currentView?.phase === 'running' ? { ...currentView, progress } : currentView); } };
    try {
      const confirmation = buildExportPackageConfirmationView(snapshot.dashboard, undefined, target);
      await new Promise<void>(resolve => setTimeout(resolve, 0)); checkExport(control);
      if (target === 'json') { exportProgress(control, { stage:'packaging' }); checkExport(control); downloadDashboardExportSpec(snapshot.dashboard, snapshot.pages); }
      else { const { exportCoreDocument } = await import('./coreDocumentExports'); checkExport(control); await exportCoreDocument(snapshot.dashboard, snapshot.pages, target, control); }
      checkExport(control); if (mounted.current && owner.current === job) setView({ ...initial, phase:'complete', progress:{stage:'download'}, message:`${confirmation.label.replace('downloaded', 'download initiated')}. ${confirmation.helper} Check your browser downloads.` });
    } catch (error) {
      if (mounted.current && owner.current === job && latest.current === job.scope) setView({ ...initial, phase: controller.signal.aborted || error instanceof DOMException && error.name === 'AbortError' ? 'canceled' : 'error', message: error instanceof Error ? error.message : 'Export failed.' });
    } finally { if (owner.current === job) { owner.current = null; if (activeJob === job) { activeJob = null; publishActive(null); } if (mounted.current && latest.current !== job.scope) setView(null); } }
  }
  const visibleView = viewScope.current === scopeKey ? view : view && owner.current && (view.phase === 'running' || view.phase === 'canceling') ? { ...view, phase: 'canceling' as const } : null;
  return { view: sharedView ?? visibleView, start, cancel, dismiss, invalidate: cancel };
}
