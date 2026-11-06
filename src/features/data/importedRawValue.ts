import type { ImportedDatasetField } from "../../../shared/types/dashboard";
export function importedRawFieldValue(row:Record<string,string>, field:ImportedDatasetField|null|undefined) {
 if(!field)return "";
 if(Object.hasOwn(row,field.sourceColumn))return row[field.sourceColumn]??"";
 const key=Object.keys(row).find(key=>key.toLowerCase()===field.sourceColumn.toLowerCase());
 return key ? row[key]??"" : "";
}
