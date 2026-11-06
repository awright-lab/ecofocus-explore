import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { createCanvasElement } from "../../../builder/builderDocumentCommands";
import { storageKey } from "../../../builder/builderConstants";
import { createReportRecord,normalizeDashboardWorkspace,loadDashboardWorkspace,saveDashboardWorkspace,workspaceStorageKey,legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { narrativeState } from "../../../narratives/narrativeEvidence";
import { buildPdfBlob,buildPptxBlob,buildXlsxBlob } from "../../../export/coreDocumentExports";
import { buildPageVisualSvg } from "../../../export/pageVisualExport";
import { syntheticStudy } from "./syntheticStudy";
import "../../../../styles.css";
import "../../../../studio.css";
const id="goal28_synthetic_report",hasSavedData=[workspaceStorageKey,legacyWorkspaceStorageKey,storageKey].some(key=>localStorage.getItem(key)!==null),existing=hasSavedData?loadDashboardWorkspace():null;
const safe=!existing||existing.reports.length===1&&existing.reports[0].id===id;
if(safe&&!existing){
 const {dataset}=await syntheticStudy(1000,30),draft=structuredClone(initialDashboard);draft.id=id;draft.title="Goal 28 synthetic narrative acceptance";draft.importedDatasets=[dataset];
 const page=structuredClone(draft.pages[0]);page.id="evidence-source-page";page.title="Source results";page.elements=[];
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[1],metric:"percent_selected",chartType:"table"});
 page.tiles=[{...page.tiles[0],id:"evidence-source-tile",title:"Regional responses",query:result.query,result,visualization:"table",layout:{x:30,y:30,width:1200,height:680,zIndex:1}}];
 const notes=structuredClone(page);notes.id="evidence-notes-page";notes.title="Conclusions";notes.order=2;notes.tiles=[];
 const text=createCanvasElement("text",notes);text.id="evidence-claim";text.name="Regional claim";text.content="North accounts for 25% of responses.";text.layout={x:50,y:50,width:1150,height:520,zIndex:1};text.style.fontSize=20;text.style.padding=16;notes.elements=[text];draft.pages=[page,notes];
 if(!saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]})))throw new Error("The isolated synthetic workspace could not be saved.");
}
if(safe&&!window.location.hash.includes("reports"))window.history.replaceState(null,"",`#/reports/${id}`);
const dataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
function Harness(){
 const [inspection,setInspection]=useState(""),[files,setFiles]=useState<Array<{name:string;href:string}>>([]);
 function inspect(){const workspace=loadDashboardWorkspace(),draft=workspace.reports[0].draft,note=draft.pages[1].elements[0];setInspection(JSON.stringify({text:note.content,evidence:note.evidence,state:narrativeState(note,draft.pages),rows:workspace.importedDatasets[0].rows.length,snapshots:workspace.publishedSnapshots.length}));}
 async function construct(){try{const draft=loadDashboardWorkspace().reports[0].draft;const entries=await Promise.all([dataUrl(await buildPdfBlob(draft.pages)),dataUrl(await buildPptxBlob(draft.pages)),dataUrl(buildXlsxBlob(draft,draft.pages)),dataUrl(new Blob([buildPageVisualSvg(draft.pages[1])],{type:"image/svg+xml"})),dataUrl(new Blob([JSON.stringify(draft)],{type:"application/json"}))]);setFiles(entries.map((href,i)=>({name:["narrative.pdf","narrative.pptx","narrative.xlsx","narrative.svg","narrative.json"][i],href})));setInspection("Actual frontend files constructed without automatic downloads.");}catch(error){setInspection(error instanceof Error?error.message:"Construction failed");}}
 return safe?<><App/><aside aria-label="Synthetic narrative inspection" style={{position:"fixed",bottom:8,left:8,zIndex:9999,padding:10,background:"white",border:"1px solid #39784d",maxWidth:470,maxHeight:160,overflow:"auto"}}><button onClick={inspect}>Inspect saved narrative</button><button onClick={()=>void construct()}>Construct saved narrative files</button><p>Synthetic only; actual App/storage/commands. No automatic download or service calls.</p><output>{inspection}</output>{files.map(file=><a key={file.name} href={file.href}>{file.name}</a>)}</aside></>:<p>Acceptance stopped: this origin already contains another workspace. No data was changed.</p>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
