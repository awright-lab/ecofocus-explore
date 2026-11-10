// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { analyticalCell } from '../../../../shared/analytics/resultCells';
import { canReconstructTileAsNativePptxChart, buildNativePptxChartDescriptor } from '../pptxNativeCharts';
import { planPptxLayers } from '../pptxLayerPlan';
import { reviewPptxEditability } from '../pptxEditability';
import { buildReportPreflight } from '../reportPreflight';
import { buildPptxBlob } from '../coreDocumentExports';
import { layeredFixture, packageParts, tinyPng } from './pptxLayerFixture';

const xml=(value:string)=>new DOMParser().parseFromString(value,'text/xml');
const text=(parts:Map<string,Uint8Array>,path:string)=>new TextDecoder().decode(parts.get(path));

it.each(['vertical_bar','grouped_bar','stacked_bar'] as const)('rejects any available negative value for native %s, including after positive cells',async kind=>{
 const {tile}=await layeredFixture();tile.visualization=kind;
 expect(canReconstructTileAsNativePptxChart(tile)).toBe(true);
 const row=tile.result.table.at(-1)!,column=tile.result.columns.at(-1)!;
 row.values[column.id]=-Number.MIN_VALUE;
 const before=structuredClone(tile);
 expect(canReconstructTileAsNativePptxChart(tile)).toBe(false);
 expect(tile).toEqual(before);
});

it.each([0,-0,Number.MIN_VALUE,20])('keeps nonnegative available values native without rounding (%s)',async amount=>{
 const {tile}=await layeredFixture();
 tile.result.table.forEach(row=>tile.result.columns.forEach(column=>{row.values[column.id]=amount;}));
 expect(canReconstructTileAsNativePptxChart(tile)).toBe(true);
});

it('uses analytical availability rather than stale negative transport values or fabricated zeros',async()=>{
 const {tile}=await layeredFixture({signed:true});
 tile.result.metric.id='average';tile.result.query.metric=tile.query.metric='average';
 if(tile.result.metadataRefs.source?.kind!=='imported')throw Error('fixture');
 tile.result.metadataRefs.source.measureBaseScope='cell';
 const row=tile.result.table[0],column=tile.result.columns[0];row.bases[column.id]=0;
 expect(analyticalCell(tile.result,row,column.id)).toEqual({status:'no_observations',value:null});
 const before=structuredClone(tile);
 expect(canReconstructTileAsNativePptxChart(tile)).toBe(true);
 const chart=xml(buildNativePptxChartDescriptor(tile,1,3,'rId2').chartXml);
 const values=chart.getElementsByTagName('c:val')[0];
 expect(Array.from(values.getElementsByTagName('c:pt')).map(point=>point.getAttribute('idx'))).toEqual(['1']);
 expect(row.values[column.id]).toBe(-20);expect(tile).toEqual(before);
 tile.result.table.forEach(row=>tile.result.columns.forEach(column=>{row.bases[column.id]=0;}));
 expect(canReconstructTileAsNativePptxChart(tile)).toBe(false);
});

it.each(['vertical_bar','grouped_bar','stacked_bar'] as const)('exports signed %s as a complete transparent tile with exact values and downward negative geometry',async kind=>{
 const {draft,page,tile}=await layeredFixture({signed:true});
 tile.visualization=tile.query.chartType=tile.result.query.chartType=kind;
 if(kind==='vertical_bar')tile.result.columns=tile.result.columns.slice(0,1);
 const before=structuredClone(draft),svgs:string[]=[];
 expect(planPptxLayers(page)).toMatchObject({mode:'hybrid'});
 expect(reviewPptxEditability(page)).toMatchObject({editableObjects:2,editableCharts:0,imageObjects:2,rasterLayers:3,objects:expect.arrayContaining([{id:tile.id,name:tile.title,mode:'Image layer'}])});
 expect(buildReportPreflight(draft)[0].pptxEditability).toEqual(reviewPptxEditability(page));
 const parts=await packageParts(await buildPptxBlob([page],async svg=>{svgs.push(svg);return tinyPng;}));
 expect([...parts.keys()].filter(path=>path.startsWith('ppt/charts/'))).toEqual([]);
 const slide=xml(text(parts,'ppt/slides/slide1.xml'));
 expect(Array.from(slide.getElementsByTagName('p:cNvPr')).map(node=>node.getAttribute('name')).slice(1)).toEqual([`${page.title} background`,'Backdrop','Editable chart','Raster table','Foreground text']);
 expect(slide.getElementsByTagName('p:sp')).toHaveLength(2);
 expect(slide.getElementsByTagName('p:pic')).toHaveLength(3);
 expect(svgs).toHaveLength(3);expect(svgs[1]).not.toContain(page.background);
 const chart=xml(svgs[1]),bars=Array.from(chart.querySelectorAll('g[data-value]'));
 expect(bars.map(bar=>Number(bar.getAttribute('data-value')))).toEqual(tile.result.table.flatMap(row=>tile.result.columns.map(column=>row.values[column.id])));
 const zeroLine=Array.from(chart.getElementsByTagName('line')).find(line=>line.getAttribute('y1')===line.getAttribute('y2'))!;
 const zeroY=Number(zeroLine.getAttribute('y1'));
 for(const bar of bars){
   const amount=Number(bar.getAttribute('data-value')),rect=bar.getElementsByTagName('rect')[0],y=Number(rect.getAttribute('y')),height=Number(rect.getAttribute('height'));
   expect(height).toBeGreaterThanOrEqual(0);
   if(amount<0){expect(y).toBeCloseTo(zeroY);expect(height).toBeGreaterThan(0);}
   else if(amount>0){expect(y).toBeLessThan(zeroY);expect(y+height).toBeCloseTo(zeroY);}
   else expect(height).toBe(0);
 }
 expect(draft).toEqual(before);
});

it('preserves editable positive charts, objects, contiguous chart IDs and order beside a signed image layer',async()=>{
 const {page,tile}=await layeredFixture({signed:true}),positive=(await layeredFixture()).tile;
 tile.title=tile.name='Signed chart';positive.id='positive';positive.title=positive.name='Positive chart';positive.layout.zIndex=5;page.tiles.push(positive);
 const parts=await packageParts(await buildPptxBlob([page],async()=>tinyPng));
 const slide=xml(text(parts,'ppt/slides/slide1.xml'));
 expect(Array.from(slide.getElementsByTagName('p:cNvPr')).map(node=>node.getAttribute('name')).slice(1)).toEqual([`${page.title} background`,'Backdrop','Signed chart','Raster table','Foreground text','Positive chart context','Positive chart native chart']);
 expect(parts.has('ppt/charts/chart1.xml')).toBe(true);expect(parts.has('ppt/charts/chart2.xml')).toBe(false);
 expect(text(parts,'ppt/charts/chart1.xml')).not.toContain('<c:v>-20</c:v>');
 expect(reviewPptxEditability(page)).toMatchObject({editableObjects:2,editableCharts:1,imageObjects:2,rasterLayers:4});
});

it.each(['vertical_bar','grouped_bar','stacked_bar'] as const)('preserves all-negative %s geometry without converting any value to a magnitude',async kind=>{
 const {page,tile}=await layeredFixture({signed:true});page.tiles=[tile];
 tile.visualization=tile.query.chartType=tile.result.query.chartType=kind;
 if(kind==='vertical_bar')tile.result.columns=tile.result.columns.slice(0,1);
 tile.result.table.forEach((row,i)=>tile.result.columns.forEach((column,j)=>{row.values[column.id]=-(i+1)*(j+1)*10;}));
 const before=structuredClone(tile);let body='';
 const parts=await packageParts(await buildPptxBlob([page],async svg=>{if(svg.includes('data-value='))body=svg;return tinyPng;}));
 expect(parts.has('ppt/charts/chart1.xml')).toBe(false);
 const chart=xml(body),zeroLine=Array.from(chart.getElementsByTagName('line')).find(line=>line.getAttribute('y1')===line.getAttribute('y2'))!;
 const zeroY=Number(zeroLine.getAttribute('y1')),bars=Array.from(chart.querySelectorAll('g[data-value]'));
 expect(bars.map(bar=>Number(bar.getAttribute('data-value')))).toEqual(tile.result.table.flatMap(row=>tile.result.columns.map(column=>row.values[column.id])));
 const ends=new Map<string,number>();
 for(const bar of bars){
   const rect=bar.getElementsByTagName('rect')[0],y=Number(rect.getAttribute('y')),height=Number(rect.getAttribute('height')),row=bar.getAttribute('data-row')!;
   expect(y).toBeCloseTo(kind==='stacked_bar'?(ends.get(row)??zeroY):zeroY);expect(height).toBeGreaterThan(0);ends.set(row,y+height);
 }
 expect(tile).toEqual(before);
});
