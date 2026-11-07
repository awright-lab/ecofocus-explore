import { useEffect, useRef } from "react";

type Operation = { context: object; version: string | number; target?: string };

// Context generations, rather than IDs alone, prevent A -> B -> A navigation
// from reviving a response started during the earlier visit to A.
export function useAnalysisOperationOwnership(contextKey: string, readOnly: boolean, onLoading: (loading: boolean) => void, getContextVersion: () => string | number) {
  const renderVersion = getContextVersion();
  const key = JSON.stringify([contextKey, readOnly, renderVersion]);
  const context = useRef({ key });
  if (context.current.key !== key) context.current = { key };
  const renderContext = context.current;
  const mounted = useRef(false);
  const operations = useRef(new Set<Operation>());
  const targets = useRef(new Map<string, Operation>());
  const active = (operation: Operation) => operation.context === context.current && operation.version === getContextVersion() &&
    (!operation.target || targets.current.get(operation.target) === operation);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operations.current.clear(); targets.current.clear(); };
  }, []);
  useEffect(() => {
    for (const operation of operations.current) if (operation.context !== renderContext) operations.current.delete(operation);
    for (const [target, operation] of targets.current) if (operation.context !== renderContext) targets.current.delete(target);
    onLoading(!readOnly && [...operations.current].some(active));
  }, [renderContext, readOnly, onLoading]);

  return function begin(owner?: () => boolean, target?: string) {
    if (!mounted.current || readOnly || context.current !== renderContext || getContextVersion() !== renderVersion) return null;
    const operation: Operation = { context: renderContext, version: renderVersion, target };
    operations.current.add(operation);
    if (target) targets.current.set(target, operation);
    onLoading(true);
    return {
      isCurrent: () => mounted.current && active(operation) && (!owner || owner()),
      // Accepted state updaters can run after the originating dialog closes.
      // They still belong to this editor generation and latest target request.
      ownsContext: () => mounted.current && active(operation),
      finish: () => {
        operations.current.delete(operation);
        // Retain the latest target token through deferred React state updates.
        // A subsequent request or context change replaces/releases it.
        // Old completions must not clear another report/page's loading state.
        if (mounted.current && context.current === renderContext && getContextVersion() === renderVersion) onLoading([...operations.current].some(active));
      },
    };
  };
}
