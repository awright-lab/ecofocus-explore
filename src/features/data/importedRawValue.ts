import type { ImportedDatasetField } from "../../../shared/types/dashboard";
export class ImportedSourceColumnAmbiguityError extends Error {
 constructor(column:string){super(`Ambiguous source column ${JSON.stringify(column.slice(0,120))}: more than one stored column matches apart from letter case. Choose an exact source mapping or re-import; stored data was kept.`);this.name='ImportedSourceColumnAmbiguityError';}
}
export function importedRawFieldValue(row:Record<string,string>, field:ImportedDatasetField|null|undefined) {
 if(!field)return "";
 if(Object.hasOwn(row,field.sourceColumn))return row[field.sourceColumn]??"";
 const lower=field.sourceColumn.toLowerCase();let found:string|undefined;
 for(const key of Object.keys(row))if(key.toLowerCase()===lower){
  if(found!==undefined)throw new ImportedSourceColumnAmbiguityError(field.sourceColumn);
  found=key;
 }
 return found!==undefined ? row[found]??"" : "";
}
