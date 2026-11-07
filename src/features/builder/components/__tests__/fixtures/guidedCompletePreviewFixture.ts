import {importDatasetBuffer} from "../../../../data/datasetImportModel";
export async function completePreviewStudy(rows=1000,fields=4){
 const headers=["Answer","Group","Amount","Filter",...Array.from({length:Math.max(0,fields-4)},(_,i)=>`Unrelated${i}`)];
 const records=Array.from({length:rows},(_,i)=>[`R${String(i%35).padStart(2,"0")}`,`G${String(Math.floor(i/35)%10).padStart(2,"0")}`,String(i+1),i%2?"Other":"Keep",...headers.slice(4).map((_,column)=>`PRIVATE-${i}-${column}`)]);
 const{dataset}=await importDatasetBuffer(new TextEncoder().encode([headers.join(","),...records.map(row=>row.join(","))].join("\n")).buffer,"synthetic-complete-preview.csv");if(!dataset)throw Error("Fixture");for(const index of[0,1,3])Object.assign(dataset.fields[index],{type:"categorical",modelingRole:"candidate_dimension",eligibleForBanner:true,eligibleForFilter:true});
 return {dataset,count:(answer:string,group:string,filter?:string)=>records.filter(row=>row[0]===answer&&row[1]===group&&(!filter||row[3]===filter)).length,base:(group:string,filter?:string)=>records.filter(row=>row[1]===group&&(!filter||row[3]===filter)).length};
}
