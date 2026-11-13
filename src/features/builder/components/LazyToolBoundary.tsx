import { Component, Suspense, createContext, lazy, useContext, useEffect, useId, useLayoutEffect, useRef, type ComponentType, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import './lazyToolBoundary.css';

type Claim = { cancelIfUnsettled: () => void };
const ToolOwner = createContext<((claim: Claim) => () => void) | null>(null);
export function LazyToolCoordinator({ children, invalidateRef }: { children: ReactNode; invalidateRef?: RefObject<() => void> }) {
  const current = useRef<Claim | null>(null);
  useLayoutEffect(() => { if (!invalidateRef) return; invalidateRef.current = () => current.current?.cancelIfUnsettled(); return () => { invalidateRef.current = () => {}; }; }, [invalidateRef]);
  const claim = useRef((next: Claim) => { current.current?.cancelIfUnsettled(); current.current = next; return () => { if (current.current === next) current.current = null; }; });
  return <ToolOwner.Provider value={claim.current}>{children}</ToolOwner.Provider>;
}
class ToolImportError extends Error {
  constructor(cause: unknown) { super('Tool module could not be loaded.', { cause }); this.name = 'ToolImportError'; }
}
export function lazyTool<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => Promise.resolve().then(load).catch(error => { throw new ToolImportError(error); }));
}
function Surface({ name, onClose, error, restore, onRetry }: { name: string; onClose: () => void; error?: Error; restore: RefObject<boolean>; onRetry?: () => void }) {
  const ref = useRef<HTMLElement>(null), title = useId();
  useModalAccessibility(ref, onClose, () => restore.current);
  return createPortal(<div className="lazy-tool-backdrop" data-canvas-keyboard-scope="controls"><section className="lazy-tool-surface" role="dialog" aria-modal="true" aria-labelledby={title} ref={ref} tabIndex={-1} onKeyDown={event => event.stopPropagation()}>
    <h2 id={title}>{name}</h2>{error ? <div role="alert"><p>{error instanceof ToolImportError ? 'This tool could not be downloaded. The editor remains open.' : 'This tool could not be displayed. The editor remains open.'}</p><p>{error instanceof ToolImportError ? 'The browser may keep a failed module download. Close this tool and save any unsaved work if possible before reloading the page.' : 'Close this tool and review your work. Tool-specific unsaved input may need to be entered again.'}</p></div> : <p role="status" aria-live="polite">Loading {name}…</p>}
    {onRetry && <button type="button" onClick={onRetry}>Retry {name}</button>} <button type="button" onClick={onClose}>Close {name}</button>
  </section></div>, document.body);
}
class CatchTool extends Component<{ name: string; onClose: () => void; restore: RefObject<boolean>; children: ReactNode; failed: RefObject<boolean> }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: unknown) { return { error: error instanceof Error ? error : new Error('Tool failed.') }; }
  componentDidCatch() { this.props.failed.current = true; }
  render() { return this.state.error ? <Surface name={this.props.name} onClose={this.props.onClose} error={this.state.error} restore={this.props.restore} onRetry={!(this.state.error instanceof ToolImportError) && this.props.restore.current ? () => { this.props.failed.current = false; this.setState({ error: null }); } : undefined}/> : this.props.children; }
}
function Ready({ children, restore }: { children: ReactNode; restore: RefObject<boolean> }) { useLayoutEffect(() => { restore.current = false; }, [restore]); return children; }
export function LazyToolBoundary({ name, onClose, children }: { name: string; onClose: () => void; children: ReactNode }) {
  const restore = useRef(true), failed = useRef(false), closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  const claim = useContext(ToolOwner);
  useLayoutEffect(() => claim?.({ cancelIfUnsettled: () => { if (restore.current || failed.current) { restore.current = false; closeRef.current(); } } }), [claim]);
  const opener = useRef(document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : document.querySelector<HTMLElement>('[aria-label="Find a tool"], [aria-label="Create analysis"]'));
  useEffect(() => () => { queueMicrotask(() => { const visible = (element: HTMLElement | null) => !!element?.isConnected && element.getClientRects().length > 0 && !element.closest('[inert]'); const target = visible(opener.current) ? opener.current : [...document.querySelectorAll<HTMLElement>('[aria-label="Find a tool"], [aria-label="Create analysis"], .studio-rail button')].find(visible); if (target && (document.activeElement === document.body || !document.activeElement?.isConnected)) target.focus(); }); }, []);
  return <CatchTool name={name} onClose={onClose} restore={restore} failed={failed}><Suspense fallback={<Surface name={name} onClose={onClose} restore={restore}/>}><Ready restore={restore}>{children}</Ready></Suspense></CatchTool>;
}
