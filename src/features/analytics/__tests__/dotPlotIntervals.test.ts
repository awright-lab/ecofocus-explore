// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {dotIntervalCandidate,dotIntervals,dotIntervalMethod} from '../dotPlotIntervals';
import {dotPlotSvg,dotPlotDrawing} from '../dotPlotSvg';
import {dotIntervalFixture} from './dotIntervalFixture';
import {dotPlotFixture} from './dotPlotFixture';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
const area={x:0,y:0,width:1400,height:700},format=(v:number|null)=>v===null?'Unavailable':`${v}%`;
it('uses exact recorded integer counts and shared0–100geometry without changing the query or observations',async()=>{
 const f=await dotIntervalFixture(),before=structuredClone(f),model=dotIntervals(f.tile)!;expect(model.flat().map(c=>[c.events,c.base])).toEqual([[1,2],[1,2],[1,2],[1,2]]);
 for(const cell of model.flat()){expect(cell.interval!.lower).toBeCloseTo(.0945312057342307,14);expect(cell.interval!.upper).toBeCloseTo(.905468794265769,14);}
 const svg=dotPlotSvg(f.tile,area,format),tree=new DOMParser().parseFromString(`<svg>${svg}</svg>`,'image/svg+xml'),plot=tree.querySelector('[data-dot-width]')!,start=Number(plot.getAttribute('data-dot-x')),width=Number(plot.getAttribute('data-dot-width'));
 expect(tree.querySelectorAll('[data-dot-interval]')).toHaveLength(4);for(const interval of tree.querySelectorAll('[data-dot-interval]')){const line=interval.querySelector('line')!;expect(Number(line.getAttribute('x1'))).toBeCloseTo(start+width*.0945312057342307,10);expect(Number(line.getAttribute('x2'))).toBeCloseTo(start+width*.905468794265769,10);expect(interval.parentElement!.querySelector('title')!.textContent).toContain('1 events / 2 valid respondents');}
 expect(svg).toContain('95% CI');expect(svg).not.toContain('NaN');expect(f).toEqual(before);
});
it.each(['weighted','requested weight','remote','count','mean','no counts','legacy rounded','changed value','changed base','authored','derived','transient audience'] as const)('refuses unsupported %s without replacing or silently dropping intervals',async problem=>{
 const f=await dotIntervalFixture(),t=f.tile;
 if(problem==='weighted')t.result.weighting.applied=true;if(problem==='requested weight')t.result.query.weight='weightvar';if(problem==='remote')t.result.query.sourceRef!.provider='snowflake';if(problem==='count')t.result.metric.id='count';if(problem==='mean')t.result.metric.id='average';if(problem==='no counts')delete t.result.calculationInputs;if(problem==='legacy rounded')delete t.result.calculationInputs!.percentageValueMode;if(problem==='changed value')t.result.table[0].values[t.result.columns[0].id]=0;if(problem==='changed base')t.result.table[0].bases[t.result.columns[0].id]=3;
 if(problem==='authored')t.result.metadataRefs.authoredVariableSet={id:'authored',label:'Authored',applied:true};if(problem==='derived')t.derivedOutput={} as NonNullable<typeof t.derivedOutput>;if(problem==='transient audience'&&t.result.query.sourceIdentity?.kind==='imported')t.result.query.sourceIdentity.intersectionAudience={} as never;
 const before=structuredClone(t);expect(()=>dotIntervals(t)).toThrow();expect(()=>dotPlotSvg(t,area,format)).toThrow();expect(t).toEqual(before);
});
it('keeps historical no-interval charts untouched and requires no inference metadata',async()=>{const {tile}=await dotPlotFixture(),before=structuredClone(tile);expect(dotIntervals(tile)).toBeNull();expect(dotPlotSvg(tile,area,format)).not.toContain('data-dot-interval');expect(tile).toEqual(before);});
it('binds the declaration to calculation context and demands explicit renewal after a fresh different result',async()=>{
 const f=await dotIntervalFixture(),old=f.tile.appearance.dotPlotIntervals;f.tile.result=runImportedDatasetQuery({dataset:f.dataset,field:f.dataset.fields[0],metric:'percent_selected',chartType:'dot_plot'});f.tile.query=structuredClone(f.tile.result.query);expect(()=>dotIntervals(f.tile)).toThrow('recorded calculation changed');expect(f.tile.appearance.dotPlotIntervals).toBe(old);f.tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(f.tile).binding};expect(dotIntervals(f.tile)!.flat()).toHaveLength(2);
});
it.each([null,{method:'other',binding:'x'},{method:dotIntervalMethod,binding:1}])('does not infer a declaration from malformed saved metadata %s',async declaration=>{const {tile}=await dotIntervalFixture();(tile.appearance as unknown as Record<string,unknown>).dotPlotIntervals=declaration;expect(()=>dotIntervals(tile)).toThrow('unsupported interval declaration');});
it('does not make certain zero/all estimates or draw empty-base intervals',async()=>{
 const f=await dotIntervalFixture();f.dataset.rows=f.dataset.rows.filter(row=>row.Banner==='X');f.dataset.rowCount=f.dataset.rows.length;f.tile.result=runImportedDatasetQuery({dataset:f.dataset,field:f.dataset.fields[0],bannerField:f.dataset.fields[1],metric:'percent_selected',chartType:'dot_plot'});f.tile.query=structuredClone(f.tile.result.query);f.tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(f.tile).binding};const intervals=dotIntervals(f.tile)!;for(const c of intervals.flat())if(c.base===0)expect(c.interval).toBeNull();expect(dotPlotSvg(f.tile,area,format)).not.toContain('NaN');
});
it('retains explicit fit refusals and a complete scrolled drawing',async()=>{const {tile}=await dotIntervalFixture(),before=structuredClone(tile);expect(()=>dotPlotSvg(tile,{...area,width:400},format)).toThrow('cannot fit');expect(dotPlotDrawing(tile,1500,150,format).height).toBeGreaterThan(150);expect(tile).toEqual(before);});

it('shows uncertainty at observed0%and100%, retaining absent cells as unavailable',async()=>{
 const f=await dotIntervalFixture();for(const row of f.dataset.rows)row.Answer=row.Banner==='X'?'A':'B';f.tile.result=runImportedDatasetQuery({dataset:f.dataset,field:f.dataset.fields[0],bannerField:f.dataset.fields[1],metric:'percent_selected',chartType:'dot_plot'});f.tile.query=structuredClone(f.tile.result.query);f.tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(f.tile).binding};const cells=dotIntervals(f.tile)!.flat();expect(cells.map(c=>c.events)).toEqual([2,0,0,2]);for(const cell of cells){if(cell.events===0){expect(cell.interval!.lower).toBe(0);expect(cell.interval!.upper).toBeGreaterThan(.6);}else{expect(cell.interval!.lower).toBeLessThan(.4);expect(cell.interval!.upper).toBe(1);}}
});
it.each([50000,50001])('retains rare-event precision within the validated respondent bound: n=%s',async base=>{
 const f=await dotIntervalFixture();f.dataset.rows=Array.from({length:base},(_,i)=>({Answer:i===0?'A':'B',Banner:'X',Amount:'1'}));f.dataset.rowCount=base;f.tile.result=runImportedDatasetQuery({dataset:f.dataset,field:f.dataset.fields[0],bannerField:f.dataset.fields[1],metric:'percent_selected',chartType:'dot_plot'});f.tile.query=structuredClone(f.tile.result.query);
 if(base>50000){expect(()=>dotIntervalCandidate(f.tile)).toThrow('50,000');return;}
 f.tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(f.tile).binding};const cell=dotIntervals(f.tile)!.flat().find(cell=>cell.events===1&&cell.base===50000)!;expect(cell).toBeDefined();expect(cell.events).toBe(1);expect(cell.interval!.rate).toBe(.00002);expect(cell.interval!.lower).toBeGreaterThan(0);const svg=dotPlotSvg(f.tile,area,format);expect(svg).toContain('data-events="1" data-valid-base="50000"');expect(svg).not.toContain('CI 0.0% to 0.0%');
});
