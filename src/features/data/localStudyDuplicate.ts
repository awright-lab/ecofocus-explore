import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";

export const localDuplicateLimits = { studies: 1000, visits: 250_000, characters: 8 * 1024 * 1024, depth: 16 } as const;
const storageNote = "Stored compactly in report drafts; full imported rows are kept at workspace level.";
const omitted = new Set(["id", "importedAt", "sourceRef", "importStatus", "previewRows", "rows"]);
type Summary = Pick<ImportedDatasetRecord,"id"|"title"|"fileName"|"importedAt"|"rowCount"|"fieldCount">;
export type LocalDuplicateResult = { status: "match"; study: Summary } | { status: "no_match" } | { status: "unverified"; reason: string };
class Unverified extends Error {}

/** Exact bounded comparison, not a content hash, source authentication or save-capacity check. */
export function checkLocalStudyDuplicate(candidate: ImportedDatasetRecord, studies: readonly ImportedDatasetRecord[]): LocalDuplicateResult {
  let visits=0,characters=0;
  function budget(text="") { if(++visits>localDuplicateLimits.visits||(characters+=text.length)>localDuplicateLimits.characters)throw new Unverified('The existing-copy check reached its local comparison budget. No study was added by this check.'); }
  function own(object: object,key: PropertyKey): unknown {
    budget(typeof key==='string'?key:'');const descriptor=Object.getOwnPropertyDescriptor(object,key);
    if(!descriptor)return undefined;
    if(!('value'in descriptor)||(!descriptor.enumerable&&!(Array.isArray(object)&&key==='length')))throw new Unverified('The existing-copy check cannot inspect accessor or hidden data.');
    return descriptor.value;
  }
  function keys(object: object,omitUndefined=true): string[] {
    const proto=Object.getPrototypeOf(object);
    if(proto!==Object.prototype&&proto!==null&&!(Array.isArray(object)&&proto===Array.prototype))throw new Unverified('Only plain local study data can be compared.');
    const names=Reflect.ownKeys(object);if(names.length>localDuplicateLimits.visits-visits)throw new Unverified('The existing-copy check reached its local comparison budget.');
    if(names.some(key=>typeof key!=='string'))throw new Unverified('Symbol data cannot be compared as a saved local study.');
    return (names as string[]).filter(key=>{const value=own(object,key);return !(Array.isArray(object)&&key==='length')&&(!omitUndefined||value!==undefined);});
  }
  function equal(a:unknown,b:unknown,depth=0):boolean {
    budget();if(depth>localDuplicateLimits.depth)throw new Unverified('Study metadata exceeds the comparison depth limit.');
    if(a===null||b===null)return a===b;
    if(typeof a!==typeof b)return false;
    if(typeof a==='string'){budget(a);budget(b as string);return a===b;}
    if(typeof a==='number'){if(!Number.isFinite(a)||!Number.isFinite(b as number))throw new Unverified('Nonfinite study metadata cannot be compared.');return Object.is(a,b);}
    if(typeof a==='boolean'||typeof a==='undefined')return a===b;
    if(typeof a!=='object'||typeof b!=='object')throw new Unverified('Only saved data values can be compared.');
    if(Array.isArray(a)!==Array.isArray(b)||Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return false;
    if(Array.isArray(a)){
      const length=own(a,'length');if(typeof length!=='number'||length!==own(b!,'length'))return false;
      if(length>localDuplicateLimits.visits-visits)throw new Unverified('The existing-copy check reached its local comparison budget.');
      const ak=keys(a),bk=keys(b!);if(ak.length!==length||bk.length!==length)throw new Unverified('Sparse or annotated arrays cannot be compared.');
      for(let i=0;i<length;i++){if(ak[i]!==String(i)||bk[i]!==String(i))throw new Unverified('Sparse arrays cannot be compared.');if(!equal(own(a,String(i)),own(b!,String(i)),depth+1))return false;}return true;
    }
    const ak=keys(a),bk=keys(b!);if(ak.length!==bk.length||ak.some((key,index)=>key!==bk[index]))return false;
    for(const key of ak)if(!equal(own(a,key),own(b!,key),depth+1))return false;return true;
  }
  function eligible(study:ImportedDatasetRecord):boolean {
    keys(study);
    const fileType=own(study,'fileType');
    if(own(study,'sourceType')!=='local_file'||(fileType!=='csv'&&fileType!=='xlsx'&&fileType!=='sav')||own(study,'remote')!==undefined||own(study,'preparation')!==undefined)return false;
    const count=own(study,'rowCount'),fieldCount=own(study,'fieldCount'),rows=own(study,'rows'),fields=own(study,'fields');
    if(!Number.isSafeInteger(count)||Number(count)<=0||!Number.isSafeInteger(fieldCount)||Number(fieldCount)<=0||!Array.isArray(rows)||own(rows,'length')!==count||!Array.isArray(fields)||own(fields,'length')!==fieldCount)return false;
    if(typeof own(study,'id')!=='string'||typeof own(study,'title')!=='string'||typeof own(study,'fileName')!=='string'||typeof own(study,'importedAt')!=='string')return false;
    const ref=own(study,'sourceRef');
    if(ref!==undefined){if(!ref||typeof ref!=='object')return false;const expected:Record<string,unknown>={id:`imported:${own(study,'id')}`,kind:'imported_file',provider:'local_file',label:own(study,'title'),datasetId:own(study,'id')};const names=keys(ref);if(names.some(key=>!Object.hasOwn(expected,key)||own(ref,key)!==expected[key])||Object.keys(expected).some(key=>own(ref,key)!==expected[key]))return false;}
    const status=own(study,'importStatus');
    if(status!==undefined){if(!status||typeof status!=='object')return false;if(keys(status).some(key=>!['status','label','detail','updatedAt'].includes(key))||typeof own(status,'updatedAt')!=='string'||own(status,'status')!=='local_ready'||own(status,'label')!=='Stored locally'||own(status,'detail')!=='This imported dataset is stored in the local workspace.')return false;}
    return true;
  }
  function metadata(study:ImportedDatasetRecord){
    return Object.fromEntries(keys(study).filter(key=>!omitted.has(key)).sort().map(key=>{
      const value=own(study,key);
      if(key!=='notes')return[key,value];
      if(!Array.isArray(value))throw new Unverified('Study notes cannot be compared.');
      const noteKeys=keys(value);if(noteKeys.length!==own(value,'length'))throw new Unverified('Sparse study notes cannot be compared.');
      return[key,noteKeys.map(k=>own(value,k)).filter(note=>note!==storageNote)];
    }));
  }
  function rowsEqual(a:ImportedDatasetRecord,b:ImportedDatasetRecord){
    const left=own(a,'rows') as object[],right=own(b,'rows') as object[],length=own(left,'length')as number;
    if(length>localDuplicateLimits.visits-visits)throw new Unverified('The existing-copy check reached its local comparison budget.');
    // Do not enumerate a million-row array before checking the bounded budget.
    const lk=keys(left),rk=keys(right);if(lk.length!==length||rk.length!==length)throw new Unverified('Sparse or annotated respondent arrays cannot be compared.');
    for(let i=0;i<length;i++){
      if(lk[i]!==String(i)||rk[i]!==String(i))throw new Unverified('Sparse respondent arrays cannot be compared.');
      const ar=own(left,String(i)),br=own(right,String(i));if(!ar||!br||typeof ar!=='object'||typeof br!=='object'||Array.isArray(ar)||Array.isArray(br))throw new Unverified('Only complete plain respondent rows can be compared.');
      if(Object.getPrototypeOf(ar)!==Object.getPrototypeOf(br))return false;
      const ak=keys(ar,false),bk=keys(br,false);if(ak.length!==bk.length||ak.some((key,j)=>key!==bk[j]))return false;
      for(const key of ak){const av=own(ar,key),bv=own(br,key);if(typeof av!=='string'||typeof bv!=='string')throw new Unverified('Only original string respondent values can be compared.');budget(av);budget(bv);if(av!==bv)return false;}
    }return true;
  }
  try {
    if(!eligible(candidate))return{status:'unverified',reason:'Only complete, unprepared local CSV, Excel or SPSS studies with their ordinary local source metadata can be checked.'};
    if(!Array.isArray(studies))return{status:'unverified',reason:'The current study library is unavailable.'};
    if(studies.length>localDuplicateLimits.studies)return{status:'unverified',reason:'The current library exceeds the 1,000-study comparison limit.'};
    const reference=metadata(candidate);
    for(let i=0;i<studies.length;i++){
      const study=own(studies,String(i));if(!study||typeof study!=='object')throw new Unverified('The study library is incomplete.');
      const current=study as ImportedDatasetRecord;if(!eligible(current))continue;
      if(own(candidate,'title')!==own(current,'title')||own(candidate,'fileName')!==own(current,'fileName')||own(candidate,'rowCount')!==own(current,'rowCount')||own(candidate,'fieldCount')!==own(current,'fieldCount'))continue;
      if(equal(reference,metadata(current))&&rowsEqual(candidate,current))return{status:'match',study:{id:current.id,title:current.title,fileName:current.fileName,importedAt:current.importedAt,rowCount:current.rowCount,fieldCount:current.fieldCount}};
    }return{status:'no_match'};
  }catch(error){return{status:'unverified',reason:error instanceof Unverified?error.message:'The existing-copy check could not verify this data. No data was changed.'};}
}

/** The ordinary browser-local Excel/SPSS records covered by copy review. */
export function isLocalFileCopyCandidate(study:ImportedDatasetRecord){
 return study.sourceType==='local_file'&&!study.remote&&!study.preparation&&(study.fileType==='xlsx'||study.fileType==='sav')&&study.rowCount>0&&study.rows.length===study.rowCount;
}
