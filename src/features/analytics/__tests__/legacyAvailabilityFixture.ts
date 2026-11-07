import {initialDashboard} from '../../document/documentSeeds';
import type {Metric} from '../../../../shared/types/analytics';
export function legacyAvailabilityFixture(metric:Metric='column_percent'){
 const draft=structuredClone(initialDashboard);draft.pages=[draft.pages[0]];draft.pages[0].elements=[];const tile=draft.pages[0].tiles[0];draft.pages[0].tiles=[tile];
 tile.title='Legacy availability';tile.name=tile.title;tile.visualization='table';tile.layout={x:20,y:20,width:1180,height:600,zIndex:1};tile.appearance.axisLabelOverrides={};tile.appearance.barFillMode='solid';tile.appearance.barStyles={};tile.appearance.showValueLabels=true;tile.appearance.showBases=true;
 const result=tile.result;result.query={...result.query,dataset:'ecofocus_2025',question:'Q_PACKAGING_TRUST',breakBy:'SUMMARY',metric,chartType:'table',weight:null,filters:[],comparisonMode:'none'};
 delete result.query.sourceIdentity;delete result.query.sourceRef;delete result.query.authoredVariableSet;delete result.localExecution;delete result.calculationInputs;
 result.metadataRefs={...result.metadataRefs,dataset:result.query.dataset,question:result.query.question,breakBy:result.query.breakBy};delete result.metadataRefs.source;delete result.metadataRefs.authoredVariableSet;
 result.columns=[{id:'summary',label:'Recorded group'}];result.labels=['Recorded group'];result.table=[{optionId:'observed',label:'Observed',values:{summary:25},bases:{summary:10}},{optionId:'empty',label:'Empty base',values:{summary:75},bases:{summary:0}}];result.series=result.table.map(row=>({id:row.optionId,label:row.label,values:[row.values.summary],bases:[row.bases.summary]}));result.metric={id:metric,label:metric==='average'?'Average':'Percent',valueFormat:metric==='average'||metric==='count'||metric==='sum'?'number':'percent'};result.weighting={applied:false,id:null,label:'Unweighted'};result.annotations=[];tile.query=structuredClone(result.query);return{draft,tile,result};
}
