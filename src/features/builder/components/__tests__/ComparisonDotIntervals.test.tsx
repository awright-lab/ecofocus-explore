// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DotPlotView } from '../DotPlotView';
import { ChartView } from '../CanvasRenderers';
import { DotPlotIntervalControl } from '../DotPlotIntervalControl';
import { TileAnalysisDisplaySection } from '../InspectorTileAnalysisSections';
import type { BuilderInspectorProps } from '../BuilderInspector';
import type { DashboardTile, TileAppearance } from '../../../../../shared/types/dashboard';
import { comparisonIntervalFixture, independentGroups } from '../../../analytics/__tests__/comparisonIntervalFixture';
const format=(value:number|null)=>value===null?'Unavailable':`${Number(value.toFixed(2))}%`;
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
function Harness({initial,onSnapshot}:{initial:DashboardTile;onSnapshot:(tile:DashboardTile)=>void}){
 const[tile,setTile]=useState(initial);useEffect(()=>onSnapshot(tile),[tile,onSnapshot]);
 const props={selectedTile:tile,updateSelectedAppearance:(patch:Partial<TileAppearance>)=>setTile(current=>({...current,appearance:{...current.appearance,...patch}}))} as BuilderInspectorProps;
 return <><TileAnalysisDisplaySection {...props}/><DotPlotView tile={tile} format={format}/></>;
}
async function switchLayout(layout:string){await act(async()=>{const select=host.querySelector<HTMLSelectElement>('[aria-label="Dot layout"]')!;select.value=layout;select.dispatchEvent(new Event('change',{bubbles:true}));});}
async function toggle(){await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Show individual 95% Wilson intervals"]')!.click());}
it.each(['paired','small_multiples'] as const)('requires the author declaration in the actual %s format control and preserves it when switching supported layouts',async layout=>{
 const {tile}=await comparisonIntervalFixture();delete tile.appearance.dotPlotIntervals;tile.appearance.dotPlotLayout=layout;
 const before=structuredClone(tile),snapshots:DashboardTile[]=[];const onSnapshot=(value:DashboardTile)=>{snapshots.push(value);};
 await act(async()=>root.render(<Harness initial={tile} onSnapshot={onSnapshot}/>));
 const checkbox=host.querySelector<HTMLInputElement>('[aria-label="Show individual 95% Wilson intervals"]')!;expect(checkbox.checked).toBe(false);expect(checkbox.disabled).toBe(false);expect(host.querySelector('[data-dot-interval]')).toBeNull();
 checkbox.focus();await toggle();expect(document.activeElement).toBe(checkbox);expect(host.querySelectorAll('[data-dot-interval]')).toHaveLength(4);
 const declaration=snapshots.at(-1)!.appearance.dotPlotIntervals;
 for(const next of ['separate','paired','small_multiples'] as const){await switchLayout(next);expect(host.querySelectorAll('[data-dot-interval]')).toHaveLength(4);expect(snapshots.at(-1)!.appearance.dotPlotIntervals).toBe(declaration);}
 await switchLayout('slope');expect(host.querySelector('[data-dot-interval]')).toBeNull();expect(host.textContent).toContain('cannot be represented safely');expect(snapshots.at(-1)!.appearance.dotPlotIntervals).toBe(declaration);
 await switchLayout(layout);expect(host.querySelectorAll('[data-dot-interval]')).toHaveLength(4);
 await toggle();expect(host.querySelector('[data-dot-interval]')).toBeNull();expect(host.querySelector('[role="region"]')).not.toBeNull();
 for(const snapshot of snapshots){expect(snapshot.result).toEqual(before.result);expect(snapshot.query).toEqual(before.query);expect(snapshot.source).toEqual(before.source);}
 expect(tile).toEqual(before);
});
it.each(['paired','small_multiples'] as const)('keeps %s HTML interval values, samples, aliases and cautions keyboard accessible when labels and bases are hidden',async layout=>{
 const{tile}=await comparisonIntervalFixture();tile.appearance.dotPlotLayout=layout;tile.appearance.showBases=false;tile.appearance.showValueLabels=false;
 tile.appearance.axisLabelOverrides={[tile.result.table[0].optionId]:'Custom answer <not selected>',[tile.result.columns[0].id]:'Custom series <all>'};const before=structuredClone(tile);
 await act(async()=>root.render(<DotPlotView tile={tile} format={format}/>));
 const details=host.querySelector<HTMLDetailsElement>('[aria-label="Exact rate interval values"]')!,summary=details.querySelector('summary')!;
 expect(details.closest('svg')).toBeNull();expect(details.querySelectorAll('li')).toHaveLength(4);
 expect(details.textContent).toContain('Custom answer <not selected>');expect(details.textContent).toContain('Custom series <all>');expect(details.textContent).toContain('3 valid respondents');expect(details.textContent).toContain('Small valid base');
 expect(host.textContent).toContain('overlap does not test significance');expect(host.textContent).toContain('do not imply paired respondents');expect(host.textContent).toContain('change over time');expect(host.querySelector('svg')!.getAttribute('aria-label')).toContain('individual 95% Wilson intervals');
 summary.focus();await act(async()=>summary.click());expect(details.open).toBe(true);expect(document.activeElement).toBe(summary);
 const button=host.querySelector('button')!;await act(async()=>button.click());expect(document.querySelector('[role="dialog"]')).not.toBeNull();expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Selected');expect(tile).toEqual(before);
});
it.each(['source','query','result'] as const)('invalidates the declaration visibly after a %s change and requires an explicit off/on review',async kind=>{
 const{tile}=await comparisonIntervalFixture();tile.appearance.dotPlotLayout='small_multiples';const change=vi.fn();
 const render=()=>act(async()=>root.render(<><DotPlotIntervalControl tile={tile} onChange={change}/><DotPlotView tile={tile} format={format}/></>));await render();
 if(kind==='query')tile.query.confidenceLevel=.9;
 if(kind==='source'&&tile.source?.kind==='importedField')tile.source.id='replaced-source-record';
 if(kind==='result')tile.result.metric.label='Revised label';
 await render();expect(host.querySelector('[data-dot-interval]')).toBeNull();expect(host.querySelector('[aria-label="Exact rate interval values"]')).toBeNull();expect(host.querySelector('[role="status"]')).not.toBeNull();
 const input=host.querySelector<HTMLInputElement>('[aria-label="Show individual 95% Wilson intervals"]')!;expect(input.checked).toBe(true);expect(input.disabled).toBe(false);await toggle();expect(change).toHaveBeenCalledExactlyOnceWith({dotPlotIntervals:undefined});
});
it('retains empty-series accessible entries and refuses a stale interval declaration in another visualization',async()=>{
 const{tile}=await comparisonIntervalFixture(independentGroups);tile.appearance.dotPlotLayout='small_multiples';await act(async()=>root.render(<DotPlotView tile={tile} format={format}/>));
 const values=Array.from(host.querySelectorAll('[aria-label="Exact rate interval values"] li')).filter(node=>node.textContent?.includes('No valid answers'));expect(values,host.textContent??'').toHaveLength(2);for(const row of values)expect(row.textContent).toContain('CI unavailable: no valid respondents');
 tile.visualization='vertical_bar';await act(async()=>root.render(<ChartView tile={tile}/>));expect(host.querySelector('svg')).toBeNull();expect(host.querySelector('[role="status"]')!.textContent).toContain('cannot represent');expect(tile.appearance.dotPlotIntervals).toBeDefined();
});
