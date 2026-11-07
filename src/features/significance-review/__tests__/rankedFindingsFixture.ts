import { importDatasetBuffer } from '../../data/datasetImportModel';
import { initialDashboard } from '../../document/documentSeeds';
import { comparisonContextBinding, runComparisonReview, type ComparisonReviewContext } from '../comparisonReviewModel';

export interface GroupSpec {code:string;events:number;others:number;missing?:number;excluded?:number;label?:string}
export async function findingsFixture(specs:GroupSpec[]=[{code:'Ref',events:50,others:50},{code:'A',events:80,others:20},{code:'B',events:70,others:30},{code:'Small',events:9,others:1}]) {
  const rows:string[]=[];
  const escape=(text:string)=>/[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  for(const spec of specs)for(const [outcome,count]of [['Y',spec.events],['N',spec.others],['',spec.missing??0],['DK',spec.excluded??0]]as const)for(let i=0;i<count;i++)rows.push(`${rows.length+1},${escape(spec.code)},${outcome}`);
  const {dataset}=await importDatasetBuffer(new TextEncoder().encode(['ID,Group,Outcome',...rows].join('\n')).buffer,'synthetic-ranked-findings.csv');
  if(!dataset)throw Error('fixture import');
  for(const field of dataset.fields.slice(1)){field.type='categorical';field.modelingRole='candidate_dimension';}
  dataset.fields[1].valueLabels=Object.fromEntries(specs.map(spec=>[spec.code,spec.label??spec.code]));dataset.fields[2].valueLabels={Y:'Event',N:'Other',DK:'Exclude'};
  const draft=structuredClone(initialDashboard);draft.id='ranked-finding-test';draft.importedDatasets=[dataset];draft.savedAudiences=[];
  const ctx:ComparisonReviewContext={draft,studies:[dataset],plan:{reportId:draft.id,datasetId:dataset.id,importedAt:dataset.importedAt,idFieldId:dataset.fields[0].id,idBinding:JSON.stringify(dataset.fields[0]),groupFieldId:dataset.fields[1].id,groupBinding:JSON.stringify(dataset.fields[1]),outcomeFieldId:dataset.fields[2].id,outcomeBinding:JSON.stringify(dataset.fields[2]),audienceId:'',reference:specs[0].code,targets:specs.slice(1).map(spec=>spec.code),eventCodes:['Y'],excludedCodes:['DK'],alpha:.05,design:'unweighted_independent',question:'Which selected groups differ in event rate?',methodology:'Fabricated independent unweighted respondents, single-choice outcome, complete selected comparison family.'}};
  const result=await runComparisonReview(ctx,{signal:new AbortController().signal,reviewedBinding:comparisonContextBinding(ctx)});
  return {ctx,result};
}
