import { importDatasetBuffer } from '../../data/datasetImportModel';
import { runImportedDatasetQuery } from '../../data/importedDatasetAnalytics';
import { initialDashboard } from '../../document/documentSeeds';

export const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
export async function layeredFixture({signed=false}:{signed?:boolean}={}) {
  // Keep native-positive and signed-raster fixtures independently query-backed.
  const {dataset}=await importDatasetBuffer(new TextEncoder().encode(`Answer,Banner,Amount\nA,X,${signed?-20:20}\nA,Y,10\nB,X,0\nB,Y,20\n`).buffer,'synthetic-layers.csv');
  if(!dataset)throw Error('fixture');
  for(const field of dataset.fields)Object.assign(field,field.sourceColumn==='Amount'?{type:'numeric',modelingRole:'candidate_measure'}:{type:'categorical',modelingRole:'candidate_dimension',eligibleForBanner:true,eligibleForFilter:true});
  const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],measureField:dataset.fields[2],metric:'sum',chartType:'grouped_bar'});
  const draft=structuredClone(initialDashboard);draft.id='synthetic-layered-report';draft.importedDatasets=[dataset];draft.savedAudiences=[];draft.pages=draft.pages.slice(0,1);
  const tile=draft.pages[0].tiles[0];tile.query=structuredClone(result.query);tile.result=result;tile.derivedOutput=undefined;tile.source={kind:'importedField',id:'layered-source',datasetId:dataset.id,fieldId:dataset.fields[0].id,label:'Answer'};
  Object.assign(tile.appearance,{showBases:true,axisLabelOverrides:{},titleX:18,titleY:10,titleWidth:1100,titleFontSize:18,axisFontSize:12,labelFontSize:12});
  tile.id='chart';tile.title=tile.name='Editable chart';tile.visualization='grouped_bar';tile.query.chartType=tile.result.query.chartType='grouped_bar';
  tile.appearance.showValueLabels=false;tile.appearance.background='transparent';tile.appearance.chartBackground='transparent';tile.layout={x:240,y:150,width:800,height:500,zIndex:2};
  const page=draft.pages[0];page.background='#e8f3eb';
  const shape={...structuredClone(initialDashboard.pages[0].elements[0]),id:'backdrop',name:'Backdrop',type:'rectangle' as const,content:'',layout:{x:60,y:60,width:1100,height:620,zIndex:0}};
  Object.assign(shape.style,{fill:'#f1ca65',opacity:60,borderRadius:0,borderWidth:0});
  const foreground={...structuredClone(shape),id:'foreground',name:'Foreground text',type:'text' as const,content:'Foreground — synthetic report',layout:{x:500,y:440,width:650,height:80,zIndex:4}};
  Object.assign(foreground.style,{fill:'transparent',fontSize:24,padding:10,textColor:'#7b1040'});
  const table=structuredClone(tile);table.id='table';table.title=table.name='Raster table';table.visualization='table';table.query.chartType=table.result.query.chartType='table';table.layout={x:80,y:300,width:850,height:380,zIndex:3};
  const hidden={...structuredClone(shape),id:'hidden',name:'Hidden object',hidden:true};
  page.elements=[foreground,shape,hidden];page.tiles=[table,tile];
  return{draft,page,tile,table,shape,foreground};
}
export async function packageParts(blob:Blob) {
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),out=new Map<string,Uint8Array>();let offset=0;
  while(view.getUint32(offset,true)===0x04034b50){
    if(view.getUint16(offset+8,true)!==0)throw Error('Expected stored ZIP entry');
    const size=view.getUint32(offset+18,true),n=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+n+extra;
    out.set(new TextDecoder().decode(bytes.subarray(offset+30,offset+30+n)),bytes.subarray(start,start+size));offset=start+size;
  }
  return out;
}
