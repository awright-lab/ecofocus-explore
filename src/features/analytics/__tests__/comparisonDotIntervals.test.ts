// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { wilson95 } from '../../significance-review/proportionIntervalModel';
import { dotIntervalCandidate, dotIntervalMethod, dotIntervals } from '../dotPlotIntervals';
import { dotPlotDrawing, dotPlotSvg } from '../dotPlotSvg';
import { comparisonIntervalFixture, independentGroups } from './comparisonIntervalFixture';
import { runImportedDatasetQuery } from '../../data/importedDatasetAnalytics';
import { buildPageVisualSvg } from '../../export/pageVisualExport';
import { buildXlsxWorkbookPlan } from '../../export/xlsxWorkbookPlan';

// Independent references: 80-digit Python Decimal bisection of the score
// equation (k - n*p)^2 - z^2*n*p*(1-p) = 0, z=1.95996398454005423552.
// 250 iterations on each side of k/n; no production center/radius formula used.
// Method reference: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
const vectors=[
 [0,1,0,.79345068562276266],[1,1,.20654931437723739,1],
 [0,3,0,.56149703175504551],[3,3,.43850296824495449,1],
 [1,3,.061491944720396229,.79234039919795229],
 [0,5,0,.43448246478317482],[5,5,.56551753521682513,1],
 [3,7,.1582198552514697,.74954163547234276],
 [50,100,.40383153036599562,.59616846963400438],
 [1,50000,.0000035304998228320958,.00011328970139120265],
 [0,50000,0,.000076823274145000544],[50000,50000,.99992317672585496,1]
];
it.each(vectors)('matches independent score-inversion reference %s/%s', (k,n,lower,upper)=>{
 const actual=wilson95(k,n)!;expect(actual.lower).toBeCloseTo(lower,14);expect(actual.upper).toBeCloseTo(upper,14);expect(actual.rate).toBe(k/n);
});
it('distinguishes no respondents from missing/corrupt counts',()=>{
 expect(wilson95(0,0)).toBeNull();
 for(const[k,n]of[[undefined,1],[null,1],[1,undefined],[1,null],[.5,2],[2,1],[0,-1],[0,50001]])expect(()=>wilson95(k as number,n as number)).toThrow();
});
const area={x:0,y:0,width:1800,height:2200},format=(value:number|null)=>value===null?'Unavailable':`${Number(value.toFixed(2))}%`;
const parse=(svg:string)=>new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`,'image/svg+xml');
function declare(tile:Awaited<ReturnType<typeof comparisonIntervalFixture>>['tile']){tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(tile).binding};}

it.each(['paired','small_multiples'] as const)('associates every %s interval, estimate and base with the correct category and series',async layout=>{
 const f=await comparisonIntervalFixture();f.tile.appearance.dotPlotLayout=layout;f.tile.appearance.showBases=false;
 const before=structuredClone(f),tree=parse(dotPlotSvg(f.tile,area,format));expect(tree.querySelector('parsererror')).toBeNull();
 expect(tree.querySelectorAll('[data-dot-interval]')).toHaveLength(4);
 for(const cell of tree.querySelectorAll('[data-dot-row]')){
  const row=f.tile.result.table.find(row=>row.optionId===cell.getAttribute('data-dot-row'))!;
  const column=f.tile.result.columns.find(column=>column.id===cell.getAttribute('data-dot-column'))!;
  const group=independentGroups.find(group=>group.label===column.label)!;
  const k=row.label==='Selected'?group.events:group.base-group.events;
  const reference=vectors.find(vector=>vector[0]===k&&vector[1]===group.base)!;
  const ci=cell.querySelector('[data-dot-interval]')!,line=ci.querySelector('line')!;
  expect(Number(ci.getAttribute('data-events'))).toBe(k);expect(Number(ci.getAttribute('data-valid-base'))).toBe(group.base);
  expect(Number(ci.getAttribute('data-lower'))).toBeCloseTo(reference[2],14);expect(Number(ci.getAttribute('data-upper'))).toBeCloseTo(reference[3],14);
  const plot=cell.closest('[data-dot-width]')!,start=Number(plot.getAttribute('data-dot-x')),width=Number(plot.getAttribute('data-dot-width'));
  expect(Number(line.getAttribute('x1'))).toBeCloseTo(start+reference[2]*width,9);expect(Number(line.getAttribute('x2'))).toBeCloseTo(start+reference[3]*width,9);
  const point=cell.querySelector(':scope > circle,:scope > rect')!;
  const y=Number(point.getAttribute(point.tagName==='circle'?'cy':'y'))+(point.tagName==='rect'?(layout==='paired'?6:4):0);
  expect(Number(line.getAttribute('y1'))).toBe(y);
  expect(cell.querySelector('title')!.textContent).toContain(`${row.label} / ${column.label}`);expect(cell.textContent).toContain(`n=${group.base}`);
  expect(cell.textContent).toContain(`${k} events / ${group.base} valid respondents`);expect(cell.textContent).toContain('Small valid base');
 }
 if(layout==='paired')for(const connector of tree.querySelectorAll('[data-dot-pair]')){
   const cells=Array.from(tree.querySelectorAll('[data-dot-row]')).filter(cell=>cell.getAttribute('data-dot-row')===connector.getAttribute('data-dot-pair'));
   expect(Number(connector.getAttribute('y1'))).toBe(Number(cells[0].querySelector('[data-dot-interval] line')!.getAttribute('y1')));
   expect(Number(connector.getAttribute('y2'))).toBe(Number(cells[1].querySelector('[data-dot-interval] line')!.getAttribute('y1')));
   expect(connector.getAttribute('y1')).not.toBe(connector.getAttribute('y2'));
 }
 expect(tree.querySelector('desc')!.textContent).toContain('overlap does not test significance');expect(tree.documentElement.textContent).toContain('do not imply paired respondents');expect(f).toEqual(before);
});
it('retains empty groups and excludes missing answers from valid respondent bases',async()=>{
 const f=await comparisonIntervalFixture(independentGroups,2);f.tile.appearance.dotPlotLayout='small_multiples';
 const cells=dotIntervals(f.tile)!,tree=parse(dotPlotSvg(f.tile,area,format));expect(tree.querySelectorAll('[data-small-panel]')).toHaveLength(4);
 f.tile.result.columns.forEach((column,c)=>{const group=independentGroups.find(group=>group.label===column.label)!;expect(cells[0][c].base).toBe(group.base);});
 const empty=f.tile.result.columns.find(column=>column.label==='No valid answers')!;
 const emptyCells=Array.from(tree.querySelectorAll('[data-dot-row]')).filter(cell=>cell.getAttribute('data-dot-column')===empty.id);
 expect(emptyCells).toHaveLength(2);for(const cell of emptyCells){expect(cell.getAttribute('data-dot-value')).toBe('unavailable');expect(cell.querySelector('[data-dot-interval]')).toBeNull();expect(cell.querySelector(':scope > circle,:scope > rect')).toBeNull();expect(cell.textContent).toContain('CI unavailable: no valid respondents');}
 const zero=tree.querySelector('[data-dot-value="0"]')!;expect(zero.querySelector('[data-dot-interval]')).not.toBeNull();expect(tree.querySelectorAll('[data-dot-interval]')).toHaveLength(6);
});
it('does not connect a missing paired estimate to an observed zero',async()=>{
 const f=await comparisonIntervalFixture([independentGroups[1],independentGroups[3]],1);f.tile.appearance.dotPlotLayout='paired';
 const tree=parse(dotPlotSvg(f.tile,area,format));expect(tree.querySelectorAll('[data-dot-pair]')).toHaveLength(0);expect(tree.querySelectorAll('[data-dot-interval]')).toHaveLength(2);
});
it.each(['paired','small_multiples'] as const)('preserves identities after explicit review of reordered %s categories and series',async layout=>{
 const f=await comparisonIntervalFixture(),tile=f.tile;tile.appearance.dotPlotLayout=layout;
 const expected=new Map(dotIntervals(tile)!.flatMap((row,r)=>row.map((cell,c)=>[`${tile.result.table[r].optionId}/${tile.result.columns[c].id}`,cell])));
 tile.result.table.reverse();tile.result.columns.reverse();expect(()=>dotIntervals(tile)).toThrow('calculation changed');declare(tile);
 const tree=parse(dotPlotSvg(tile,area,format));for(const node of tree.querySelectorAll('[data-dot-interval]')){const cell=node.parentElement!,ref=expected.get(`${cell.getAttribute('data-dot-row')}/${cell.getAttribute('data-dot-column')}`)!;expect(Number(node.getAttribute('data-events'))).toBe(ref.events);expect(Number(node.getAttribute('data-valid-base'))).toBe(ref.base);}
});
it('requires a declaration, keeps it across supported layouts, and retains it on explicit unsafe-layout refusal',async()=>{
 const {tile}=await comparisonIntervalFixture(),declaration=tile.appearance.dotPlotIntervals;
 for(const layout of ['separate','paired','small_multiples','paired'] as const){tile.appearance.dotPlotLayout=layout;expect(parse(dotPlotSvg(tile,area,format)).querySelectorAll('[data-dot-interval]')).toHaveLength(4);expect(tile.appearance.dotPlotIntervals).toBe(declaration);}
 tile.appearance.dotPlotLayout='slope';expect(()=>dotPlotSvg(tile,area,format)).toThrow('cannot be represented safely');expect(tile.appearance.dotPlotIntervals).toBe(declaration);
 delete tile.appearance.dotPlotIntervals;expect(dotIntervals(tile)).toBeNull();expect(dotPlotSvg(tile,area,format)).not.toContain('data-dot-interval');
});
it.each(['query','source identity','source routing','result counts','series','metric label','source fingerprint'] as const)('invalidates an explicit declaration on changed %s',async kind=>{
 const {tile,dataset}=await comparisonIntervalFixture(),declaration=tile.appearance.dotPlotIntervals;
 if(kind==='query')tile.query.confidenceLevel=.9;
 if(kind==='source identity'){
  dataset.importedAt='2026-11-10T12:00:00Z';tile.result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],metric:'percent_selected',chartType:'dot_plot'});tile.query=structuredClone(tile.result.query);
 }
 if(kind==='source routing'&&tile.source?.kind==='importedField')tile.source.sourceRef={...tile.result.query.sourceRef!,provider:'netlify'};
 if(kind==='result counts')tile.result.table[0].bases[tile.result.columns[0].id]++;
 if(kind==='series')tile.result.series[0].values[0]++;
 if(kind==='metric label')tile.result.metric.label='New meaning';
 if(kind==='source fingerprint')tile.result.localExecution={sourceDigest:'a'.repeat(64)} as never;
 expect(()=>dotIntervals(tile)).toThrow();expect(()=>dotPlotSvg(tile,area,format)).toThrow();expect(tile.appearance.dotPlotIntervals).toBe(declaration);
});
it.each(['paired','small_multiples'] as const)('preserves analytical values, workbook cells and full rendered %s output or refuses unsafe fit',async layout=>{
 const f=await comparisonIntervalFixture();f.tile.appearance.dotPlotLayout=layout;const before=structuredClone(f);
 const svg=buildPageVisualSvg(f.draft.pages[0]);expect(svg.match(/data-dot-interval=/g)).toHaveLength(4);expect(svg).toContain('overlap does not test significance');
 const workbook=buildXlsxWorkbookPlan(f.draft,f.draft.pages,'2026-11-10T12:00:00Z');delete f.tile.appearance.dotPlotIntervals;
 expect(buildXlsxWorkbookPlan(f.draft,f.draft.pages,'2026-11-10T12:00:00Z')).toEqual(workbook);f.tile.appearance.dotPlotIntervals=before.tile.appearance.dotPlotIntervals;
 expect(()=>dotPlotSvg(f.tile,{...area,width:240},format)).toThrow('cannot fit');expect(f).toEqual(before);
 const many=await comparisonIntervalFixture(independentGroups);many.tile.appearance.dotPlotLayout=layout;
 if(layout==='paired')expect(()=>dotPlotSvg(many.tile,area,format)).toThrow('exactly two');
 else {expect(()=>dotPlotSvg(many.tile,{...area,height:100},format)).toThrow('no points were truncated');expect(dotPlotDrawing(many.tile,1800,120,format).height).toBeGreaterThan(120);}
});
it('refuses a non-dot output with retained intervals instead of silently omitting them',async()=>{
 const f=await comparisonIntervalFixture();f.tile.visualization='table';expect(()=>buildPageVisualSvg(f.draft.pages[0])).toThrow('cannot represent');expect(f.tile.appearance.dotPlotIntervals).toBeDefined();
});

it.each((['paired','small_multiples'] as const).flatMap(layout=>['weighted','remote','derived','rounded','missing counts'].map(problem=>({layout,problem}))))('explains unsupported $layout / $problem instead of inferring counts',async({layout,problem})=>{
 const {tile}=await comparisonIntervalFixture();tile.appearance.dotPlotLayout=layout;
 if(problem==='weighted')tile.result.weighting.applied=true;
 if(problem==='remote')tile.result.query.sourceRef!.provider='netlify';
 if(problem==='derived')tile.analysisLifecycle={role:'derived'} as never;
 if(problem==='rounded')delete tile.result.calculationInputs!.percentageValueMode;
 if(problem==='missing counts')delete tile.result.calculationInputs;
 const before=structuredClone(tile);
 expect(()=>dotIntervals(tile)).toThrow(problem==='weighted'?'Weighted':problem==='remote'?'Remote':problem==='derived'?'Derived':'exact recorded respondent counts');
 expect(()=>dotPlotSvg(tile,area,format)).toThrow();expect(tile).toEqual(before);
});
