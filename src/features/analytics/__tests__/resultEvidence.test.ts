import { expect, it } from "vitest";
import { buildResultEvidence } from "../resultEvidence";
import { analysisSettingsMatch } from "../../../../shared/analytics/queryFreshness";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import type { AnalyticsQueryResponse, Metric } from "../../../../shared/types/analytics";
function tile(result: AnalyticsQueryResponse) { const value=structuredClone(initialDashboard.pages[0].tiles[0]);value.result=result;value.query=structuredClone(result.query);return value; }
async function result(metric: Metric="average", banner=false) {
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Region,Spend,Audience\nNorth,10,A\nNorth,invalid,B\nSouth,30,A\nSouth,,B\n").buffer,"synthetic-evidence.csv"),dataset=parsed.dataset!;dataset.fields[1].type="numeric";dataset.fields[1].modelingRole="candidate_measure";
 return runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:metric==="average"||metric==="sum"?dataset.fields[1]:undefined,bannerField:banner?dataset.fields[2]:undefined,metric,chartType:"table"});
}
function fact(view: ReturnType<typeof buildResultEvidence>,label:string){return view?.facts.find(item=>item.label===label)?.value;}
it("explains a stored numeric cell with its valid base without inventing a total or data version",async()=>{
 const response=await result();delete response.calculationInputs;const value=tile(response),before=structuredClone(value),row=response.table.find(item=>item.label==="North")!,view=buildResultEvidence(value,row.optionId,response.columns[0].id);
 expect(fact(view,"Stored value")).toBe("10");expect(fact(view,"Valid numeric observations in this cell")).toBe("1");expect(fact(view,"Numeric total")).toBe("Not stored separately");expect(fact(view,"Data version")).toBe("No immutable content version recorded");expect(fact(view,"Study import event")).toBe(response.query.sourceIdentity?.kind==="imported"?response.query.sourceIdentity.datasetImportedAt:undefined);expect(view?.warnings.some(item=>item.includes("Skipped 2 rows"))).toBe(true);expect(value).toEqual(before);
});
it("does not present a zero mean when the selected cell has no valid observations",async()=>{
 const response=await result("average",true),row=response.table.find(item=>item.label==="South")!,column=response.columns.find(item=>item.label==="B")!,view=buildResultEvidence(tile(response),row.optionId,column.id);
 expect(view?.status).toBe("unavailable");expect(fact(view,"Stored value")).toContain("no valid observations");expect(fact(view,"Valid numeric observations in this cell")).toBe("0");
});
it("withholds legacy imported measure bases until rerun",async()=>{
 const response=await result();if(response.metadataRefs.source?.kind==="imported")delete response.metadataRefs.source.measureBaseScope;
 const view=buildResultEvidence(tile(response),response.table[0].optionId,response.columns[0].id);expect(view?.status).toBe("unavailable");expect(fact(view,"Stored value")).toContain("rerun");expect(fact(view,"Recorded base")).toBe("Unverified; rerun analysis");
});
it("shows rounded percentages without reconstructing exact response numerators",async()=>{
 const response=await result("percent_selected");delete response.calculationInputs;const view=buildResultEvidence(tile(response),response.table[0].optionId,response.columns[0].id);
 expect(fact(view,"Exact numerator")).toBe("Not stored separately");expect(view?.explanation).toContain("cannot be recovered");expect(fact(view,"Recorded base")).toBe("4");
});
it("distinguishes weighted totals from respondent sample sizes",()=>{
 const value=structuredClone(initialDashboard.pages[0].tiles[0]);value.result.weighting={applied:true,id:"weightvar",label:"Population weights"};value.result.query.weight="weightvar";value.query=structuredClone(value.result.query);
 const view=buildResultEvidence(value,value.result.table[0].optionId,value.result.columns[0].id);expect(fact(view,"Weighting")).toContain("not respondent sample sizes");expect(fact(view,"Recorded weighted base total")).toBe(String(value.result.table[0].bases[value.result.columns[0].id]));expect(view?.warnings.join(" ")).toContain("unweighted respondent sample size");expect(fact(view,"Statistical testing")).toBe("Significance unavailable");
});
it("does not call an unconfirmed requested weight applied or unweighted",()=>{
 const value=structuredClone(initialDashboard.pages[0].tiles[0]);value.result.weighting={applied:false,id:null,label:"Unweighted"};value.result.query.weight="weightvar";value.query=structuredClone(value.result.query);
 const view=buildResultEvidence(value,value.result.table[0].optionId,value.result.columns[0].id);expect(fact(view,"Weighting")).toContain("not confirmed");expect(fact(view,"Recorded base (weighting unverified)")).toBeDefined();
});
it("explains the executed settings when current edits are stale",async()=>{
 const response=await result(),value=tile(response);value.query.metric="count";const view=buildResultEvidence(value,response.table[0].optionId,response.columns[0].id);expect(view?.settingsCurrent).toBe(false);expect(fact(view,"Metric")).toContain("Average");
});
it("preserves literal imported filter values including all",async()=>{
 const response=await result();if(response.metadataRefs.source?.kind==="imported"){response.metadataRefs.source.filterFieldLabel="Audience";response.metadataRefs.source.filterValue="all";}
 expect(fact(buildResultEvidence(tile(response),response.table[0].optionId,response.columns[0].id),"Filter")).toBe("Audience is all");
});
it("does not explain missing rows or columns as the first available cell",async()=>{
 const response=await result();expect(buildResultEvidence(tile(response),"missing",response.columns[0].id)).toBeNull();expect(buildResultEvidence(tile(response),response.table[0].optionId,"missing")).toBeNull();
});
it("marks invalid saved bases unavailable rather than inventing sample sizes",async()=>{
 const response=await result();response.table[0].bases[response.columns[0].id]=NaN;const view=buildResultEvidence(tile(response),response.table[0].optionId,response.columns[0].id);expect(view?.status).toBe("unavailable");expect(fact(view,"Valid numeric observations in this cell")).toBe("Not recorded as a valid base");
});
it("treats chart choice as cosmetic but preserves wave ordering in freshness checks",()=>{
 const value=structuredClone(initialDashboard.pages[0].tiles[0].query);expect(analysisSettingsMatch({...value,chartType:"table"},{...value,chartType:"horizontal_bar"})).toBe(true);
 expect(analysisSettingsMatch({...value,comparisonMode:"wave",comparisonDatasets:["ecofocus_2023","ecofocus_2024"]},{...value,comparisonMode:"wave",comparisonDatasets:["ecofocus_2024","ecofocus_2023"]})).toBe(false);
});

it("does not describe a weighted mean as division by unweighted observations",async()=>{
 const response=await result(),value=tile(response);response.weighting={applied:true,id:"weightvar",label:"Population weights"};response.query.weight="weightvar";value.query=structuredClone(response.query);
 const view=buildResultEvidence(value,response.table[0].optionId,response.columns[0].id);expect(view?.explanation).toContain("weighted values and weighting totals");expect(view?.explanation).not.toContain("divides the numeric total by the valid observations");
});
it("keeps a renamed canvas label separate from the recorded source row",async()=>{
 const response=await result(),value=tile(response);value.appearance.axisLabelOverrides[response.table[0].optionId]="Renamed audience";
 const view=buildResultEvidence(value,response.table[0].optionId,response.columns[0].id);expect(fact(view,"Row")).toBe(response.table[0].label);expect(fact(view,"Canvas row label")).toBe("Renamed audience");
});
it.each(['rows','columns']as const)('does not explain ambiguous duplicate %s identities',async kind=>{const response=await result('count');if(kind==='rows')response.table[1].optionId=response.table[0].optionId;else response.columns=[response.columns[0],{...response.columns[0],label:'Different audience'}];const value=tile(response),before=structuredClone(value);expect(buildResultEvidence(value,response.table[0].optionId,response.columns[0].id)).toBeNull();expect(value).toEqual(before);});
it.each(['constructor','__proto__','toString'])('treats inherited %s properties as absent row overrides',async id=>{const response=await result('count');response.table[0].optionId=id;const value=tile(response),before=structuredClone(value);const view=buildResultEvidence(value,id,response.columns[0].id);expect(view?.facts.find(fact=>fact.label==='Row')?.value).toBe(response.table[0].label);expect(view?.facts.some(fact=>fact.label==='Canvas row label')).toBe(false);expect(value).toEqual(before);});
it.each(['constructor','__proto__','toString'])('preserves an explicit own %s label override',async id=>{const response=await result('count');response.table[0].optionId=id;const value=tile(response);value.appearance.axisLabelOverrides=JSON.parse(`{"${id}":"Edited label"}`);const before=structuredClone(value);expect(buildResultEvidence(value,id,response.columns[0].id)?.facts.find(fact=>fact.label==='Canvas row label')?.value).toBe('Edited label');expect(value).toEqual(before);});
