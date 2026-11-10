import type {DashboardDraft,ImportedDatasetField,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import {assertResponseCodebooks,type ResponseCodebook,type CodedResponse,type CodingTheme} from '../../../shared/types/responseCoding';
export type CodingStatus='Unreviewed'|'One pass'|'Needs theme review'|'Agreed'|'Disagreement'|'Resolved';
export const sameThemes=(a:string[],b:string[])=>a.length===b.length&&a.every(id=>b.includes(id));
export function codingStatus(book:ResponseCodebook,response:CodedResponse|undefined):CodingStatus{
 if(!response)return 'Unreviewed';if([response.a,response.b].some(pass=>pass&&pass.revision!==book.revision))return 'Needs theme review';
 if(!response.a||!response.b)return 'One pass';
 if(response.resolution?.revision===book.revision&&sameThemes(response.resolution.a,response.a.themeIds)&&sameThemes(response.resolution.b,response.b.themeIds))return 'Resolved';
 return sameThemes(response.a.themeIds,response.b.themeIds)?'Agreed':'Disagreement';
}
export function codingStudyIssue(study:ImportedDatasetRecord|undefined):string|null{
 if(!study)return 'Choose a complete original local study.';
 if(study.remote||study.preparation||study.sourceType!=='local_file'||study.rows.length!==study.rowCount||study.fields.length!==study.fieldCount||!Number.isSafeInteger(study.rowCount)||study.rowCount<1||study.rowCount>50000)return 'Coding supports complete original local-file imports with 1–50,000 rows. Remote, partial and prepared copies are not substituted.';
 if(new Set(study.fields.map(f=>f.id)).size!==study.fields.length||new Set(study.fields.map(f=>f.sourceColumn)).size!==study.fields.length)return 'Ambiguous field identities prevent coding.';return null;
}
export interface CodingSource {studyId:string; rows:Array<{id:string;text:string;row:number}>; missing:number; snapshot:string; source:ResponseCodebook['source']; current:(study:ImportedDatasetRecord|undefined)=>boolean}
function projection(study:ImportedDatasetRecord,field:ImportedDatasetField,idField:ImportedDatasetField){
 const issue=codingStudyIssue(study);if(issue)throw Error(issue);
 if(field.id===idField.id||!['text','categorical'].includes(field.type)||!field.sourceColumn||!idField.sourceColumn)throw Error('Choose separate comment and respondent-ID fields; comments must be text/categorical.');
 if(JSON.stringify(field).length>200000||JSON.stringify(idField).length>200000)throw Error('Selected field metadata is too large for a saved coding binding.');
 const encoder=new TextEncoder();let bytes=encoder.encode(JSON.stringify({field,idField})).length;
 const values=study.rows.map(row=>{const id=Object.hasOwn(row,idField.sourceColumn)?row[idField.sourceColumn]:'',text=Object.hasOwn(row,field.sourceColumn)?row[field.sourceColumn]:'';if(typeof id!=='string'||id.length>256||typeof text!=='string'||text.length>20000)throw Error('Identifiers must be text up to 256 characters; comments must be text up to 20,000 characters.');const pair=[id,text];bytes+=encoder.encode(JSON.stringify(pair)).length+1;if(bytes>20*1024*1024)throw Error('This coding workflow supports up to 20 MiB of selected comments, identifiers and metadata.');return pair;});
 return JSON.stringify({id:study.id,importedAt:study.importedAt,title:study.title,rowCount:study.rowCount,fieldCount:study.fieldCount,field,idField,values});
}
export async function verifyCodingSource(study:ImportedDatasetRecord,fieldId:string,idFieldId:string,signal?:AbortSignal):Promise<CodingSource>{
 const issue=codingStudyIssue(study);if(issue)throw Error(issue);const field=study.fields.find(f=>f.id===fieldId),idField=study.fields.find(f=>f.id===idFieldId);if(!field||!idField)throw Error('Choose available comment and ID fields.');
 const abort=()=>{if(signal?.aborted)throw new DOMException('Source verification canceled. Coding and source data were not changed.','AbortError');};abort();
 const snapshot=projection(study,field,idField),bytes=new TextEncoder().encode(snapshot);if(bytes.length>20*1024*1024)throw Error('This coding workflow supports up to 20 MiB of selected comments, identifiers and metadata.');
 if(!globalThis.crypto?.subtle)throw Error('Source fingerprinting is unavailable. No coding was applied.');
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');abort();
 const rows:CodingSource['rows']=[],ids=new Set<string>(),values=JSON.parse(snapshot).values as unknown[][];let missing=0;
 for(let offset=0;offset<values.length;offset+=500){abort();for(let i=offset;i<Math.min(offset+500,values.length);i++){const [id,text]=values[i];if(typeof id!=='string'||!id.trim()||id.length>256||ids.has(id.trim()))throw Error(`Respondent IDs must be nonblank and unique throughout the complete source (row ${i+1}).`);ids.add(id.trim());if(typeof text!=='string'||text.length>20000)throw Error('Comments must be text of at most 20,000 characters.');if(text.trim())rows.push({id:id.trim(),text,row:i+1});else missing++;}await new Promise<void>(resolve=>setTimeout(resolve,0));}
 abort();if(!rows.length)throw Error('This field has no nonblank comments to code.');
 const current=(latest:ImportedDatasetRecord|undefined)=>{try{if(!latest)return false;const f=latest.fields.find(f=>f.id===fieldId),id=latest.fields.find(f=>f.id===idFieldId);return !!f&&!!id&&projection(latest,f,id)===snapshot;}catch{return false;}};
 if(!current(study))throw Error('The source changed during verification. Choose and verify again.');
 return {studyId:study.id,rows,missing,snapshot,current,source:{datasetId:study.id,importedAt:study.importedAt,fieldId,fieldBinding:JSON.stringify(field),sourceColumn:field.sourceColumn,idFieldId,idBinding:JSON.stringify(idField),idSourceColumn:idField.sourceColumn,fingerprint,rowCount:study.rowCount,nonblankCount:rows.length}};
}
export function sourceMatchesCodebook(book:ResponseCodebook,source:CodingSource){const ids=new Set(source.rows.map(row=>row.id));return JSON.stringify(book.source)===JSON.stringify(source.source)&&book.responses.every(row=>ids.has(row.id));}
export function createCodebook(source:CodingSource,label:string,coders:[string,string]):ResponseCodebook{
 if(!label.trim()||!coders.every(name=>name.trim())||coders[0].trim().toLocaleLowerCase()===coders[1].trim().toLocaleLowerCase())throw Error('Name the project and give the two manual passes different nonblank names.');
 if(!globalThis.crypto?.randomUUID)throw Error('A secure coding identity cannot be created in this browser.');
 const book:ResponseCodebook={version:1,id:`coding-${crypto.randomUUID()}`,label:label.trim(),coders:coders.map(s=>s.trim()) as [string,string],revision:1,themes:[],source:structuredClone(source.source),responses:[]};assertResponseCodebooks([book]);return book;
}
export function editCodingTheme(book:ResponseCodebook,theme:CodingTheme):ResponseCodebook{if(book.themes.some(t=>t.id!==theme.id&&t.label.trim().toLocaleLowerCase()===theme.label.trim().toLocaleLowerCase()))throw Error('Each theme needs a distinct name. Choose the existing theme to edit it.');if(book.themes.length>=100&&!book.themes.some(t=>t.id===theme.id))throw Error('This coding project supports up to 100 themes.');const next=structuredClone(book),index=next.themes.findIndex(t=>t.id===theme.id);if(index<0)next.themes.push(theme);else next.themes[index]=theme;next.revision++;assertResponseCodebooks([next]);return next;}
export function setCodingPass(book:ResponseCodebook,id:string,pass:'a'|'b',themeIds:string[]):ResponseCodebook{
 const next=structuredClone(book);let response=next.responses.find(r=>r.id===id);if(!response){response={id};next.responses.push(response);}response[pass]={themeIds:[...themeIds],revision:next.revision};delete response.resolution;assertResponseCodebooks([next]);return next;
}
export function resolveCoding(book:ResponseCodebook,id:string,themeIds:string[],note:string):ResponseCodebook{
 const next=structuredClone(book),response=next.responses.find(r=>r.id===id);if(!response?.a||!response.b||response.a.revision!==next.revision||response.b.revision!==next.revision)throw Error('Review both coding passes against the current theme definitions before resolving.');
 response.resolution={themeIds:[...themeIds],note:note.trim(),a:[...response.a.themeIds],b:[...response.b.themeIds],revision:next.revision};assertResponseCodebooks([next]);return next;
}
export function applyResponseCodebook(draft:DashboardDraft,book:ResponseCodebook,expected:string|null):DashboardDraft{
 assertResponseCodebooks([book]);const previous=draft.responseCodebooks?.find(b=>b.id===book.id);if((previous?JSON.stringify(previous):null)!==expected)throw Error('Saved coding changed elsewhere. Reopen it before applying; both versions are preserved.');
 const books=[...(draft.responseCodebooks??[]).filter(b=>b.id!==book.id),structuredClone(book)];if(books.length>10)throw Error('This report supports up to 10 saved coding projects. Existing coding was not replaced.');assertResponseCodebooks(books);return {...draft,responseCodebooks:books};
}
