// @vitest-environment jsdom
import { act,useState } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { ResearchQuestionCatalog } from "../ResearchQuestionCatalog";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import type { ImportedDatasetRecord } from "../../../../../shared/types/dashboard";
import { defaultDataset } from "../../builderConstants";
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function study(){return (await importDatasetBuffer(new TextEncoder().encode("Answer,Region\nYes,North\nNo,North\nYes,South\n").buffer,"catalog_fabricated.csv")).dataset!;}
function button(text:string){const node=Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(node=>node.textContent?.trim()===text);expect(node,text).toBeTruthy();return node!;}
function input(label:string){const node=Array.from(document.querySelectorAll("label")).find(node=>node.textContent?.trim()===label)?.querySelector("input");expect(node,label).toBeTruthy();return node!;}
async function type(node:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(node,value);node.dispatchEvent(new Event("input",{bubbles:true}));});}
async function choose(label:string,value:string){const node=Array.from(document.querySelectorAll("label")).find(node=>node.textContent?.startsWith(label))?.querySelector("select");expect(node,label).toBeTruthy();await act(async()=>{node!.value=value;node!.dispatchEvent(new Event("change",{bubbles:true}));});}
function cards(){return Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="Research questions"] button'));}
it("searches and reviews an exact imported question then hands that field to analysis",async()=>{
 const first=await study(),second={...structuredClone(first),id:"other-study",title:"Other study"};second.fields[0].researchTopic="Brand experience";second.fields[0].researchConcepts=["loyalty"];
 const launch=vi.fn(),close=vi.fn();await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[first,second]} updateImportedDatasetField={()=>{}} openGuidedDataQuery={launch} applyQuestionSelection={()=>{}} onClose={close}/>));
 await type(input("Search questions"),"loyalty");expect(cards()).toHaveLength(1);await act(async()=>cards()[0].click());expect(document.querySelector('[aria-label="Question details"]')?.textContent).toContain("Other study");
 await act(async()=>button("Create analysis from this question").click());expect(close).toHaveBeenCalledOnce();expect(launch).toHaveBeenCalledWith(expect.objectContaining({sourceMode:"imported",importedDatasetId:second.id,importedFieldId:second.fields[0].id,importedFieldSnapshot:second.fields[0]}));
});
it("applies declared labels and finds them without altering respondent data",async()=>{
 const original=await study(),before=structuredClone(original);let current!:ImportedDatasetRecord;
 function Harness(){const[dataset,setDataset]=useState(original);current=dataset;return <ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={(_,id,updates)=>setDataset(previous=>({...previous,fields:previous.fields.map(field=>field.id===id?{...field,...updates}:field)}))} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{}}/>;}
 await act(async()=>root.render(<Harness/>));await choose("Study",original.id);await choose("Topic","Uncategorized");await act(async()=>cards()[0].click());await type(input("Question topic"),"Packaging");await type(input("Question concepts"),"confidence, trust");await act(async()=>button("Apply discovery labels").click());
 await type(input("Search questions"),"confidence");expect(cards()).toHaveLength(1);expect(cards()[0].textContent).toContain("Packaging");expect(current.rows).toEqual(before.rows);expect(original).toEqual(before);
});
it("selects a sample explicitly even when imported studies are present",async()=>{
 const sample=vi.fn(),launch=vi.fn();await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[await study()]} updateImportedDatasetField={()=>{}} openGuidedDataQuery={launch} applyQuestionSelection={sample} onClose={()=>{}}/>));await choose("Study",defaultDataset.id);await act(async()=>cards()[0].click());await act(async()=>button("Create analysis from this question").click());
 expect(sample).toHaveBeenCalledWith(defaultDataset.questions[0]);expect(launch).toHaveBeenCalledWith(expect.objectContaining({sourceMode:"seeded"}));
});
it("bounds rendered results and retains search across result pages",async()=>{
 const dataset=await study();dataset.fields=Array.from({length:105},(_,i)=>({...dataset.fields[0],id:`field${i}`,sourceColumn:`Question_${i}`,label:`Question ${i}`}));dataset.fieldCount=105;
 await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={()=>{}} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{}}/>));await choose("Study",dataset.id);expect(cards()).toHaveLength(40);await act(async()=>button("Next questions").click());expect(cards()[0].textContent).toContain("Question 40");await type(input("Search questions"),"Question 104");expect(cards()).toHaveLength(1);expect(document.body.textContent).toContain("1 question found");
});
it("restores focus on Escape and isolates background controls",async()=>{
 const close=vi.fn();const trigger=document.createElement("button");trigger.textContent="Open catalog";document.body.append(trigger);trigger.focus();
 function Harness(){const[open,setOpen]=useState(true);return open?<ResearchQuestionCatalog importedDatasets={[]} updateImportedDatasetField={()=>{}} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{close();setOpen(false);}}/>:null;}
 await act(async()=>root.render(<Harness/>));const dialog=document.querySelector('[role="dialog"]');expect(document.activeElement).toBe(dialog);expect(host.inert).toBe(true);
 await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));expect(close).toHaveBeenCalledOnce();expect(document.activeElement).toBe(trigger);trigger.remove();
});
it("keeps remote metadata read-only and makes coverage limits visible",async()=>{
 const dataset=await study();dataset.remote={provider:"netlify",projectUrl:"",bucket:"",objectPath:"synthetic.csv",uploadedAt:dataset.importedAt};dataset.fieldCount=1000;
 await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={()=>{}} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{}}/>));await choose("Study",dataset.id);await act(async()=>cards()[0].click());expect(document.body.textContent).toContain("may be incomplete");expect(document.body.textContent).not.toContain("Organize this question");
});
it.each([true,false])("reports the actual save acknowledgement (%s) without claiming failed persistence",async(saved)=>{
 const dataset=await study(),update=vi.fn(()=>saved);await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={update} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{}}/>));await choose("Study",dataset.id);await act(async()=>cards()[0].click());await type(input("Question topic"),"Trust");await act(async()=>button("Apply discovery labels").click());
 expect(update).toHaveBeenCalledWith(dataset.id,dataset.fields[0].id,{researchTopic:"Trust",researchConcepts:[]});expect(document.body.textContent).toContain(saved?"Discovery labels saved in this browser.":"workspace could not be saved");if(!saved)expect(document.body.textContent).not.toContain("Discovery labels saved in this browser.");
});
it("clears selection when its source disappears instead of launching another study",async()=>{
 const dataset=await study(),launch=vi.fn(),render=(datasets:ImportedDatasetRecord[])=>root.render(<ResearchQuestionCatalog importedDatasets={datasets} updateImportedDatasetField={()=>{}} openGuidedDataQuery={launch} applyQuestionSelection={()=>{}} onClose={()=>{}}/>);
 await act(async()=>render([dataset]));await choose("Study",dataset.id);await act(async()=>cards()[0].click());await act(async()=>render([]));expect(document.querySelector('[aria-label="Question details"]')?.textContent).toContain("Start with the question");expect(document.body.textContent).toContain("Unavailable study");expect(Array.from(document.querySelectorAll("button")).some(node=>node.textContent==="Create analysis from this question")).toBe(false);expect(launch).not.toHaveBeenCalled();
});
it.each([true,false])("waits for delayed label persistence before feedback (%s)",async saved=>{
 const dataset=await study();let acknowledge!:(value:boolean)=>void;const update=vi.fn(()=>new Promise<boolean>(resolve=>{acknowledge=resolve;}));
 await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={update} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{}}/>));
 await choose("Study",dataset.id);await act(async()=>cards()[0].click());await type(input("Question topic"),"Trust");await act(async()=>button("Apply discovery labels").click());
 expect(document.body.textContent).toContain("Saving discovery labels");expect(document.body.textContent).not.toContain("Discovery labels saved");expect(button("Apply discovery labels").disabled).toBe(true);
 await act(async()=>acknowledge(saved));expect(document.body.textContent).toContain(saved?"Discovery labels saved":"workspace could not be saved");
});
it("ignores delayed label feedback after newer label edits",async()=>{
 const dataset=await study();let acknowledge!:(value:boolean)=>void;
 await act(async()=>root.render(<ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={()=>new Promise<boolean>(resolve=>{acknowledge=resolve;})} openGuidedDataQuery={()=>{}} applyQuestionSelection={()=>{}} onClose={()=>{}}/>));
 await choose("Study",dataset.id);await act(async()=>cards()[0].click());await type(input("Question topic"),"Old topic");await act(async()=>button("Apply discovery labels").click());await type(input("Question topic"),"New topic");
 await act(async()=>acknowledge(true));expect(input("Question topic").value).toBe("New topic");expect(document.body.textContent).not.toContain("Discovery labels saved");
});
