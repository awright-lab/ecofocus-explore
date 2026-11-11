import type { ImportedDatasetField, ImportedDatasetRecord } from '../../../shared/types/dashboard';
import { importedRawFieldValue } from './importedRawValue';

export const studyQualityCellLimit=5_000_000;
export type QualityField = { id:string; label:string; sourceColumn:string; kind:'numeric'|'categorical'|'other'; blank:number; nonblank:number; valid:number|null; invalid:number|null; distinct:number|null; issue?:string };
export type QualitySnapshot = { dataset:ImportedDatasetRecord; rows:ImportedDatasetRecord['rows']; fields:ImportedDatasetField[]; schema:string; rowRefs:ImportedDatasetRecord['rows']; rowTexts:string[]; values:string[][]; summaries:QualityField[] };
export function studyQualityEligibility(dataset:ImportedDatasetRecord):string|null {
 if(dataset.sourceType!=='local_file'||dataset.remote||(dataset.sourceRef&&(dataset.sourceRef.kind!=='imported_file'||dataset.sourceRef.provider!=='local_file'||dataset.sourceRef.datasetId!==dataset.id)))return 'Study quality is unavailable for remote or inconsistent source identities. No data was downloaded.';
 if(dataset.importStatus&&!['local_ready','ready'].includes(dataset.importStatus.status))return 'The local study is not ready for a complete review. Retry when all rows and fields are available.';
 if(!Number.isSafeInteger(dataset.rowCount)||dataset.rowCount<0||!Number.isSafeInteger(dataset.fieldCount)||dataset.fieldCount<0||dataset.rows.length!==dataset.rowCount||dataset.previewRows.length>dataset.rowCount||dataset.fields.length!==dataset.fieldCount)return 'A complete local row and field snapshot is required. Preview rows cannot establish study-wide counts.';
 if(dataset.rowCount>1_000_000||dataset.fieldCount>10_000||!Number.isSafeInteger(dataset.rowCount*dataset.fieldCount)||dataset.rowCount*dataset.fieldCount>studyQualityCellLimit)return 'This study exceeds the review limits (1,000,000 rows, 10,000 fields or 5,000,000 cells). The study was not changed.';
 const ids=new Set<string>(),columns=new Set<string>();for(const field of dataset.fields){if(!field||typeof field.id!=='string'||!field.id.trim()||ids.has(field.id)||typeof field.label!=='string'||typeof field.sourceColumn!=='string'||!field.sourceColumn.trim()||columns.has(field.sourceColumn))return 'Field identities or source columns are missing or ambiguous. Review the study before calculating.';ids.add(field.id);columns.add(field.sourceColumn);}
 return null;
}
export function qualitySchema(dataset:ImportedDatasetRecord){return JSON.stringify({id:dataset.id,sourceType:dataset.sourceType,sourceRef:dataset.sourceRef,remote:dataset.remote,importedAt:dataset.importedAt,rowCount:dataset.rowCount,fieldCount:dataset.fieldCount,fields:dataset.fields});}
/** Compare exact raw values, schema and object ownership; never use a hash to establish equality. */
export function qualitySnapshotCurrent(snapshot:QualitySnapshot,dataset:ImportedDatasetRecord):boolean {
 try {if(snapshot.dataset!==dataset||snapshot.rows!==dataset.rows||studyQualityEligibility(dataset)||qualitySchema(dataset)!==snapshot.schema||snapshot.fields.length!==dataset.fields.length||snapshot.fields.some((f,i)=>dataset.fields[i]!==f))return false;
 if(snapshot.rowRefs.length!==snapshot.rows.length||snapshot.rowTexts.length!==snapshot.rows.length)return false;
 for(let r=0;r<snapshot.rows.length;r++)if(snapshot.rows[r]!==snapshot.rowRefs[r]||JSON.stringify(snapshot.rows[r])!==snapshot.rowTexts[r])return false;
 for(let f=0;f<snapshot.fields.length;f++)for(let r=0;r<snapshot.rows.length;r++)if(importedRawFieldValue(snapshot.rows[r],snapshot.fields[f])!==snapshot.values[f][r])return false;
 return true;}catch{return false;}
}
export function qualityWindow(summaries:QualityField[],query:string,filter:string,descending:boolean,page:number){
 const terms=query.trim().normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
 const found=summaries.map((field,index)=>({field,index})).filter(({field})=>terms.every(term=>[field.label,field.id,field.sourceColumn].some(value=>value.normalize('NFKC').toLowerCase().includes(term)))&&(filter==='all'||filter==='blank'&&field.blank>0&&field.nonblank===0||filter==='constant'&&field.nonblank>0&&field.distinct===1&&(field.invalid===null||field.invalid===0)||filter==='invalid'&&(field.invalid??0)>0));
 found.sort((a,b)=>((a.field.blank-b.field.blank)*(descending?-1:1))||a.index-b.index);
 const pages=Math.max(1,Math.ceil(found.length/20)),current=Number.isSafeInteger(page)?Math.min(Math.max(0,page),pages-1):0;
 return {total:found.length,pages,page:current,entries:found.slice(current*20,current*20+20)};
}
