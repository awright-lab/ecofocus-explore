import { describe, expect, it } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { getImportedDatasetQuerySupport, importedFieldValues, runImportedDatasetQuery } from "../importedDatasetAnalytics";
import { parseImportedNumber } from "../importedNumericValue";
import type { ImportedDatasetField } from "../../../../shared/types/dashboard";

async function csv(text: string) {
  const result = await importDatasetBuffer(new TextEncoder().encode(text).buffer, "synthetic.csv");
  expect(result.error).toBeUndefined();
  return result.dataset!;
}
function categorical(field: ImportedDatasetField, valueLabels?: Record<string,string>): ImportedDatasetField {
  return { ...field, type: "categorical", modelingRole: "candidate_dimension", eligibleForFilter: true, eligibleForBanner: true, valueLabels };
}

describe("imported numeric and categorical accuracy", () => {
  it.each([
    ["$10",10], ["-$10",-10], ["$-10",-10], ["$1,234.50",1234.5], ["20%",20], ["0",0], ["1e3",1000],
    ["",null], ["  ",null], ["$",null], ["12invalid",null], ["Infinity",null]
  ])("parses the full supported numeric token %s as %s", (raw,expected) => {
    expect(parseImportedNumber(String(raw))).toBe(expected);
  });
  it("includes mixed plain and currency values in sums and averages without changing raw rows", async () => {
    const dataset = await csv('Segment,Spend\nCore,$10\nCore,20\nGrowth,$100\nGrowth,"$1,000"\n');
    expect(dataset.fields[1].type).toBe("numeric");
    const before = structuredClone(dataset);
    for (const metric of ["sum","average"] as const) {
      const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], measureField: dataset.fields[1], metric, chartType: "table" });
      const values = Object.fromEntries(result.table.map(row => [row.label,row.values.summary]));
      expect(values).toEqual(metric === "sum" ? { Core:30, Growth:1100 } : { Core:15, Growth:550 });
      expect(result.warnings).toEqual([]);
    }
    expect(dataset).toEqual(before);
  });
  it("does not parse invalid prefixes as numbers or blanks as zero, and reports excluded measures", async () => {
    const dataset = await csv('Segment,Spend\nCore,12invalid\nCore,20\nCore,\nCore,0\n');
    const measure = { ...dataset.fields[1], type: "numeric" as const, modelingRole: "candidate_measure" as const };
    const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], measureField: measure, metric: "sum", chartType: "table" });
    expect(result.table[0].values.summary).toBe(20);
    expect(result.table[0].bases.summary).toBe(2);
    expect(result.warnings).toContain("Skipped 2 rows without a valid numeric value for Spend.");
  });
  it("keeps declared zero-response choices and observed unlabeled codes in the same output", async () => {
    const dataset = await csv('Answer,Region\n1,North\n2,North\n9,North\n');
    const field = categorical(dataset.fields[0], { "1":"Yes", "2":"No", "3":"Maybe" });
    const count = runImportedDatasetQuery({ dataset, field, metric:"count", chartType:"table" });
    expect(count.table.map(row => [row.label,row.values.summary])).toEqual([["Yes",1],["No",1],["Maybe",0],["9",1]]);
    expect(count.table.reduce((n,row) => n + row.values.summary,0)).toBe(dataset.rowCount);
    expect(count.table.every(row => row.bases.summary === 3)).toBe(true);
    const percent = runImportedDatasetQuery({ dataset, field, metric:"percent_selected", chartType:"table" });
    expect(percent.table.map(row => row.values.summary)).toEqual([100/3,100/3,0,100/3]);
  });
  it("counts distinct codes with duplicate label text once each and visibly identifies their codes", async () => {
    const dataset = await csv('Answer,Region\n1,North\n2,North\n2,North\n');
    const field = categorical(dataset.fields[0], { "1":"Yes", "2":"Yes" });
    const result = runImportedDatasetQuery({ dataset, field, metric:"count", chartType:"table" });
    expect(result.table.map(row => [row.label,row.values.summary])).toEqual([["Yes [1]",1],["Yes [2]",2]]);
    expect(new Set(result.table.map(row => row.optionId)).size).toBe(2);
    expect(result.table.reduce((n,row) => n + row.values.summary,0)).toBe(3);
  });
  it("keeps an unlabeled raw code separate when its text matches a declared label", async () => {
    const dataset = await csv('Answer,Region\n1,North\nYes,North\n');
    const result = runImportedDatasetQuery({ dataset, field:categorical(dataset.fields[0],{"1":"Yes"}), metric:"count", chartType:"table" });
    expect(result.table.map(row => [row.label,row.values.summary])).toEqual([["Yes [1]",1],["Yes [Yes]",1]]);
  });
  it("preserves numeric label aliases used by SAV values", async () => {
    const dataset = await csv('Answer,Region\n1,North\n1.0,North\n2,North\n');
    const result = runImportedDatasetQuery({ dataset, field:categorical(dataset.fields[0],{"1":"Yes","2":"No"}), metric:"count", chartType:"table" });
    expect(result.table.map(row => [row.label,row.values.summary])).toEqual([["Yes",2],["No",1]]);
  });
  it("keeps duplicate breakout labels and filter choices separate by code", async () => {
    const dataset = await csv('Answer,Region\nYes,1\nNo,2\nYes,2\n');
    const region = categorical(dataset.fields[1], { "1":"Group", "2":"Group" });
    expect(importedFieldValues(dataset,region)).toEqual(["Group [1]","Group [2]"]);
    const full = runImportedDatasetQuery({ dataset, field:dataset.fields[0], bannerField:region, metric:"count", chartType:"table" });
    expect(full.columns.map(column => column.label)).toEqual(["Group [1]","Group [2]"]);
    expect(full.table.reduce((n,row) => n + Object.values(row.values).reduce((a,b) => a+b,0),0)).toBe(3);
    const filtered = runImportedDatasetQuery({ dataset, field:dataset.fields[0], filter:{field:region,value:"Group [2]"}, metric:"count", chartType:"table" });
    expect(filtered.table.reduce((n,row) => n + row.values.summary,0)).toBe(2);
    expect(() => runImportedDatasetQuery({ dataset, field:dataset.fields[0], filter:{field:region,value:"Group"}, metric:"count", chartType:"table" })).toThrow("multiple source codes");
  });
  it("keeps missing breakout values separate from a literal '(blank)' category", async () => {
    const dataset = await csv('Answer,Region\nYes,\nNo,(blank)\n');
    const region = categorical(dataset.fields[1]);
    expect(importedFieldValues(dataset,region)).toEqual(["(blank) [(blank)]","(blank) [missing]"]);
    const result = runImportedDatasetQuery({ dataset, field:dataset.fields[0], bannerField:region, metric:"count", chartType:"table" });
    expect(result.columns).toHaveLength(2);
    expect(result.table.reduce((n,row) => n + Object.values(row.values).reduce((a,b)=>a+b,0),0)).toBe(2);
  });
  it("allows the literal filter value all while null remains the no-filter configuration", async () => {
    const dataset = await csv('Answer,Region\nYes,all\nNo,North\nYes,all\n');
    const filter = { field:dataset.fields[1], value:"all" };
    expect(getImportedDatasetQuerySupport(dataset,dataset.fields[0],{filter,metric:"count",chartType:"table"}).executable).toBe(true);
    const result = runImportedDatasetQuery({dataset,field:dataset.fields[0],filter,metric:"count",chartType:"table"});
    expect(result.table.map(row=>[row.label,row.values.summary])).toEqual([["Yes",2]]);
    expect(result.metadataRefs.source).toMatchObject({kind:"imported",filterValue:"all"});
    const unfiltered = runImportedDatasetQuery({dataset,field:dataset.fields[0],filter:null,metric:"count",chartType:"table"});
    expect(unfiltered.table.reduce((n,row)=>n+row.values.summary,0)).toBe(3);
  });
});

it("does not alias unrelated nonnumeric codes through a NaN value label", async () => {
  const dataset = await csv('Answer,Region\nA,North\nB,North\nNaN,North\n');
  const result = runImportedDatasetQuery({dataset,field:categorical(dataset.fields[0],{NaN:"Missing code"}),metric:"count",chartType:"table"});
  expect(result.table.map(row=>[row.label,row.values.summary])).toEqual([["Missing code",1],["A",1],["B",1]]);
});
it("keeps disambiguated captions stable when filtering removes the colliding raw category", async () => {
  const dataset=await csv('Answer,Region\n1,North\nYes,South\n');const field=categorical(dataset.fields[0],{"1":"Yes"});
  const result=runImportedDatasetQuery({dataset,field,filter:{field:dataset.fields[1],value:"North"},metric:"count",chartType:"table"});
  expect(result.table.map(row=>[row.label,row.values.summary])).toEqual([["Yes [1]",1]]);
});
it("keeps ordinary raw codes that match JavaScript object property names", async () => {
  const dataset=await csv('Answer,Region\n__proto__,North\nconstructor,North\n');
  const result=runImportedDatasetQuery({dataset,field:categorical(dataset.fields[0],{"1":"Yes"}),metric:"count",chartType:"table"});
  expect(result.table.reduce((n,row)=>n+row.values.summary,0)).toBe(2);
  expect(result.table.filter(row=>row.values.summary>0).map(row=>row.label).sort()).toEqual(['__proto__','constructor']);
});
