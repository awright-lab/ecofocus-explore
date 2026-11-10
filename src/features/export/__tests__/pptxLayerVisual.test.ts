import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildPptxBlob } from '../coreDocumentExports';
import { buildPageVisualSvg } from '../pageVisualExport';
import { layeredFixture, packageParts } from './pptxLayerFixture';

// Optional real-raster integration: install sharp outside the repo and set its
// package.json path. Normal unit tests use tiny PNGs only as routing probes.
const runtime=process.env.ECOFOCUS_PPTX_SHARP;
it.skipIf(!runtime)('generates a representative synthetic deck with real transparent PNG layers for visual review',async()=>{
 const sharp=createRequire(runtime!)('sharp');
 const out=process.env.ECOFOCUS_PPTX_ARTIFACTS??'/tmp/ecofocus-layered-pptx';mkdirSync(out,{recursive:true});
 const{page,shape}=await layeredFixture();
 const equal=structuredClone(page);equal.id='equal';equal.title='Equal stacking positions';equal.order=page.order+1;equal.elements.forEach(e=>e.layout.zIndex=2);equal.tiles.forEach(t=>t.layout.zIndex=2);
 const transparent=structuredClone(page);transparent.id='transparent';transparent.title='Transparent background';transparent.order=page.order+2;transparent.background='transparent';
 const fallback=structuredClone(page);fallback.id='fallback';fallback.title='Complete slide fallback';fallback.order=page.order+3;fallback.elements=Array.from({length:501},(_,i)=>({...structuredClone(shape),id:`shape-${i}`,layout:{...shape.layout,x:60+i%20,y:60+i%20}}));
 const pages=[page,equal,transparent,fallback],before=JSON.stringify(pages);
 for(const[index,p]of pages.entries()){
   const svg=buildPageVisualSvg(p);writeFileSync(join(out,`expected-${index+1}.svg`),svg);writeFileSync(join(out,`expected-${index+1}.png`),await sharp(Buffer.from(svg)).png().toBuffer());
 }
 let index=0;
 const deck=await buildPptxBlob(pages,async(svg,width,height)=>{
   const png=await sharp(Buffer.from(svg)).resize(width,height).png().toBuffer();
   writeFileSync(join(out,`layer-${++index}.svg`),svg);writeFileSync(join(out,`layer-${index}.png`),png);
   const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   // The chart context starts away from (0,0): full-page paint must not leak into it.
   if([2,3,5,6,8,9].includes(index))expect(data[info.channels-1]).toBe(0);
   return `data:image/png;base64,${png.toString('base64')}`;
 });
 writeFileSync(join(out,'synthetic-layered.pptx'),new Uint8Array(await deck.arrayBuffer()));
 const parts=await packageParts(deck);expect(parts.has('ppt/charts/chart3.xml')).toBe(true);expect(parts.has('ppt/charts/chart4.xml')).toBe(false);
 expect(JSON.stringify(pages)).toBe(before);
},60_000);
