import type {DashboardWorkspace,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import {assertJsonSize} from '../../../shared/jsonSizeBudget';
import {normalizeImportedDataset} from './documentModel';
import {draftImportedStudyReferences} from './importedStudyUsage';
import {readSavedStudies} from './workspaceStorageValidation';

export const recoveredImportLimits={maxChars:16*1024*1024,maxNodes:2_000_000,maxDepth:96} as const;
const storageNote='Stored compactly in report drafts; full imported rows are kept at workspace level.';
export function assertRecoveryImportData(value:unknown){
 assertJsonSize(value,recoveredImportLimits);
 function visit(item:unknown):void{
  if(typeof item==='number'&&!Number.isFinite(item))throw Error('Nonfinite recovery metadata cannot be saved without changing it.');
  if(!item||typeof item!=='object')return;
  if(Object.getOwnPropertySymbols(item).length)throw Error('Recovery data has unsupported symbol metadata.');
  const array=Array.isArray(item),names=Object.getOwnPropertyNames(item),keys=Object.keys(item);
  if(names.length!==keys.length+(array?1:0)||array&&(keys.length!==item.length||keys.some((key,i)=>key!==String(i))))throw Error('Recovery data has hidden, sparse or extra array metadata.');
  for(const key of keys)visit((item as Record<string,unknown>)[key]);
 }
 visit(value);
}
export function recoveryImportSignature(value:unknown){assertRecoveryImportData(value);return JSON.stringify(value);}
function equal(left:unknown,right:unknown,subset=false):boolean{
 if(Object.is(left,right))return true;
 if(Array.isArray(left)||Array.isArray(right))return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((v,i)=>equal(v,right[i],subset));
 if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;
 const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a).filter(k=>a[k]!==undefined),other=Object.keys(b).filter(k=>b[k]!==undefined);
 return(subset||keys.length===other.length)&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k],subset));
}
export function redundantPreview(study:ImportedDatasetRecord){
 const key=(row:Record<string,string>)=>JSON.stringify(Object.keys(row).sort().map(name=>[name,row[name]]));
 const wanted=new Set(study.previewRows.map(key));
 for(const row of study.rows){if(!wanted.size)break;wanted.delete(key(row));}
 return wanted.size===0;
}
function normalize(study:ImportedDatasetRecord){
 if(Object.hasOwn(study,'rowStorage'))throw Error('Recovery accepts decoded study records only. Encoded recovery copies were kept unchanged; download a backup for format review.');
 const decoded=readSavedStudies([study],'v2')[0];
 if(typeof decoded.importedAt!=='string'||!Number.isFinite(Date.parse(decoded.importedAt)))throw Error('A recovered study has no valid import version. Both copies have been kept.');
 if(decoded.previewRows.length>25&&!redundantPreview(decoded)||decoded.remote?.provider==='netlify'&&(decoded.rows.length>0||decoded.fields.length>80))throw Error('The current browser save would compact part of this recovered copy. Keep it here and download a backup before reviewing the connected source; nothing was replaced.');
 const next=normalizeImportedDataset(decoded,0);
 if(!equal(decoded,next,true))throw Error('Recovered metadata cannot be preserved by the current study format. Download the recovery copy; nothing was replaced.');
 return next;
}
function comparable(study:ImportedDatasetRecord){return{...study,notes:study.notes.filter(note=>note!==storageNote),previewRows:redundantPreview(study)?[]:study.previewRows};}

/** Additive recovery only: same IDs never authorize replacement or rebinding. */
export function prepareRecoveredImports(workspace:DashboardWorkspace,imports:readonly ImportedDatasetRecord[]):DashboardWorkspace{
 assertRecoveryImportData(imports);
 const recovered=imports.map(normalize),ids=new Set(recovered.map(study=>study.id)),live=[...workspace.importedDatasets,...workspace.reports.flatMap(report=>report.draft.importedDatasets)].filter(study=>ids.has(study.id));
 assertRecoveryImportData([imports,live]);
 const existing=new Map<string,ImportedDatasetRecord>();
 for(const study of live){const next=normalize(study),old=existing.get(next.id);if(old&&!equal(comparable(old),comparable(next)))throw Error('Current study copies have conflicting data. Existing work and recovery copies were kept.');existing.set(next.id,next);}
 const pages=[...workspace.reports.map(report=>report.draft),...workspace.publishedSnapshots.map(snapshot=>snapshot.dashboard)];
 const reserved=new Set(pages.flatMap(draft=>draftImportedStudyReferences(draft).map(ref=>ref.datasetId)));
 for(const study of [...workspace.importedDatasets,...pages.flatMap(draft=>draft.importedDatasets)])if(study.preparation)reserved.add(study.preparation.sourceDatasetId);
 const additions=new Map<string,ImportedDatasetRecord>(),rootIds=new Set(workspace.importedDatasets.map(study=>study.id));
 for(const study of recovered){
  const prior=existing.get(study.id)??additions.get(study.id);
  if(prior){if(!equal(comparable(prior),comparable(study)))throw Error(`Recovered study "${study.title}" shares an identity with different data. Both copies were kept; download a backup and review the source files.`);if(!rootIds.has(study.id))additions.set(study.id,prior);continue;}
  if(reserved.has(study.id))throw Error(`A report already references the missing study identity for "${study.title}". Recovery did not rebind that report; both copies were kept for review.`);
  additions.set(study.id,study);
 }
 return additions.size?{...workspace,importedDatasets:[...workspace.importedDatasets,...additions.values()]}:workspace;
}
