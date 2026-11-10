import { concat, numeric, sav } from "./savCaseFixture";
function integer(value:number){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setInt32(0,value,true);return bytes;}
export function missingCaseSav(options:{compression?:0|1;unknownCount?:boolean;text?:boolean;allMissing?:boolean;rawMissing?:boolean;size?:number;missing?:number}={}){
 const size=options.size??5,compression=options.compression??0,text=options.text??false;
 const expected=Array.from({length:size},(_,index)=>({ID:!options.allMissing&&(index===1||index===3)?text?(index===1?"North":"South"):String((index+1)/2):"",AMOUNT:!options.allMissing&&(index===1||index===3)?String((index+1)*5):""}));
 const prefix=new Uint8Array(sav()).slice(0,240),view=new DataView(prefix.buffer);view.setInt32(72,compression,true);view.setInt32(80,options.unknownCount?-1:size,true);
 view.setInt32(192,(text?1:5)*65536+8*256+(text?0:2),true);view.setInt32(196,(text?1:5)*65536+8*256+(text?0:2),true);view.setInt32(224,5*65536+8*256+2,true);view.setInt32(228,5*65536+8*256+2,true);
 if(text)view.setInt32(180,8,true);
 const slots=expected.flatMap(row=>[row.ID,row.AMOUNT].map((value,index)=>{
  if(text&&index===0){const raw=new Uint8Array(8).fill(32);raw.set(new TextEncoder().encode(value));return{code:value?253:254,raw};}
  return{code:value?Number(value)+100:options.rawMissing?253:255,raw:numeric(value?Number(value):options.missing??-Number.MAX_VALUE)};
 }));
 let data:Uint8Array;if(!compression)data=concat(...slots.map(slot=>slot.raw));else{
  const operations=[...slots,{code:252,raw:new Uint8Array()}],parts:Uint8Array[]=[];
  for(let start=0;start<operations.length;start+=8){const codes=new Uint8Array(8),raw:Uint8Array[]=[];operations.slice(start,start+8).forEach((slot,index)=>{codes[index]=slot.code;if(slot.code===253)raw.push(slot.raw);});parts.push(codes,...raw);}data=concat(...parts);
 }
 const info=options.missing===undefined?new Uint8Array():concat(integer(7),integer(4),integer(8),integer(3),numeric(options.missing),numeric(Number.MAX_VALUE),numeric(-Number.MAX_VALUE));
 return{buffer:concat(prefix,info,integer(999),integer(0),data).buffer,expected};
}
