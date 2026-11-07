export type AudienceExpression =
 | { kind:"group"; match:"all"|"any"; exclude:boolean; children:AudienceExpression[] }
 | { kind:"category"; fieldId:string; sourceColumn:string; exclude:boolean; values:string[] }
 | { kind:"range"; fieldId:string; sourceColumn:string; exclude:boolean; min:number|null; max:number|null }
 | { kind:"blank"; fieldId:string; sourceColumn:string; exclude:boolean };
export interface SavedImportedAudience {
 version:1;
 id:string;
 label:string;
 datasetId:string;
 importedAt:string;
 expression:AudienceExpression;
}
