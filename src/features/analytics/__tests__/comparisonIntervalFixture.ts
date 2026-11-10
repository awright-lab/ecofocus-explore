import { dotPlotFixture } from './dotPlotFixture';
import { importDatasetBuffer } from '../../data/datasetImportModel';
import { runImportedDatasetQuery } from '../../data/importedDatasetAnalytics';
import { dotIntervalCandidate, dotIntervalMethod } from '../dotPlotIntervals';

export const independentGroups = [
  {code:'all', label:'All selected', events:3, base:3},
  {code:'zero', label:'None selected', events:0, base:1},
  {code:'partial', label:'Some selected', events:1, base:3},
  {code:'empty', label:'No valid answers', events:0, base:0},
];
export async function comparisonIntervalFixture(groups=independentGroups.slice(0,2), missing=0) {
  const lines=['Answer,Group'];
  for(const group of groups){
    if(group.base===0 && missing===0)lines.push(`,${group.code}`);
    for(let i=0;i<group.base;i++)lines.push(`${i<group.events?'yes':'no'},${group.code}`);
    for(let i=0;i<missing;i++)lines.push(`,${group.code}`);
  }
  const {dataset}=await importDatasetBuffer(new TextEncoder().encode(lines.join('\n')).buffer,'synthetic-independent-rates.csv');
  if(!dataset)throw Error('Synthetic import failed');
  for(const field of dataset.fields)Object.assign(field,{type:'categorical',modelingRole:'candidate_dimension',eligibleForFilter:true,eligibleForBanner:true});
  dataset.fields[0].valueLabels={yes:'Selected',no:'Not selected'};
  dataset.fields[1].valueLabels=Object.fromEntries(groups.map(group=>[group.code,group.label]));
  const f=await dotPlotFixture(),tile=f.tile;tile.title=tile.name='Synthetic independent rates';tile.appearance.showBases=true;tile.appearance.showValueLabels=true;
  tile.result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],metric:'percent_selected',chartType:'dot_plot'});tile.query=structuredClone(tile.result.query);
  tile.source={kind:'importedField',id:'independent-rates',datasetId:dataset.id,fieldId:dataset.fields[0].id,label:'Answer'};
  tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(tile).binding};
  f.draft.importedDatasets=[dataset];return{draft:f.draft,tile,dataset};
}
