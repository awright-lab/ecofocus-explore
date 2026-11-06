import {createRoot} from 'react-dom/client';
import App from '../../../App';
import {initialDashboard} from '../../document/documentSeeds';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace,workspaceStorageKey,legacyWorkspaceStorageKey} from '../../document/workspacePersistence';
import {storageKey} from '../../builder/builderConstants';
import {importDatasetBuffer} from '../../data/datasetImportModel';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
import '../../../styles.css';import '../../../studio.css';
const reportId='isolated_preparation_workflow';
const existing=[workspaceStorageKey,legacyWorkspaceStorageKey,storageKey].some(key=>localStorage.getItem(key)!==null)?loadDashboardWorkspace():null;
const safe=!existing||existing.reports.length===1&&existing.reports[0].id===reportId;
if(safe&&!existing){
 const headers=['Respondent_ID','Region','Segment',...Array.from({length:27},(_,i)=>`Other_${i+1}`)];
 const csv=[headers.join(','),...Array.from({length:1000},(_,i)=>[i+1,['North','NORTH','South','East'][Math.floor(i/250)],i<500?'Core':'Growth',...Array.from({length:27},(_,j)=>(i+j)%7)].join(','))].join('\n');
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic_preparation_1000x30.csv');if(!dataset)throw Error('Synthetic import failed');
 const draft=structuredClone(initialDashboard);draft.id=reportId;draft.title='Synthetic preparation acceptance';draft.importedDatasets=[dataset];draft.pages=draft.pages.slice(0,1);draft.savedAudiences=[];
 const page=draft.pages[0],field=dataset.fields[2],result=runImportedDatasetQuery({dataset,field,metric:'count',chartType:'table'});page.elements=[];page.tiles=[{...page.tiles[0],id:'preparation-original',title:'Original segment analysis',name:'Original segment analysis',derivedOutput:undefined,query:structuredClone(result.query),result,visualization:'table',source:{kind:'importedField',id:`${dataset.id}:${field.id}`,datasetId:dataset.id,fieldId:field.id,label:'Segment'}}];
 if(!saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]})))throw Error('Synthetic seed was not saved');
}
if(!safe)document.getElementById('root')!.textContent='Stopped: unrelated workspace exists on this origin; no writes performed.';
else{
 if(!location.hash)history.replaceState(null,'',`#/reports/${reportId}`);createRoot(document.getElementById('root')!).render(<App/>);
 const panel=document.createElement('aside');panel.setAttribute('aria-label','Synthetic preparation inspection');Object.assign(panel.style,{position:'fixed',bottom:'8px',left:'8px',zIndex:'900',background:'white',border:'2px solid green',padding:'8px'});
 const button=document.createElement('button');button.textContent='Capture synthetic preparation workspace';const output=document.createElement('textarea');output.readOnly=true;output.setAttribute('aria-label','Captured preparation workspace');output.style.display='none';const status=document.createElement('span');status.setAttribute('role','status');
 button.onclick=()=>{const workspace=loadDashboardWorkspace();output.value=JSON.stringify({studies:workspace.importedDatasets,pages:workspace.reports[0].draft.pages,audiences:workspace.reports[0].draft.savedAudiences,library:workspace.reports[0].draft.analysisLibrary,snapshots:workspace.publishedSnapshots});status.textContent=`${output.value.length} captured characters`;};panel.append(button,status,output);document.body.append(panel);button.click();
}
