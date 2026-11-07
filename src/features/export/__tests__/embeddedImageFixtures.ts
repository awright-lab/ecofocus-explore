import type { DashboardCanvasElement } from '../../../../shared/types/dashboard';
import { initialDashboard } from '../../document/documentSeeds';
export const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
export function headerImage(format:string,width=2,height=3,variant=''){
 const bytes=new Uint8Array(48),text=(offset:number,value:string)=>Array.from(value).forEach((char,i)=>bytes[offset+i]=char.charCodeAt(0));
 const be=(offset:number,value:number,n:number)=>{for(let i=n-1;i>=0;i--){bytes[offset+i]=value&255;value=Math.floor(value/256);}};
 if(format==='png'){bytes.set([137,80,78,71,13,10,26,10]);be(8,13,4);text(12,'IHDR');be(16,width,4);be(20,height,4);text(37,'IDAT');}
 else if(format==='jpeg'){bytes.set([255,216,255,variant==='progressive'?194:192,0,8,8]);be(7,height,2);be(9,width,2);bytes[11]=1;}
 else {text(0,'RIFF');text(8,'WEBP');text(12,variant||'VP8X');
  if(variant==='VP8 '){bytes.set([0x9d,1,0x2a],23);bytes[26]=width&255;bytes[27]=width>>8;bytes[28]=height&255;bytes[29]=height>>8;}
  else if(variant==='VP8L'){bytes[20]=0x2f;const bits=(width-1)|((height-1)<<14);for(let i=0;i<4;i++)bytes[21+i]=(bits>>>(i*8))&255;}
  else {const w=width-1,h=height-1;for(let i=0;i<3;i++){bytes[24+i]=(w>>>(8*i))&255;bytes[27+i]=(h>>>(8*i))&255;}}
 }
 return `data:image/${format};base64,${btoa(String.fromCharCode(...bytes))}`;
}
export function imageReport(){const draft=structuredClone(initialDashboard);draft.pages=[draft.pages[0]];draft.pages[0].elements=[];draft.pages[0].tiles=[];return draft;}
export function imageObject(source=tinyPng,id='synthetic-image'):DashboardCanvasElement {
 const element=structuredClone(initialDashboard.pages.flatMap(page=>page.elements).find(element=>element.type==='text')!);
 return {...element,id,type:'image',name:'Synthetic image',content:source,layout:{...element.layout,x:20,y:20,width:100,height:100}};
}
export class ControlledImage {
 static instances:ControlledImage[]=[];
 onload:(()=>void)|null=null;onerror:(()=>void)|null=null;naturalWidth=1;naturalHeight=1;source='';removed=false;
 decode=async()=>{};
 constructor(){ControlledImage.instances.push(this);}
 set src(source:string){this.source=source;}
 removeAttribute(){this.removed=true;}
}
