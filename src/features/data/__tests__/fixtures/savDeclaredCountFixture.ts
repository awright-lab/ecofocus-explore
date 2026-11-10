import {concat,numeric,sav} from "./savCaseFixture";
export function declaredCountSav({compression=0,actualCount=3,declaredCount=actualCount,endMarker=true,paddingBlocks=0}:{compression?:number;actualCount?:number;declaredCount?:number;endMarker?:boolean;paddingBlocks?:number}={}){
 const header=new Uint8Array(sav()).slice(0,248);new DataView(header.buffer).setInt32(72,compression,true);new DataView(header.buffer).setInt32(80,declaredCount,true);
 const chunks=Array.from({length:actualCount},(_,index)=>[numeric(index+1),numeric((index+1)*10)]).flat(),data:Uint8Array[]=[];
 if(compression){const commands:Array<Uint8Array|null>=[...chunks,...(endMarker?[null]:[])];for(let offset=0;offset<commands.length;offset+=8){const group=commands.slice(offset,offset+8),controls=new Uint8Array(8);group.forEach((chunk,index)=>controls[index]=chunk?253:252);data.push(controls,...group.filter((chunk):chunk is Uint8Array=>chunk!==null));}data.push(new Uint8Array(paddingBlocks*8));}else data.push(...chunks);
 return concat(header,...data).buffer;
}
