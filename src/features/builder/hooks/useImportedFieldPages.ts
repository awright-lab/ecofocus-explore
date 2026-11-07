import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import type { ImportedDatasetField } from "../../../../shared/types/dashboard";
import { listImportedDatasetFieldsFromNetlify } from "../../data/netlifyDatasetStore";

export function useImportedFieldPages(datasetId: string | null, search: string, pageSize: number) {
  const context = useMemo(() => ({
    datasetId, search, pages: {} as Record<number, ImportedDatasetField[]>, total: null as number | null,
    pending: new Map<number, symbol>(), errors: new Map<number, string>(), start: 0, end: 0,
  }), [datasetId, search, pageSize]);
  const latest = useRef(context);
  useLayoutEffect(() => { latest.current = context; }, [context]);
  const mounted = useRef(false);
  const [, render] = useReducer(value => value + 1, 0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; latest.current.pending.clear(); };
  }, []);

  const load = useCallback((start: number, end: number) => {
    if (!datasetId || !mounted.current || latest.current !== context) return;
    context.start = start; context.end = end;
    const first = Math.floor(start / pageSize);
    const last = Math.floor(Math.max(end - 1, start) / pageSize);
    for (let page = first; page <= last; page += 1) {
      if (context.pages[page] || context.pending.has(page) || context.errors.has(page)) continue;
      const token = Symbol(); context.pending.set(page, token);
      const current = () => mounted.current && latest.current === context && context.pending.get(page) === token;
      void Promise.resolve().then(() => listImportedDatasetFieldsFromNetlify({ datasetId, search, offset: page * pageSize, limit: pageSize }))
        .then(result => {
          if (!current()) return;
          context.pages = { ...context.pages, [page]: result.fields }; context.total = result.total;
          context.errors.delete(page);
        }).catch(error => {
          if (current()) context.errors.set(page, error instanceof Error ? error.message : "Unable to load imported fields.");
        }).finally(() => {
          if (!current()) return;
          context.pending.delete(page); render();
        });
    }
  }, [context, datasetId, search, pageSize]);
  const retry = useCallback(() => {
    if (latest.current !== context) return;
    context.errors.clear(); load(context.start, context.end); render();
  }, [context, load]);
  return { pages: context.pages, total: context.total, error: context.errors.values().next().value ?? null, load, retry };
}
