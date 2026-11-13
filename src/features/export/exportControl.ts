export type ExportStage = { stage: 'preparing' | 'rendering' | 'packaging' | 'download'; completed?: number; total?: number };
export interface ExportControl { signal?: AbortSignal; onProgress?: (progress: ExportStage) => void; assertCurrent?: () => void }
export function checkExport(control?: ExportControl) { if (control?.signal?.aborted) throw new DOMException('Export canceled.', 'AbortError'); control?.assertCurrent?.(); }
export function exportProgress(control: ExportControl | undefined, progress: ExportStage) { checkExport(control); control?.onProgress?.(progress); checkExport(control); }
