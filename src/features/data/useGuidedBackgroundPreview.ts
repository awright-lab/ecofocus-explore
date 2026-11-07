import {useEffect,useRef,useState} from 'react';
import type {ImportedDatasetQueryConfig} from './importedDatasetAnalytics';
import {runGuidedPreviewJob,type GuidedPreviewAcceptance,type GuidedPreviewProgress} from './guidedPreviewJob';
export function useGuidedBackgroundPreview(config:ImportedDatasetQueryConfig|null){
 const latest=useRef(config);latest.current=config;
 const epoch=useRef(0),controller=useRef<AbortController|null>(null);
 const[state,setState]=useState<{owner:typeof config;accepted:GuidedPreviewAcceptance|null;progress:GuidedPreviewProgress|null;error:string|null}>({owner:config,accepted:null,progress:null,error:null});
 useEffect(()=>{epoch.current++;controller.current?.abort();setState({owner:config,accepted:null,progress:null,error:null});},[config]);
 useEffect(()=>()=>{epoch.current++;controller.current?.abort();},[]);
 async function run(){const input=latest.current;if(!input)return;controller.current?.abort();const abort=new AbortController(),attempt=++epoch.current;controller.current=abort;setState({owner:input,accepted:null,progress:{phase:'preparing',done:0,total:input.dataset.rowCount},error:null});let previous=-1;
  try{const accepted=await runGuidedPreviewJob(input,{signal:abort.signal,getCurrentConfig:()=>latest.current,onProgress:progress=>{const percent=progress.phase==='preparing'?Math.floor(progress.done/progress.total*100):101;if(attempt===epoch.current&&(percent>=previous+5||percent===100||progress.phase==='calculating')){previous=percent;setState({owner:input,accepted:null,progress,error:null});}}});if(attempt===epoch.current&&!abort.signal.aborted)setState({owner:input,accepted,progress:null,error:null});}
  catch(error){if(attempt===epoch.current&&!abort.signal.aborted)setState({owner:input,accepted:null,progress:null,error:error instanceof Error?error.message:'No background preview was accepted.'});}
 }
 function cancel(){epoch.current++;controller.current?.abort();setState({owner:latest.current,accepted:null,progress:null,error:'Preview canceled. Your setup, source data and report were kept.'});}
 const owned=state.owner===config,accepted=owned?state.accepted:null,current=accepted?.sourceStillCurrent()??false;
 return {result:current?accepted!.result:null,error:owned?(accepted&&!current?'The source or setup changed. Recalculate the current preview.':state.error):null,progress:owned?state.progress:null,busy:owned&&!!state.progress,run,cancel};
}
