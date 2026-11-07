import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { storageKey } from "../../../builder/builderConstants";
import { createReportRecord, normalizeDashboardWorkspace, loadDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { syntheticStudy } from "./syntheticStudy";
import "../../../../styles.css";
import "../../../../studio.css";
const id="goal10_synthetic_report",hasSavedData=[workspaceStorageKey,legacyWorkspaceStorageKey,storageKey].some(key=>localStorage.getItem(key)!==null),existing=hasSavedData?loadDashboardWorkspace():null;
const safe=!existing||existing.reports.length===1&&existing.reports[0].id===id;
if(safe&&!existing){
 const {dataset}=await syntheticStudy(1000,90);dataset.title="Synthetic catalog study";dataset.fields[1].variableLabel="Where do you live?";dataset.fields[3].variableLabel="How much did you spend?";
 const draft=structuredClone(initialDashboard);draft.id=id;draft.title="Goal 10 question discovery";draft.importedDatasets=[dataset];draft.pages=draft.pages.slice(0,1);draft.pages[0].tiles=[];draft.pages[0].elements=[];draft.pages[0].title="Catalog findings";
 if(!saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]})))throw new Error("The isolated synthetic workspace could not be saved.");
}
if(safe&&!window.location.hash.includes("reports"))window.history.replaceState(null,"",`#/reports/${id}`);
function Harness(){const[inspection,setInspection]=useState("");function inspect(){const workspace=loadDashboardWorkspace(),draft=workspace.reports[0].draft;setInspection(JSON.stringify({rows:workspace.importedDatasets[0].rows.length,fields:workspace.importedDatasets[0].fields.length,discovery:workspace.importedDatasets[0].fields.filter(field=>field.researchTopic||field.researchConcepts?.length).map(field=>({id:field.id,sourceColumn:field.sourceColumn,topic:field.researchTopic,concepts:field.researchConcepts})),tiles:draft.pages.flatMap(page=>page.tiles.map(tile=>({title:tile.title,source:tile.source,query:tile.query,result:tile.result?.table.map(row=>({label:row.label,values:row.values,bases:row.bases}))}))),snapshots:workspace.publishedSnapshots.length}));}
 return safe?<><App/><aside aria-label="Synthetic catalog inspection" style={{position:"fixed",bottom:8,left:8,zIndex:900,padding:10,background:"white",border:"1px solid #39784d",maxWidth:440,maxHeight:130,overflow:"auto"}}><button onClick={inspect}>Inspect saved catalog workflow</button><p>Synthetic only; actual App/storage/commands. No service calls.</p><output>{inspection}</output></aside></>:<p>Acceptance stopped: this origin already contains another workspace. No data was changed.</p>;}
createRoot(document.getElementById("root")!).render(<Harness/>);
