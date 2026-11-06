import type { AudienceExpression, SavedImportedAudience } from "../../../shared/types/audience";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { importedRawFieldValue } from "../data/importedRawValue";
import { parseImportedNumber } from "../data/importedNumericValue";
type Match = boolean|null;
function object(value:unknown):value is Record<string,unknown>{return !!value && typeof value==="object" && !Array.isArray(value);}
export function audienceDefinitionIssue(value:unknown):string|null {
 if(!object(value)||value.version!==1||!["id","label","datasetId","importedAt"].every(key=>typeof value[key]==="string"&&!!(value[key] as string).trim()))return "This audience has missing or unsupported identity metadata.";
 if((value.label as string).length>160)return "Use an audience name of 160 characters or fewer.";
 let count=0;
 function node(value:unknown,depth:number):boolean {
  if(++count>64||depth>6||!object(value)||typeof value.exclude!=="boolean")return false;
  if(value.kind==="group")return ["all","any"].includes(String(value.match))&&Array.isArray(value.children)&&value.children.length>0&&value.children.length<=12&&value.children.every(child=>node(child,depth+1));
  if(typeof value.fieldId!=="string"||!value.fieldId||typeof value.sourceColumn!=="string"||!value.sourceColumn)return false;
  if(value.kind==="blank")return true;
  if(value.kind==="category")return Array.isArray(value.values)&&value.values.length>0&&value.values.length<=1000&&value.values.every(v=>typeof v==="string"&&!!v.trim()&&v===v.trim())&&new Set(value.values).size===value.values.length;
  if(value.kind==="range")return [value.min,value.max].every(v=>v===null||typeof v==="number"&&Number.isFinite(v))&&(value.min!==null||value.max!==null)&&(value.min===null||value.max===null||(value.min as number)<=(value.max as number));
  return false;
 }
 return node(value.expression,0)?null:"Complete each audience rule: choose categories or valid inclusive numeric bounds. Groups cannot be empty (maximum six nested levels and 64 rules/groups).";
}
export function assertSavedAudiences(value:unknown):asserts value is SavedImportedAudience[]|undefined {
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length>100)throw new Error("The saved audience library is damaged or exceeds 100 audiences. Saved data has not been changed.");
 const ids=new Set<string>();for(const item of value){const issue=audienceDefinitionIssue(item);if(issue||ids.has(item.id))throw new Error(issue??"Saved audience IDs conflict. Saved data has not been changed.");ids.add(item.id);}
}
export function audienceSourceIssue(dataset:ImportedDatasetRecord|null|undefined):string|null {
 if(!dataset)return "Choose an imported study.";
 if(dataset.remote?.provider==="netlify")return "Audience building currently requires a complete local study. Server-backed audiences are not supported; import a local study to continue.";
 if(dataset.rows.length!==dataset.rowCount)return "The complete study is required for an exact audience preview. Partial/preview rows cannot establish its population.";
 return null;
}
export function audienceCategoryKey(field:ImportedDatasetField,raw:string):string {
 const value=raw.trim();if(!value||Object.hasOwn(field.valueLabels??{},value))return value;
 const numeric=Number(value),key=String(numeric);return Number.isFinite(numeric)&&Object.hasOwn(field.valueLabels??{},key)?key:value;
}
export function audienceCategoryChoices(dataset:ImportedDatasetRecord,field:ImportedDatasetField) {
 const values=new Set(dataset.rows.map(row=>audienceCategoryKey(field,importedRawFieldValue(row,field))).filter(Boolean));
 return [...values].sort((a,b)=>a.localeCompare(b)).map(value=>({value,label:Object.hasOwn(field.valueLabels??{},value)?`${field.valueLabels![value]} [${value}]`:value}));
}
export function compileAudience(audience:SavedImportedAudience,dataset:ImportedDatasetRecord):(row:Record<string,string>)=>Match {
 const issue=audienceDefinitionIssue(audience)??audienceSourceIssue(dataset);if(issue)throw new Error(issue);
 if(audience.datasetId!==dataset.id||audience.importedAt!==dataset.importedAt)throw new Error("This audience belongs to a different study import. Its rules were not applied.");
 function compile(expression:AudienceExpression):(row:Record<string,string>)=>Match {
  const invert=(match:Match)=>match===null?null:expression.exclude?!match:match;
  if(expression.kind==="group"){
   const children=expression.children.map(compile);return row=>{
    const matches=children.map(child=>child(row));const match=expression.match==="all"?matches.includes(false)?false:matches.includes(null)?null:true:matches.includes(true)?true:matches.includes(null)?null:false;
    return invert(match);
   };
  }
  const fields=dataset.fields.filter(field=>field.id===expression.fieldId&&field.sourceColumn===expression.sourceColumn);
  if(fields.length!==1)throw new Error(`An audience field is missing or ambiguous: ${expression.sourceColumn}. Review its rules before applying.`);
  const field=fields[0];
  if(expression.kind==="range"&&field.type!=="numeric"&&field.modelingRole!=="candidate_measure")throw new Error(`Model ${field.label} as numeric before using a numeric range.`);
  const selected=expression.kind==="category"?new Set(expression.values):null;
  return row=>{
   const raw=importedRawFieldValue(row,field),key=audienceCategoryKey(field,raw);
   if(expression.kind==="blank")return invert(!raw.trim());
   if(!raw.trim())return null;
   if(expression.kind==="category")return invert(selected!.has(key));
   const number=parseImportedNumber(raw);if(number===null)return null;
   return invert((expression.min===null||number>=expression.min)&&(expression.max===null||number<=expression.max));
  };
 }
 return compile(audience.expression);
}
export interface AudiencePreview { included:number; excluded:number; unknown:number; total:number }
export function previewAudience(audience:SavedImportedAudience,dataset:ImportedDatasetRecord):AudiencePreview {
 const predicate=compileAudience(audience,dataset),preview={included:0,excluded:0,unknown:0,total:dataset.rows.length};
 for(const row of dataset.rows){const match=predicate(row);if(match===true)preview.included++;else if(match===false)preview.excluded++;else preview.unknown++;}
 return preview;
}
export async function previewAudienceAsync(audience:SavedImportedAudience,dataset:ImportedDatasetRecord,signal:AbortSignal,onProgress?:(done:number,total:number)=>void):Promise<AudiencePreview>{
 const predicate=compileAudience(audience,dataset),preview={included:0,excluded:0,unknown:0,total:dataset.rows.length};
 for(let start=0;start<dataset.rows.length;start+=1000){
  if(signal.aborted)throw new Error("Audience preview cancelled.");
  for(const row of dataset.rows.slice(start,start+1000)){const match=predicate(row);if(match===true)preview.included++;else if(match===false)preview.excluded++;else preview.unknown++;}
  onProgress?.(Math.min(start+1000,dataset.rows.length),dataset.rows.length);await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 if(signal.aborted)throw new Error("Audience preview cancelled.");return preview;
}
export function audienceSummary(audience:SavedImportedAudience):string {
 const issue=audienceDefinitionIssue(audience);if(issue)return `Unverified audience: ${issue}`;
 function describe(e:AudienceExpression):string{
  const body=e.kind==="group"?`(${e.children.map(describe).join(e.match==="all"?" AND ":" OR ")})`:e.kind==="category"?`${e.sourceColumn} in ${e.values.map(v=>JSON.stringify(v)).join(", ")}`:e.kind==="blank"?`${e.sourceColumn} is blank`:`${e.sourceColumn} between ${e.min??"−∞"} and ${e.max??"∞"} (inclusive)`;
  return e.exclude?`NOT ${body}`:body;
 }
 return `${audience.label}: ${describe(audience.expression)}`;
}
