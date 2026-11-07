import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { storageKey } from "../../../builder/builderConstants";
import { createReportRecord, normalizeDashboardWorkspace, loadDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { syntheticStudy } from "./syntheticStudy";
import "../../../../styles.css";
import "../../../../studio.css";
const id="goal27_synthetic_report",hasSavedData=[workspaceStorageKey,legacyWorkspaceStorageKey,storageKey].some(key=>localStorage.getItem(key)!==null),existing=hasSavedData?loadDashboardWorkspace():null;
const safe=!existing||existing.reports.length===1&&existing.reports[0].id===id;
if(safe&&!existing){
 const{dataset}=await syntheticStudy(1000,30);dataset.title="Synthetic follow-up study";
 const draft=structuredClone(initialDashboard);draft.id=id;draft.title="Goal 27 finding investigations";draft.importedDatasets=[dataset];draft.pages=draft.pages.slice(0,1);const page=draft.pages[0];page.id="original-finding-page";page.title="Original regional finding";page.elements=[];
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[1],metric:"percent_selected",chartType:"table"});page.tiles=[{...page.tiles[0],id:"original-regional-analysis",title:"Original regional responses",query:result.query,result,visualization:"table",source:{kind:"importedField",id:`${dataset.id}:${dataset.fields[1].id}`,datasetId:dataset.id,fieldId:dataset.fields[1].id,label:"Region"},layout:{x:48,y:72,width:760,height:460,zIndex:1}}];
 draft.savedAudiences=[{version:1,id:"synthetic-growth-audience",label:"Growth audience",datasetId:dataset.id,importedAt:dataset.importedAt,expression:{kind:"category",fieldId:dataset.fields[2].id,sourceColumn:dataset.fields[2].sourceColumn,exclude:false,values:["Growth"]}}];
 if(!saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]})))throw new Error("The isolated synthetic workspace could not be saved.");
}
if(safe&&!window.location.hash)window.history.replaceState(null,"",`#/reports/${id}`);
function Harness(){const[inspection,setInspection]=useState("");function inspect(){const workspace=loadDashboardWorkspace(),draft=workspace.reports[0].draft;setInspection(JSON.stringify({rows:workspace.importedDatasets[0].rows.length,fields:workspace.importedDatasets[0].fields.length,importedAt:workspace.importedDatasets[0].importedAt,audiences:draft.savedAudiences,pages:draft.pages.map(page=>({id:page.id,title:page.title,tiles:page.tiles.map(tile=>({id:tile.id,title:tile.title,source:tile.source,query:tile.query,notes:tile.result.notes,result:tile.result.table.map(row=>({label:row.label,values:row.values,bases:row.bases}))}))})),snapshots:workspace.publishedSnapshots.length}));}
 return safe?<><App/><aside aria-label="Synthetic follow-up inspection" style={{position:"fixed",bottom:8,left:8,zIndex:900,padding:10,background:"white",border:"1px solid #39784d",maxWidth:440,maxHeight:130,overflow:"auto"}}><button onClick={inspect}>Inspect saved follow-up workflow</button><p>Synthetic only; actual App/storage/commands. No automatic service calls.</p><output>{inspection}</output></aside></>:<p>Acceptance stopped: this origin already contains another workspace. No data was changed.</p>;}
createRoot(document.getElementById("root")!).render(<Harness/>);
