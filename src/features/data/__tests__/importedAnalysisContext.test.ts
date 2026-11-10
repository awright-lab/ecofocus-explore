import { describe, expect, it } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { buildImportedResultProvenance, getImportedDatasetQuerySupport, importedFieldValues, runImportedDatasetQuery } from "../importedDatasetAnalytics";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";

async function csv(text:string) {
  const parsed=await importDatasetBuffer(new TextEncoder().encode(text).buffer,"synthetic.csv");
  expect(parsed.error).toBeUndefined();return parsed.dataset!;
}
function remote(dataset:ImportedDatasetRecord,previewCount=1):ImportedDatasetRecord {
  return {...dataset,rows:[],previewRows:dataset.rows.slice(0,previewCount),remote:{provider:"netlify",projectUrl:"",bucket:"",objectPath:"synthetic.csv",uploadedAt:dataset.importedAt}};
}
describe("imported sample and filter context",()=>{
  it.each(["average","sum"] as const)("reports each group's valid sample for %s",async(metric)=>{
    const dataset=await csv('Segment,Spend\nCore,10\nCore,20\nGrowth,100\nGrowth,200\nGrowth,300\nGrowth,400\n');
    const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric,chartType:"table"});
    expect(Object.fromEntries(result.table.map(row=>[row.label,row.bases.summary]))).toEqual({Core:2,Growth:4});
    expect(Object.fromEntries(result.table.map(row=>[row.label,row.values.summary]))).toEqual(metric==="average"?{Core:15,Growth:250}:{Core:30,Growth:1000});
    expect(result.series.map(series=>series.bases)).toEqual([[4],[2]]);
    expect(buildImportedResultProvenance(result)?.baseLabel).toBe("Valid measure per cell n = 2-4");
    expect(result.weighting).toMatchObject({applied:false,label:"Unweighted"});
  });
  it("counts valid measures separately in every group and breakout, including empty cells",async()=>{
    const dataset=await csv('Segment,Region,Spend\nCore,North,10\nCore,North,20\nCore,South,invalid\nGrowth,North,100\nGrowth,South,200\nGrowth,South,300\nGrowth,South,\n,North,999\n');
    const measure={...dataset.fields[2],type:"numeric" as const,modelingRole:"candidate_measure" as const};
    const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:measure,bannerField:dataset.fields[1],metric:"average",chartType:"table"});
    const core=result.table.find(row=>row.label==="Core")!,growth=result.table.find(row=>row.label==="Growth")!;
    expect(core.bases).toEqual({north_1:2,south_2:0});expect(growth.bases).toEqual({north_1:1,south_2:2});
    expect(core.values).toEqual({north_1:15,south_2:0});expect(growth.values).toEqual({north_1:100,south_2:250});
    expect(buildImportedResultProvenance(result)?.baseLabel).toBe("Valid measure per cell n = 0-2");
  });
  it("reports only the filtered group's valid measure samples",async()=>{
    const dataset=await csv('Segment,Region,Spend\nCore,North,10\nCore,South,20\nGrowth,South,100\nGrowth,South,200\n');
    const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[2],filter:{field:dataset.fields[1],value:"South"},metric:"sum",chartType:"table"});
    expect(Object.fromEntries(result.table.map(row=>[row.label,row.bases.summary]))).toEqual({Core:1,Growth:2});
    expect(Object.fromEntries(result.table.map(row=>[row.label,row.values.summary]))).toEqual({Core:20,Growth:300});
  });
  it("keeps categorical percentage denominators at the full column sample",async()=>{
    const dataset=await csv('Segment,Region\nCore,North\nCore,North\nGrowth,North\nGrowth,North\nGrowth,North\nGrowth,North\n');
    const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:"percent_selected",chartType:"table"});
    expect(Object.fromEntries(result.table.map(row=>[row.label,row.values.summary]))).toEqual({Core:200/6,Growth:400/6});expect(result.table.every(row=>row.bases.summary===6)).toBe(true);expect(buildImportedResultProvenance(result)?.baseLabel).toBe("Sample n = 6");
  });
  it("does not advertise preview categories as complete remote filter choices",async()=>{
    const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,West\n');const compact=remote(dataset);
    expect(importedFieldValues(compact,dataset.fields[1])).toEqual([]);
    expect(getImportedDatasetQuerySupport(compact,dataset.fields[0]).executable).toBe(true);
    expect(getImportedDatasetQuerySupport(compact,dataset.fields[0],{filter:{field:dataset.fields[1],value:"North"}})).toMatchObject({executable:false,reason:expect.stringContaining("Complete filter choices are unavailable")});
  });
  it("allows server analysis to filter once complete rows have been loaded",async()=>{
    const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,West\n');const complete={...remote(dataset),rows:dataset.rows};
    expect(importedFieldValues(complete,dataset.fields[1])).toEqual(["North","South","West"]);
    const result=runImportedDatasetQuery({dataset:complete,field:dataset.fields[0],filter:{field:dataset.fields[1],value:"West"},metric:"count",chartType:"table"});expect(result.table.map(row=>[row.label,row.values.summary])).toEqual([["Yes",1]]);
  });
  it("allows a preview that actually contains every respondent to supply complete choices",async()=>{
    const dataset=await csv('Answer,Region\nYes,North\nNo,South\n');const complete=remote(dataset,2);
    expect(getImportedDatasetQuerySupport(complete,dataset.fields[0],{filter:{field:dataset.fields[1],value:"South"}}).executable).toBe(true);expect(importedFieldValues(complete,dataset.fields[1])).toEqual(["North","South"]);
  });
  it("does not claim complete local choices when respondent rows are missing",async()=>{
    const dataset=await csv('Answer,Region\nYes,North\nNo,South\n');const incomplete={...dataset,rows:dataset.rows.slice(0,1),previewRows:[]};
    expect(importedFieldValues(incomplete,dataset.fields[1])).toEqual([]);
  });
});

it("marks corrected sample bases and asks to refresh unversioned cached measure bases without mutating them",async()=>{
  const dataset=await csv('Segment,Spend\nCore,10\nCore,20\nGrowth,100\n');
  const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric:"average",chartType:"table"});
  expect(result.metadataRefs.source).toMatchObject({measureBaseScope:"cell"});
  const legacy=structuredClone(result);const source=legacy.metadataRefs.source;if(source?.kind!=="imported")throw new Error("Expected imported source");delete source.measureBaseScope;legacy.table.forEach(row=>{row.bases.summary=3;});legacy.series.forEach(series=>{series.bases=[3];});const before=structuredClone(legacy);
  expect(buildImportedResultProvenance(legacy)?.baseLabel).toBe("Sample bases need refresh; rerun analysis.");expect(legacy).toEqual(before);
});
