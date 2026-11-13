import { useEffect, useRef, useState } from 'react';
import { buildExportPackageConfirmationView } from '../builder/builderPublishModel';
import { downloadDashboardExportSpec } from '../builder/builderExportPackage';
import { checkExport, exportProgress, type ExportStage } from './exportControl';
import type { CoreExportTarget } from './coreDocumentExports';
import type { DashboardDraft, DashboardPage } from '../../../shared/types/dashboard';

export type ExportJobView = { target: CoreExportTarget; reportTitle: string; phase: 'running' | 'canceling' | 'complete' | 'canceled' | 'error'; progress: ExportStage; message?: string };
export function useExportJob(dashboard: DashboardDraft, pages: DashboardPage[], scope: { reportId: string; viewer: boolean; isCurrent: () => boolean }) {
  const owner = useRef<{ controller: AbortController; scope: string } | null>(null), mounted = useRef(true);
  const [view, setView] = useState<ExportJobView | null>(null);
  const viewScope = useRef('');
  const scopeKey = JSON.stringify([scope.reportId, scope.viewer]);
  const latest = useRef(scopeKey); latest.current = scopeKey;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; owner.current?.controller.abort(); }; }, []);
  useEffect(() => { if (owner.current && owner.current.scope !== scopeKey) owner.current.controller.abort(); setView(null); }, [scopeKey]);
  function cancel() { const job = owner.current; if (!job) return; job.controller.abort(); if (mounted.current) setView(current => current?.phase === 'running' ? { ...current, phase: 'canceling' } : current); }
  async function start(target: CoreExportTarget) {
    if (owner.current) return;
    const controller = new AbortController(), job = { controller, scope: scopeKey }; owner.current = job;
    let snapshot: { dashboard: DashboardDraft; pages: DashboardPage[] };
    try { snapshot = structuredClone({ dashboard, pages }); }
    catch (error) { owner.current = null; viewScope.current = scopeKey; if (mounted.current) setView({ target, reportTitle: dashboard.title, phase: 'error', progress: { stage:'preparing' }, message: error instanceof Error ? error.message : 'The report snapshot could not be captured.' }); return; }
    viewScope.current = scopeKey;
    const initial: ExportJobView = { target, reportTitle: snapshot.dashboard.title, phase: 'running', progress: { stage:'preparing' } }; setView(initial);
    const current = () => { if (owner.current !== job || latest.current !== job.scope || !scope.isCurrent()) throw new DOMException('Export context changed.', 'AbortError'); };
    const control = { signal: controller.signal, assertCurrent: current, onProgress: (progress: ExportStage) => { if (mounted.current && owner.current === job) setView(currentView => currentView?.phase === 'running' ? { ...currentView, progress } : currentView); } };
    try {
      const confirmation = buildExportPackageConfirmationView(snapshot.dashboard, undefined, target);
      await new Promise<void>(resolve => setTimeout(resolve, 0)); checkExport(control);
      if (target === 'json') { exportProgress(control, { stage:'packaging' }); checkExport(control); downloadDashboardExportSpec(snapshot.dashboard, snapshot.pages); }
      else { const { exportCoreDocument } = await import('./coreDocumentExports'); checkExport(control); await exportCoreDocument(snapshot.dashboard, snapshot.pages, target, control); }
      checkExport(control); if (mounted.current && owner.current === job) setView({ ...initial, phase:'complete', progress:{stage:'download'}, message:`${confirmation.label.replace('downloaded', 'download initiated')}. ${confirmation.helper} Check your browser downloads.` });
    } catch (error) {
      if (mounted.current && owner.current === job && latest.current === job.scope) setView({ ...initial, phase: controller.signal.aborted || error instanceof DOMException && error.name === 'AbortError' ? 'canceled' : 'error', message: error instanceof Error ? error.message : 'Export failed.' });
    } finally { if (owner.current === job) owner.current = null; }
  }
  return { view: viewScope.current === scopeKey ? view : null, start, cancel, invalidate: cancel };
}
