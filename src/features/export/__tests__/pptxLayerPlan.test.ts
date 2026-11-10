// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { posix } from 'node:path';
import { planPptxLayers, pptxLayerLimits } from '../pptxLayerPlan';
import { buildPptxBlob } from '../coreDocumentExports';
import { renderPageVisualImages, buildPageVisualSvg } from '../pageVisualExport';
import { buildReportPreflight } from '../reportPreflight';
import { reviewPptxEditability } from '../pptxEditability';
import { layeredFixture, packageParts, tinyPng } from './pptxLayerFixture';
const xml=(value:string)=>new DOMParser().parseFromString(value,'text/xml');
const text=(parts:Map<string,Uint8Array>,path:string)=>new TextDecoder().decode(parts.get(path));

it('plans overlapping shapes, charts, tables and foreground text in renderer order',async()=>{
 const{page}=await layeredFixture(),before=structuredClone(page),plan=planPptxLayers(page);
 expect(plan.mode).toBe('hybrid');if(plan.mode!=='hybrid')throw Error(plan.reason);
 expect(plan.layers.map(layer=>layer.kind==='background'?'background':layer.kind==='element'?layer.element.id:layer.tile.id)).toEqual(['background','backdrop','chart','table','foreground']);
 expect(page).toEqual(before);
});
it('keeps equal z positions stable with elements before tiles and source order within each kind',async()=>{
 const{page,shape}=await layeredFixture();page.elements=[{...shape,id:'second'},shape];page.elements.forEach(e=>e.layout={...e.layout,zIndex:5});page.tiles.forEach(t=>t.layout.zIndex=5);
 const plan=planPptxLayers(page);expect(plan.mode).toBe('hybrid');if(plan.mode!=='hybrid')throw Error();
 expect(plan.layers.slice(1).map(layer=>layer.kind==='element'?layer.element.id:layer.kind==='tile'?layer.tile.id:'')).toEqual(['second','backdrop','table','chart']);
});
it('emits each object exactly once in package order, with valid unique IDs and resolved relationships',async()=>{
 const{page,tile}=await layeredFixture(),before=structuredClone(page),svgs:string[]=[];
 const parts=await packageParts(await buildPptxBlob([page],async svg=>{svgs.push(svg);return tinyPng;}));
 const slide=xml(text(parts,'ppt/slides/slide1.xml')),tree=slide.getElementsByTagName('p:spTree')[0];
 const names=Array.from(tree.children).flatMap(node=>Array.from(node.getElementsByTagName('p:cNvPr')).map(n=>n.getAttribute('name'))).slice(1);
 expect(names).toEqual([`${page.title} background`,'Backdrop','Editable chart context','Editable chart native chart','Raster table','Foreground text']);
 const ids=Array.from(slide.getElementsByTagName('p:cNvPr')).map(node=>node.getAttribute('id'));expect(new Set(ids).size).toBe(ids.length);
 expect(svgs).toHaveLength(3);expect(svgs[0]).not.toContain('Foreground');expect(svgs[1]).toContain('Editable chart');expect(svgs[1]).not.toContain('Raster table');expect(svgs[2]).not.toContain('Editable chart');
 // Only the background layer may paint the page background. All later raster layers are transparent around their own objects.
 expect(svgs[0]).toContain('#e8f3eb');expect(svgs.slice(1).every(svg=>!svg.includes('#e8f3eb'))).toBe(true);
 for(const[path,bytes]of parts){if(!path.endsWith('.rels'))continue;const rels=xml(new TextDecoder().decode(bytes));const relations=Array.from(rels.getElementsByTagName('Relationship'));const relIds=relations.map(rel=>rel.getAttribute('Id'));expect(new Set(relIds).size).toBe(relIds.length);for(const rel of relations){const target=posix.normalize(posix.join(posix.dirname(posix.dirname(path)),rel.getAttribute('Target')!));expect(parts.has(target),`${path} -> ${target}`).toBe(true);}}
 const chart=xml(text(parts,'ppt/charts/chart1.xml'));
 const series=Array.from(chart.getElementsByTagName('c:ser'));expect(series).toHaveLength(tile.result.columns.length);
 series.forEach((ser,i)=>{const values=Array.from(ser.getElementsByTagName('c:val')[0].getElementsByTagName('c:v')).map(node=>Number(node.textContent));expect(values).toEqual(tile.result.table.map(row=>row.values[tile.result.columns[i].id]));expect(Array.from(ser.getElementsByTagName('c:cat')[0].getElementsByTagName('c:v')).map(node=>node.textContent)).toEqual(tile.result.table.map(row=>row.label));});
 expect(text(parts,'ppt/charts/chart1.xml')).toContain('<a:noFill/>');
 expect(text(parts,'ppt/slides/slide1.xml')).toContain('<a:alpha val="60000"/>');
 expect(page).toEqual(before);
});
it('plans each page independently, sorts page order, and assigns contiguous chart IDs',async()=>{
 const{page,shape}=await layeredFixture();const second={...structuredClone(page),id:'second',order:page.order+1};second.elements=[shape];second.tiles[0].hidden=true;
 const parts=await packageParts(await buildPptxBlob([second,page],async()=>tinyPng));
 expect(parts.has('ppt/charts/chart2.xml')).toBe(true);expect(parts.has('ppt/charts/chart3.xml')).toBe(false);
 expect(text(parts,'ppt/slides/_rels/slide1.xml.rels')).toContain('chart1.xml');expect(text(parts,'ppt/slides/_rels/slide2.xml.rels')).toContain('chart2.xml');
 expect(text(parts,'ppt/slides/slide1.xml')).toContain('Foreground text');expect(text(parts,'ppt/slides/slide2.xml')).not.toContain('Foreground text');
});
it('supports transparent page backgrounds and excludes hidden elements and analyses',async()=>{
 const{page,tile}=await layeredFixture();page.background='transparent';tile.hidden=true;const svgs:string[]=[];
 const parts=await packageParts(await buildPptxBlob([page],async svg=>{svgs.push(svg);return tinyPng;}));
 expect(svgs[0]).toContain('fill="transparent"');expect(text(parts,'ppt/slides/slide1.xml')).not.toContain('Hidden object');expect(parts.has('ppt/charts/chart1.xml')).toBe(false);
});
it('uses the complete-slide fallback above bounded object and raster-layer budgets',async()=>{
 const{page,shape}=await layeredFixture();page.tiles=[];page.elements=Array.from({length:pptxLayerLimits.objects+1},(_,i)=>({...shape,id:String(i)}));
 expect(planPptxLayers(page)).toMatchObject({mode:'complete_visual'});const svgs:string[]=[];const parts=await packageParts(await buildPptxBlob([page],async svg=>{svgs.push(svg);return tinyPng;}));
 expect(svgs).toEqual([buildPageVisualSvg(page)]);const slide=text(parts,'ppt/slides/slide1.xml');expect(slide.match(/<p:pic>/g)).toHaveLength(1);expect(slide).not.toContain('<p:sp>');expect(slide).not.toContain('<p:graphicFrame>');
 page.elements=Array.from({length:pptxLayerLimits.rasterLayers},(_,i)=>({...shape,id:String(i),type:'image' as const,content:tinyPng}));expect(planPptxLayers(page)).toMatchObject({mode:'complete_visual',reason:expect.stringContaining('raster-layer budget')});
});
it.each([NaN,Infinity,-Infinity])('falls back when layered geometry cannot be verified (%s)',async x=>{const{page,shape}=await layeredFixture();shape.layout.x=x;expect(planPptxLayers(page).mode).toBe('complete_visual');});
it('reports actual editability in read-only preflight instead of flattening overlapping supported objects',async()=>{
 const{draft,page}=await layeredFixture(),before=structuredClone(draft),review=buildReportPreflight(draft)[0];
 expect(review.pptxEditability).toMatchObject({mode:'hybrid',editableObjects:2,editableCharts:1,imageObjects:1});expect(review.issues.filter(issue=>issue.check==='PowerPoint layers')).toEqual([]);expect(draft).toEqual(before);
 expect(review.pptxEditability).toEqual(reviewPptxEditability(page));
});
it('rejects opaque raster layers instead of obscuring lower objects',async()=>{const{page}=await layeredFixture();await expect(buildPptxBlob([page],async()=> 'data:image/jpeg;base64,/9j/2Q==')).rejects.toThrow('require PNG');});
it('takes a snapshot before awaiting rasterization and never changes authored state',async()=>{
 const{page}=await layeredFixture();let changed=false;const parts=await packageParts(await buildPptxBlob([page],async()=>{if(!changed){changed=true;page.elements[0].content='Changed during export';}return tinyPng;}));
 expect(text(parts,'ppt/slides/slide1.xml')).toContain('Foreground — synthetic report');expect(text(parts,'ppt/slides/slide1.xml')).not.toContain('Changed during export');expect(page.elements[0].content).toBe('Changed during export');
});

it('uses the browser PNG encoder without white paint for transparent layers',async()=>{
 const{page}=await layeredFixture();const fillRect=vi.fn(),drawImage=vi.fn(),revokeObjectURL=vi.fn();
 vi.stubGlobal('URL',{createObjectURL:()=> 'blob:synthetic',revokeObjectURL});
 vi.stubGlobal('Image',class {onload:(()=>void)|null=null;set src(_value:string){this.onload?.();}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect,drawImage} as never);
 const encode=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue(tinyPng);
 try{await renderPageVisualImages([page],{transparent:true,includeBackground:false});expect(fillRect).not.toHaveBeenCalled();expect(drawImage).toHaveBeenCalledOnce();expect(encode).toHaveBeenCalledWith('image/png');expect(revokeObjectURL).toHaveBeenCalledOnce();}
 finally{vi.restoreAllMocks();vi.unstubAllGlobals();}
});
it('interleaves overlapping editable shapes and multiple native charts with their own contexts',async()=>{
 const{page,tile,shape}=await layeredFixture();
 page.elements.push({...structuredClone(shape),id:'circle',name:'Transparent circle',type:'circle',layout:{...shape.layout,zIndex:5},style:{...shape.style,fill:'transparent',opacity:100,borderWidth:2,borderStyle:'solid'}});
 const upper=structuredClone(tile);upper.id='upper-chart';upper.name=upper.title='Upper chart';upper.layout.zIndex=6;page.tiles.push(upper);
 const parts=await packageParts(await buildPptxBlob([page],async()=>tinyPng)),slide=xml(text(parts,'ppt/slides/slide1.xml'));
 const names=Array.from(slide.getElementsByTagName('p:cNvPr')).map(n=>n.getAttribute('name')).slice(1);
 expect(names).toEqual([`${page.title} background`,'Backdrop','Editable chart context','Editable chart native chart','Raster table','Foreground text','Transparent circle','Upper chart context','Upper chart native chart']);
 expect(text(parts,'ppt/slides/slide1.xml')).toContain('prst="ellipse"');expect(text(parts,'ppt/slides/slide1.xml')).toContain('<a:noFill/>');
 expect(reviewPptxEditability(page)).toMatchObject({editableObjects:3,editableCharts:2,imageObjects:1,rasterLayers:4});
});
it('keeps unsupported element paints in a raster layer rather than substituting a native color',async()=>{
 const{page,shape}=await layeredFixture();shape.style.fill='rgba(20,30,40,0.5)';const svgs:string[]=[];
 const parts=await packageParts(await buildPptxBlob([page],async svg=>{svgs.push(svg);return tinyPng;}));
 expect(svgs[1]).toContain('rgba(20,30,40,0.5)');const slide=xml(text(parts,'ppt/slides/slide1.xml'));expect(slide.getElementsByTagName('p:sp')).toHaveLength(1);
 expect(reviewPptxEditability(page)).toMatchObject({editableObjects:1,imageObjects:2,rasterLayers:4});
});

it('rasterizes unsupported translucent chart backgrounds without replacing them with opaque white',async()=>{
 const{page,tile}=await layeredFixture();tile.appearance.chartBackground='rgba(10,20,30,0.25)';const svgs:string[]=[];
 const parts=await packageParts(await buildPptxBlob([page],async svg=>{svgs.push(svg);return tinyPng;}));
 expect(parts.has('ppt/charts/chart1.xml')).toBe(false);expect(svgs[1]).toContain('rgba(10,20,30,0.25)');
 expect(reviewPptxEditability(page)).toMatchObject({editableObjects:2,editableCharts:0,imageObjects:2,rasterLayers:3});
});
