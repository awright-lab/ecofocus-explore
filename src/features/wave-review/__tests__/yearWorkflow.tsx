import {createRoot} from 'react-dom/client';
import App from '../../../App';
import {initialDashboard} from '../../document/documentSeeds';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace,workspaceStorageKey,legacyWorkspaceStorageKey} from '../../document/workspacePersistence';
import {storageKey} from '../../builder/builderConstants';
import {importDatasetBuffer} from '../../data/datasetImportModel';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
import '../../../styles.css';import '../../../studio.css';
const reportId='isolated_year_comparison';
const existing=[workspaceStorageKey,legacyWorkspaceStorageKey,storageKey].some(key=>localStorage.getItem(key)!==null)?loadDashboardWorkspace():null;
const safe=!existing||existing.reports.length===1&&existing.reports[0].id===reportId;
if(safe&&!existing){
 const studies=[];
 for(const year of [2024,2025]){
  const count=year===2024?1000:1200,question=year===2024?'TrustOld':'TrustNew',headers=['Respondent_ID',question,'Segment',...Array.from({length:27},(_,i)=>`Other_${i+1}`)];
  const answer=(i:number)=>year===2024?i<600?'Y':i<950?'N':i<980?'':'DK':i<780?'agree':i<1140?'disagree':i<1170?'':'unsure';
  const csv=[headers.join(','),...Array.from({length:count},(_,i)=>[`${year}-${i+1}`,answer(i),i<count/2?'Core':'Growth',...Array.from({length:27},(_,j)=>(i+j)%7)].join(','))].join('\n');
  const {dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,`synthetic_year_${year}_30fields.csv`);if(!dataset)throw Error('Synthetic year import failed');
  dataset.fields[1].variableLabel='Trust this packaging claim?';dataset.fields[1].valueLabels=year===2024?{Y:'Trust',N:'Do not trust',DK:'Do not know'}:{agree:'Trust',disagree:'Do not trust',unsure:'Unsure'};studies.push(dataset);
 }
 const draft=structuredClone(initialDashboard);draft.id=reportId;draft.title='Synthetic year comparison acceptance';draft.importedDatasets=studies;draft.savedAudiences=[];draft.pages=draft.pages.slice(0,1);
 const dataset=studies[0],field=dataset.fields[2],page=draft.pages[0],result=runImportedDatasetQuery({dataset,field,metric:'count',chartType:'table'});page.elements=[];page.tiles=[{...page.tiles[0],id:'year-original',name:'Original segment analysis',title:'Original segment analysis',derivedOutput:undefined,query:structuredClone(result.query),result,visualization:'table',source:{kind:'importedField',id:`${dataset.id}:${field.id}`,datasetId:dataset.id,fieldId:field.id,label:'Segment'}}];
 if(!saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:studies})))throw Error('Synthetic seed was not saved');
}
if(!safe)document.getElementById('root')!.textContent='Stopped: unrelated workspace exists on this origin; no writes performed.';
else{
 if(!location.hash)history.replaceState(null,'',`#/reports/${reportId}`);createRoot(document.getElementById('root')!).render(<App/>);
 const panel=document.createElement('aside');panel.setAttribute('aria-label','Synthetic year inspection');Object.assign(panel.style,{position:'fixed',bottom:'8px',left:'8px',zIndex:'900',background:'white',border:'2px solid green',padding:'8px'});
 const button=document.createElement('button');button.textContent='Capture synthetic year workspace';const output=document.createElement('textarea');output.readOnly=true;output.setAttribute('aria-label','Captured year workspace');output.style.display='none';const status=document.createElement('span');status.setAttribute('role','status');
 button.onclick=()=>{const workspace=loadDashboardWorkspace();output.value=JSON.stringify({studies:workspace.importedDatasets,pages:workspace.reports[0].draft.pages,audiences:workspace.reports[0].draft.savedAudiences,library:workspace.reports[0].draft.analysisLibrary,snapshots:workspace.publishedSnapshots});status.textContent=`${output.value.length} captured characters`;};panel.append(button,status,output);document.body.append(panel);button.click();
}
