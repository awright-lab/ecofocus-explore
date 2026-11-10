import type { DashboardCanvasElement, DashboardDraft, DashboardPage, DashboardTile } from '../../../../shared/types/dashboard';
import { canvasHeight, canvasWidth, chartFrameMinimum } from '../builderConstants';
export type ReportObjectKind='tile'|'element';
export interface ReportObjectMoveBinding { report:DashboardDraft; page:DashboardPage; kind:ReportObjectKind; objectId:string; item:DashboardTile|DashboardCanvasElement }
function objects(page:DashboardPage){return[...page.tiles.map(item=>({kind:'tile' as const,item})),...page.elements.map(item=>({kind:'element' as const,item}))];}
function dense(value:unknown){return Array.isArray(value)&&Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);}
function validPages(report:DashboardDraft){if(!dense(report.pages)||!report.pages.length||report.pages.some(page=>!page||typeof page.id!=='string'||!page.id||!dense(page.tiles)||!dense(page.elements))||new Set(report.pages.map(page=>page.id)).size!==report.pages.length)throw Error('Report pages are missing or ambiguous. No object was moved.');const ids=report.pages.flatMap(page=>objects(page).map(({item})=>item?.id));if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('Report object identities are missing or ambiguous. No object was moved.');}
export function captureReportObjectMove(report:DashboardDraft,pageId:string,kind:ReportObjectKind,objectId:string):ReportObjectMoveBinding {validPages(report);const page=report.pages.find(p=>p.id===pageId),entry=page&&objects(page).find(entry=>entry.kind===kind&&entry.item.id===objectId);if(!page||!entry)throw Error('Select one existing object before moving it.');if(entry.item.locked)throw Error('Unlock this object before moving it.');return{report,page,kind,objectId,item:entry.item};}
function label(item:DashboardTile|DashboardCanvasElement){return item.name||('title'in item?item.title:'')||'Untitled object';}
function rect(item:DashboardTile|DashboardCanvasElement,kind:ReportObjectKind){const l=item.layout;if(!l||[l.x,l.y,l.width,l.height,l.zIndex].some(n=>!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)||l.width<=0||l.height<=0)throw Error('An object has unsupported box geometry.');return{x:l.x,y:l.y,width:kind==='tile'?Math.max(l.width,chartFrameMinimum.width):l.width,height:kind==='tile'?Math.max(l.height,chartFrameMinimum.height):l.height};}
const coordinates=(item:DashboardTile|DashboardCanvasElement)=>[item.layout?.x,item.layout?.y,item.layout?.width,item.layout?.height,item.layout?.zIndex];
export function inspectReportObjectMove(report:DashboardDraft,binding:ReportObjectMoveBinding,targetId:string){
 if(report!==binding.report)throw Error('The report changed. Close this review and reopen Move to page; nothing was moved.');validPages(report);
 const current=captureReportObjectMove(report,binding.page.id,binding.kind,binding.objectId);if(current.page!==binding.page||current.item!==binding.item)throw Error('The selected object changed. Close this review and try again.');
 const target=report.pages.find(page=>page.id===targetId);if(!target||target===current.page)throw Error('Choose a different existing destination page.');
 const box=rect(current.item,current.kind),overlaps:string[]=[];let uncertain=false;
 for(const entry of objects(target)){try{const other=rect(entry.item,entry.kind);if(![box.x+box.width,box.y+box.height,other.x+other.width,other.y+other.height].every(v=>Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER)){uncertain=true;continue;}if(box.x<other.x+other.width&&box.x+box.width>other.x&&box.y<other.y+other.height&&box.y+box.height>other.y)overlaps.push(label(entry.item));}catch{uncertain=true;}}
 const offPage=box.x<0||box.y<0||box.x+box.width>canvasWidth||box.y+box.height>canvasHeight;
 const reviewKey=JSON.stringify([report.id,current.page.id,current.page.order,current.page.title,current.kind,current.objectId,label(current.item),current.item.locked,current.item.hidden,coordinates(current.item),target.id,target.order,target.title,objects(target).map(({kind,item})=>[kind,item.id,label(item),item.locked,item.hidden,coordinates(item)])]);
 return{source:current.page,target,item:current.item,label:label(current.item),overlaps,uncertain,offPage,reviewRequired:offPage||uncertain||overlaps.length>0,reviewKey};
}
export function moveReportObject(report:DashboardDraft,binding:ReportObjectMoveBinding,targetId:string,reviewKey:string,reviewed:boolean):DashboardDraft {
 const info=inspectReportObjectMove(report,binding,targetId);if(info.reviewKey!==reviewKey)throw Error('The destination review changed. Review the current destination before moving.');if(info.reviewRequired&&!reviewed)throw Error('Review the possible overlap or off-page placement before moving.');
 return{...report,status:'draft',pages:report.pages.map(page=>{
  if(page===info.source)return binding.kind==='tile'?{...page,tiles:page.tiles.filter(tile=>tile.id!==binding.objectId)}:{...page,elements:page.elements.filter(element=>element.id!==binding.objectId)};
  if(page===info.target)return binding.kind==='tile'?{...page,tiles:[...page.tiles,info.item as DashboardTile]}:{...page,elements:[...page.elements,info.item as DashboardCanvasElement]};return page;
 })};
}
