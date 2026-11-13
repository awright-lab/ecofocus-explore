// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LazyToolBoundary, LazyToolCoordinator, lazyTool } from '../LazyToolBoundary';
const host=document.createElement('div'); document.body.append(host); let root=createRoot(host);
afterEach(async()=>{await act(async()=>root.unmount());root=createRoot(host);document.body.querySelectorAll('.lazy-tool-backdrop').forEach(e=>e.remove());vi.unstubAllGlobals();});
it('allows Escape while loading, isolates the editor, and ignores a late result after close',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); let resolve!:(v:{default:()=>React.ReactNode})=>void;const Tool=lazyTool(()=>new Promise<{default:()=>React.ReactNode}>(r=>{resolve=r;})); const close=vi.fn();
 await act(async()=>root.render(<LazyToolBoundary name="Synthetic analysis" onClose={close}><Tool/></LazyToolBoundary>));expect(document.querySelector('[role="status"]')?.textContent).toContain('Loading Synthetic analysis');expect(document.querySelector('[role="dialog"]')).toBeTruthy();
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(close).toHaveBeenCalledOnce();await act(async()=>root.render(null));await act(async()=>resolve({default:()=> <p>Late tool</p>}));expect(document.body.textContent).not.toContain('Late tool');
});
it('explains a rejected cached import without offering a misleading retry',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const Tool=lazyTool(async()=>{throw Error('offline');});await act(async()=>root.render(<LazyToolBoundary name="Synthetic design" onClose={()=>{}}><Tool/></LazyToolBoundary>));expect(document.querySelector('[role="alert"]')?.textContent).toContain('failed module download');expect(document.body.textContent).toContain('unsaved work');expect(document.body.textContent).not.toContain('Retry');
});
it('permits an explicit retry when rendering failed before the tool committed',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let fail=true;function Broken():React.ReactNode {if(fail)throw Error('render');return <p>Tool ready</p>;} await act(async()=>root.render(<LazyToolBoundary name="Synthetic tool" onClose={()=>{}}><Broken/></LazyToolBoundary>));expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be displayed');fail=false;await act(async()=>[...document.querySelectorAll('button')].find(x=>x.textContent==='Retry Synthetic tool')!.click());expect(document.body.textContent).toContain('Tool ready');
});
it('does not retry a render failure after a tool has committed',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let fail=false;function Tool():React.ReactNode {if(fail)throw Error('later');return <p>Committed tool</p>;}await act(async()=>root.render(<LazyToolBoundary name="Analysis" onClose={()=>{}}><Tool/></LazyToolBoundary>));fail=true;await act(async()=>root.render(<LazyToolBoundary name="Analysis" onClose={()=>{}}><Tool/></LazyToolBoundary>));expect(document.querySelector('[role="alert"]')).toBeTruthy();expect(document.body.textContent).not.toContain('Retry Analysis');
});

it('cancels an earlier pending tool when a different tool claims the coordinator',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let resolve!:(v:{default:()=>React.ReactNode})=>void;const Tool=lazyTool(()=>new Promise<{default:()=>React.ReactNode}>(r=>{resolve=r;}));const close=vi.fn();
 await act(async()=>root.render(<LazyToolCoordinator><LazyToolBoundary name="Old" onClose={close}><Tool/></LazyToolBoundary></LazyToolCoordinator>));
 await act(async()=>root.render(<LazyToolCoordinator><LazyToolBoundary name="Old" onClose={close}><Tool/></LazyToolBoundary><LazyToolBoundary name="New" onClose={()=>{}}><p>New tool</p></LazyToolBoundary></LazyToolCoordinator>));expect(close).toHaveBeenCalledOnce();
 await act(async()=>root.render(<LazyToolCoordinator><LazyToolBoundary name="New" onClose={()=>{}}><p>New tool</p></LazyToolBoundary></LazyToolCoordinator>));await act(async()=>resolve({default:()=> <p>Old late</p>}));expect(document.body.textContent).not.toContain('Old late');
});
it('restores opener on close and keeps shortcut keys inside the loading surface',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const opener=document.createElement('button');document.body.append(opener);opener.focus();const listener=vi.fn();window.addEventListener('keydown',listener);const Tool=lazyTool(()=>new Promise<{default:()=>React.ReactNode}>(()=>{}));
 try {await act(async()=>root.render(<LazyToolBoundary name="Loading tool" onClose={()=>root.render(null)}><Tool/></LazyToolBoundary>));const close=document.querySelector<HTMLButtonElement>('.lazy-tool-surface button')!;close.focus();await act(async()=>close.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));expect(listener).not.toHaveBeenCalled();await act(async()=>close.click());expect(document.activeElement).toBe(opener);}finally{window.removeEventListener('keydown',listener);opener.remove();}
});
it('invalidates a pending owner without closing a successfully opened tool',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const invalidate={current:()=>{}};const close=vi.fn();let finish!:(v:{default:()=>React.ReactNode})=>void;const Pending=lazyTool(()=>new Promise<{default:()=>React.ReactNode}>(r=>{finish=r;}));
 await act(async()=>root.render(<LazyToolCoordinator invalidateRef={invalidate}><LazyToolBoundary name="Waiting" onClose={close}><Pending/></LazyToolBoundary></LazyToolCoordinator>));await act(async()=>invalidate.current());expect(close).toHaveBeenCalledOnce();await act(async()=>root.render(null));await act(async()=>finish({default:()=> <p>Late</p>}));expect(document.body.textContent).not.toContain('Late');
 close.mockClear();await act(async()=>root.render(<LazyToolCoordinator invalidateRef={invalidate}><LazyToolBoundary name="Ready" onClose={close}><p>Working tool</p></LazyToolBoundary></LazyToolCoordinator>));await act(async()=>invalidate.current());expect(close).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Working tool');
});

it('classifies a synchronously throwing loader as an import failure',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const Tool=lazyTool(():Promise<{default:()=>React.ReactNode}>=>{throw Error('sync loader');});await act(async()=>root.render(<LazyToolBoundary name="Synthetic import" onClose={()=>{}}><Tool/></LazyToolBoundary>));expect(document.querySelector('[role="alert"]')?.textContent).toContain('failed module download');expect(document.body.textContent).not.toContain('Retry Synthetic import');
});
