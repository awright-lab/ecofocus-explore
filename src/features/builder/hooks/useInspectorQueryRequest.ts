import { useCallback, useEffect, useRef, useState } from "react";

const standaloneContext = () => 0;

// This loading state belongs to one mounted editor, so its own last request can
// settle it after navigation even when React skips an otherwise identical view.
export function useInspectorQueryRequest(contextKey: string, getEditorContextVersion:()=>string|number = standaloneContext) {
  const [busy,setBusy] = useState(false), [error,setError] = useState<string|null>(null);
  const mounted = useRef(false), sequence = useRef(0), edits = useRef(0);
  const controller = useRef<AbortController|null>(null);
  const getter = useRef(getEditorContextVersion); getter.current = getEditorContextVersion;
  const externalVersion = getEditorContextVersion(), editVersion = edits.current;
  const key = JSON.stringify([contextKey,externalVersion,editVersion]);
  const context = useRef({key});
  if (context.current.key !== key) { context.current={key}; sequence.current+=1; }
  const renderContext = context.current, renderSequence = sequence.current;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current+=1;controller.current?.abort();controller.current=null;};},[]);
  useEffect(()=>{if(sequence.current===renderSequence){controller.current?.abort();controller.current=null;setBusy(false);setError(null);}},[renderContext]);
  const invalidate = useCallback(()=>{controller.current?.abort();controller.current=null;edits.current+=1;sequence.current+=1;setBusy(false);setError(null);},[]);
  function begin() {
    if(!mounted.current || context.current!==renderContext || getter.current()!==externalVersion || edits.current!==editVersion)return null;
    controller.current?.abort();
    let abort:AbortController|null=null;
    try { if(typeof AbortController==='function')abort=new AbortController(); } catch { /* Request ownership still discards canceled results when browser abort is unavailable. */ }
    controller.current=abort;
    const token=++sequence.current;
    setBusy(true);setError(null);
    const isCurrent=()=>!abort?.signal.aborted&&mounted.current&&sequence.current===token&&context.current===renderContext&&getter.current()===externalVersion&&edits.current===editVersion;
    return {isCurrent,signal:abort?.signal,fail:(failure:unknown)=>{if(isCurrent())setError(failure instanceof Error?failure.message:"Imported result update failed.");},
      finish:()=>{if(controller.current===abort)controller.current=null;if(mounted.current&&sequence.current===token)setBusy(false);}};
  }
  return {busy,error,invalidate,begin};
}

export function useInvalidatingQueryOption<T>(initial:T|(()=>T), invalidate:()=>void):readonly[T,(next:T)=>void] {
  const [value,setValue]=useState(initial),latest=useRef(value);
  const change=useCallback((next:T)=>{if(Object.is(latest.current,next))return;latest.current=next;invalidate();setValue(()=>next);},[invalidate]);
  return [value,change] as const;
}
