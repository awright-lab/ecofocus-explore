import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { storageKey } from "../../../builder/builderConstants";
import { createReportRecord, normalizeDashboardWorkspace, loadDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { syntheticStudy } from "./syntheticStudy";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { runIllustrativeFollowUpQuery } from "../../../analytics/illustrativeFollowUpQuery";
import "../../../../styles.css";
import "../../../../studio.css";
const id="goal29_synthetic_report",hasSavedData=[workspaceStorageKey,legacyWorkspaceStorageKey,storageKey].some(key=>localStorage.getItem(key)!==null),existing=hasSavedData?loadDashboardWorkspace():null;
const safe=!existing||existing.reports.length===1&&existing.reports[0].id===id;
if(safe&&!existing){
 const{dataset}=await syntheticStudy(1000,30);dataset.title="Synthetic advice study";
 const draft=structuredClone(initialDashboard);draft.id=id;draft.title="Analysis advice acceptance";draft.importedDatasets=[dataset];draft.pages=[structuredClone(draft.pages[0]),structuredClone(draft.pages[0])];
 const page=draft.pages[0];page.id="advice-original-page";page.order=0;page.title="Original imported result";page.elements=[];
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[1],metric:"percent_selected",chartType:"table"});page.tiles=[{...page.tiles[0],id:"advice-original-analysis",name:"Original region",title:"Original region",query:result.query,result,visualization:"table",source:{kind:"importedField",id:`${dataset.id}:${dataset.fields[1].id}`,datasetId:dataset.id,fieldId:dataset.fields[1].id,label:"Region"},layout:{x:48,y:72,width:760,height:460,zIndex:1}}];
 const samplePage=draft.pages[1],source={kind:"seeded" as const,sourceRef:{id:"seeded:ecofocus_2025",kind:"seeded_demo" as const,provider:"ecofocus_demo" as const,label:"Illustrative sample",datasetId:"ecofocus_2025" as const},datasetId:"ecofocus_2025" as const,questionId:"Q_PACKAGING_TRUST" as const};
 const sample=runIllustrativeFollowUpQuery({dataset:"ecofocus_2025",question:"Q_PACKAGING_TRUST",breakBy:"SUMMARY",filters:[],weight:null,confidenceLevel:0.95 as const,metric:"column_percent",chartType:"table",sourceRef:source.sourceRef,sourceIdentity:source});
 samplePage.id="sample-original-page";samplePage.order=1;samplePage.title="Explicit illustrative sample";samplePage.elements=[];samplePage.tiles=[{...page.tiles[0],id:"sample-original-analysis",name:"Illustrative packaging trust",title:"Illustrative packaging trust",source:{kind:"question",id:"Q_PACKAGING_TRUST",label:"Packaging trust"},query:sample.query,result:sample}];
 if(!saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]})))throw new Error("The isolated synthetic workspace could not be saved.");
}
if(safe&&!window.location.hash)window.history.replaceState(null,"",`#/reports/${id}`);
function Harness(){const[inspection,setInspection]=useState("");function inspect(){const workspace=loadDashboardWorkspace(),draft=workspace.reports[0].draft;setInspection(JSON.stringify({rows:workspace.importedDatasets[0].rows.length,fields:workspace.importedDatasets[0].fields.length,pages:draft.pages.map(page=>({id:page.id,title:page.title,tiles:page.tiles.map(tile=>({id:tile.id,title:tile.title,query:tile.query,result:tile.result,visualization:tile.visualization}))})),snapshots:workspace.publishedSnapshots.length}));}
 return safe?<><App/><aside aria-label="Synthetic advice inspection" style={{position:"fixed",bottom:8,left:8,zIndex:900,padding:10,background:"white",border:"1px solid #39784d",maxWidth:440,maxHeight:130,overflow:"auto"}}><button onClick={inspect}>Inspect saved advice workflow</button><p>Synthetic only; actual App/writer/commands. No automatic live queries.</p><output>{inspection}</output></aside></>:<p>Acceptance stopped: this origin already contains another workspace. No data was changed.</p>;}
createRoot(document.getElementById("root")!).render(<Harness/>);
