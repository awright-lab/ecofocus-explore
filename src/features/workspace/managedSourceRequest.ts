import type {DashboardWorkspace} from "../../../shared/types/dashboard";
import {assertJsonSize} from "../../../shared/jsonSizeBudget";
export interface ManagedRequestContext {workspace:DashboardWorkspace;pending:DashboardWorkspace|null;route:string;mounted:boolean;selection:string}
export function managedTargetSignature(target:unknown){assertJsonSize(target,{maxChars:1024*1024,maxNodes:60000,maxDepth:32});return JSON.stringify(target);}
/** Strict ownership, not merging: an unrelated newer workspace invalidates this response. */
export function createManagedSourceRequests(read:()=>ManagedRequestContext,readVersion?:()=>string|null){
 const active=new Map<string,symbol>();
 return{begin(slot:string,select:(context:ManagedRequestContext)=>unknown){
  const start=read();if(!start.mounted)throw Error('The workspace closed. No source request was started.');
  if(start.pending&&start.pending!==start.workspace)throw Error('Pending recovery work differs from this screen. Retry or back up that pending workspace before checking sources.');
  const target=managedTargetSignature(select(start)),version=readVersion?.(),token=Symbol(slot);active.set(slot,token);
  function owns(){const next=read();return active.get(slot)===token&&next.mounted&&next.route===start.route&&next.workspace.id===start.workspace.id;}
  return{workspace:start.workspace,owns,selectionCurrent:()=>read().selection===start.selection,isCurrent(){try{const next=read();return owns()&&next.workspace===start.workspace&&next.pending===start.pending&&(!readVersion||readVersion()===version)&&managedTargetSignature(select(next))===target;}catch{return false;}},finish(){if(active.get(slot)!==token)return false;active.delete(slot);return read().mounted;}};
 },cancel(){active.clear();}};
}
export type ManagedSourceRequest=ReturnType<ReturnType<typeof createManagedSourceRequests>["begin"]>;
export function managedConnectionTarget(context:ManagedRequestContext,provider:string){
 if(context.selection!==provider)throw Error('The selected provider changed. Review and retry.');
 const profiles=(context.workspace.datasetConnections??[]).filter(profile=>profile.provider===provider);if(profiles.length>1)throw Error('The connection identity is ambiguous. Existing plans were kept.');
 return{provider,profile:profiles[0]??null};
}
export function managedInspectionTarget(context:ManagedRequestContext,sourceId:string,definitionId?:string){
 const sources=(context.workspace.liveDatasetSources??[]).filter(source=>source.sourceRef.id===sourceId);if(sources.length!==1)throw Error('The managed source is missing or ambiguous. Review its mapping and retry.');
 const source=sources[0],connections=(context.workspace.datasetConnections??[]).filter(profile=>profile.id===source.connectionId&&profile.provider===source.sourceRef.provider);if(connections.length!==1)throw Error('The source connection plan is missing or ambiguous. Review it before checking fields.');
 const definitions=definitionId?(source.queryDefinitions??[]).filter(definition=>definition.id===definitionId&&definition.sourceRefId===sourceId):[];if(definitionId&&definitions.length!==1)throw Error('The live query definition changed or is missing. Review it before running.');
 return{source,connection:connections[0],definition:definitions[0]??null};
}
