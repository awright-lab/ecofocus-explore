import { describe, expect, it } from "vitest";
import { getCompatibleChartTypes, supportsDonutResult } from "../analyticsDisplay";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
async function result() {
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Answer\nYes\nNo\nYes\n").buffer,"synthetic.csv");
 const dataset=parsed.dataset!;return runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:"count",chartType:"table"});
}
describe("result-compatible visualizations",()=>{
 it("offers a donut only for a complete exclusive nonnegative summary",async()=>{
  const response=await result();expect(getCompatibleChartTypes(response)).toEqual(["table","vertical_bar","horizontal_bar","donut"]);
  response.table[0].values.summary=-1;expect(supportsDonutResult(response)).toBe(false);expect(getCompatibleChartTypes(response)).not.toContain("donut");
 });
 it("does not offer a donut for overlapping or incomplete percentages",async()=>{
  const response=await result();response.metric={id:"percent_selected",label:"Percent",valueFormat:"percent"};
  response.table.forEach(row=>{row.values.summary=80;});expect(getCompatibleChartTypes(response)).not.toContain("donut");
  response.table.forEach(row=>{row.values.summary=10;});expect(getCompatibleChartTypes(response)).not.toContain("donut");
 });
 it("offers measure-safe single-column charts for averages and sums",async()=>{
  for(const metric of ["average","sum"] as const) {const response=await result();response.metric={id:metric,label:metric,valueFormat:"number"};expect(getCompatibleChartTypes(response)).toEqual(["table","vertical_bar","horizontal_bar"]);}
 });
});
