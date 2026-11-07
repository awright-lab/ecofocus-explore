import {vi} from "vitest";
import {importDatasetBuffer} from "../../datasetImportModel";
import {runNumericProfileJob} from "../../numericProfileJob";
import {runCategoricalProfileJob} from "../../categoricalProfileJob";
import {buildNumericProfileFromValues} from "../../importedNumericProfile";
import {buildCategoricalProfileFromValues} from "../../importedCategoricalProfile";
import type {ImportedDatasetField,ImportedDatasetRecord} from "../../../../../shared/types/dashboard";
export type ProfileKind="numeric"|"categorical";
export class HeldProfileWorker {
 onmessage:((event:MessageEvent)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
 request?:{values:string[];field?:ImportedDatasetField};terminate=vi.fn();
 postMessage(request:NonNullable<HeldProfileWorker["request"]>){this.request=request;}
 complete(){const request=this.request!;this.onmessage?.({data:{type:"complete",profile:request.field?buildCategoricalProfileFromValues(request.values,request.field):buildNumericProfileFromValues(request.values)}}as MessageEvent);}
}
export async function profileStudy(rows=5000){const csv=["Category,Amount,Tag",...Array.from({length:rows},(_,i)=>`${i%2?"B":"A"},${i%2?3:1},kept-${i}`)].join("\n"),{dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,"synthetic-profile-deadline.csv");if(!dataset)throw Error("fixture");Object.assign(dataset.fields[0],{type:"categorical",modelingRole:"candidate_dimension"});return dataset;}
export function startProfile(kind:ProfileKind,dataset:ImportedDatasetRecord,worker:HeldProfileWorker,signal:AbortSignal,onProgress?:()=>void){const options={signal,createWorker:()=>worker,onProgress};return kind==="numeric"?runNumericProfileJob(dataset,dataset.fields[1],options):runCategoricalProfileJob(dataset,dataset.fields[0],options);}
