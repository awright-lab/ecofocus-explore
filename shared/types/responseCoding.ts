export interface CodingTheme { id:string; label:string; guidance:string }
export interface CodingPass { themeIds:string[]; revision:number }
export interface CodingResolution { themeIds:string[]; note:string; a:string[]; b:string[]; revision:number }
export interface CodedResponse { id:string; a?:CodingPass; b?:CodingPass; resolution?:CodingResolution }
export interface ResponseCodebook {
 version:1; id:string; label:string; revision:number; coders:[string,string]; themes:CodingTheme[];
 source:{datasetId:string; importedAt:string; fieldId:string; fieldBinding:string; sourceColumn:string; idFieldId:string; idBinding:string; idSourceColumn:string; fingerprint:string; rowCount:number; nonblankCount:number};
 responses:CodedResponse[];
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const integer=(v:unknown,min:number,max:number)=>Number.isInteger(v)&&(v as number)>=min&&(v as number)<=max;
export function assertResponseCodebooks(value:unknown):asserts value is ResponseCodebook[]|undefined{
 if(value===undefined)return;
 const fail=()=>{throw Error('The saved response coding is incomplete, conflicting or damaged. Saved data has not been changed.');};
 if(!Array.isArray(value)||value.length>10)fail();
 const ids=new Set<string>();
 for(const item of value as unknown[]){
  if(!object(item)||item.version!==1||!text(item.id,160)||ids.has(item.id as string)||!text(item.label,160)||!integer(item.revision,1,1000000)||!Array.isArray(item.coders)||item.coders.length!==2||!item.coders.every(v=>text(v,80))||new Set(item.coders.map(v=>(v as string).trim().toLocaleLowerCase())).size!==2||!Array.isArray(item.themes)||item.themes.length>100||!object(item.source)||!Array.isArray(item.responses)||item.responses.length>50000)fail();
  const book=item as unknown as ResponseCodebook;ids.add(book.id);const source=book.source;
  if(!['datasetId','importedAt','fieldId','sourceColumn','idFieldId','idSourceColumn'].every(key=>text(source[key as keyof typeof source],256))||!Number.isFinite(Date.parse(source.importedAt))||source.fieldId===source.idFieldId||source.sourceColumn===source.idSourceColumn||!text(source.fieldBinding,200000)||!text(source.idBinding,200000)||!/^[a-f0-9]{64}$/.test(source.fingerprint)||!integer(source.rowCount,1,50000)||!integer(source.nonblankCount,1,source.rowCount))fail();
  for(const [binding,id,column]of [[source.fieldBinding,source.fieldId,source.sourceColumn],[source.idBinding,source.idFieldId,source.idSourceColumn]]){let parsed:unknown;try{parsed=JSON.parse(binding);}catch{fail();}if(!object(parsed)||parsed.id!==id||parsed.sourceColumn!==column)fail();}
  const themeIds=new Set<string>(),labels=new Set<string>();for(const theme of book.themes){if(!object(theme)||!text(theme.id,160)||themeIds.has(theme.id)||!text(theme.label,120)||labels.has(theme.label.trim().toLocaleLowerCase())||typeof theme.guidance!=='string'||theme.guidance.length>2000)fail();themeIds.add(theme.id);labels.add(theme.label.trim().toLocaleLowerCase());}
  const validIds=(values:unknown):values is string[]=>Array.isArray(values)&&values.length<=100&&values.every(id=>typeof id==='string'&&themeIds.has(id))&&new Set(values).size===values.length;
  const validPass=(pass:unknown)=>object(pass)&&integer(pass.revision,1,book.revision)&&validIds(pass.themeIds);
  const same=(a:string[],b:string[])=>a.length===b.length&&a.every(id=>b.includes(id));
  const respondents=new Set<string>();
  for(const response of book.responses){if(!object(response)||!text(response.id,256)||response.id!==response.id.trim()||respondents.has(response.id)||(!response.a&&!response.b)||(response.a!==undefined&&!validPass(response.a))||(response.b!==undefined&&!validPass(response.b)))fail();respondents.add(response.id);
   const r=response.resolution;if(r!==undefined&&(!object(r)||!validIds(r.themeIds)||!text(r.note,1000)||!integer(r.revision,1,book.revision)||!response.a||!response.b||response.a.revision!==r.revision||response.b.revision!==r.revision||!validIds(r.a)||!validIds(r.b)||!same(r.a,response.a.themeIds)||!same(r.b,response.b.themeIds)))fail();
  }
  if(respondents.size>source.nonblankCount)fail();
 }
}
