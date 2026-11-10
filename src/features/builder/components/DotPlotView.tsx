import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import type {DashboardTile} from '../../../../shared/types/dashboard';
import {dotPlotDrawing} from '../../analytics/dotPlotSvg';
import {dotIntervalExplanation,dotIntervals,dotIntervalLabel} from '../../analytics/dotPlotIntervals';
import {intervalPercentLabel} from '../../significance-review/proportionIntervalModel';
import {ownAxisLabel} from '../../design-system/axisLabels';
import {dotPlotExplanation,pairedDotPlotExplanation,smallMultiplesExplanation,slopePlotExplanation} from '../../analytics/dotPlotModel';
import {CompleteTableDialog} from './CompleteTableDialog';
import './dot-plot.css';

function IntervalValues({tile,containerRef}:{tile:DashboardTile;containerRef:(node:HTMLDetailsElement|null)=>void}){
 let cells:ReturnType<typeof dotIntervals>;try{cells=dotIntervals(tile);}catch{return null;}
 if(!cells)return null;
 return <details ref={containerRef} aria-label="Exact rate interval values" style={{maxHeight:180,overflow:"auto",flex:"none"}}><summary>Read interval values and respondent counts</summary><ul>{cells.flatMap((row,r)=>row.map((cell,c)=><li key={JSON.stringify([tile.result.table[r].optionId,tile.result.columns[c].id])}>
  <strong>{ownAxisLabel(tile.appearance,tile.result.table[r].optionId)??tile.result.table[r].label}</strong> / {ownAxisLabel(tile.appearance,tile.result.columns[c].id)??tile.result.columns[c].label}: {cell.interval?intervalPercentLabel(cell.interval.rate):'Rate unavailable'}; {dotIntervalLabel(cell)}; {cell.events} events / {cell.base} valid respondents.{cell.base>0&&cell.base<30?' Small valid base: interpret cautiously.':''}
 </li>))}</ul></details>;
}

export function DotPlotView({tile,format}:{tile:DashboardTile;format:(value:number|null)=>string}){
 const[complete,setComplete]=useState(false),button=useRef<HTMLButtonElement|null>(null),previous=useRef<HTMLDivElement|null>(null),displaced=useRef(false);
 const region=useCallback((node:HTMLDivElement|null)=>{if(!node&&previous.current?.contains(document.activeElement))displaced.current=true;previous.current=node;},[]);
 useLayoutEffect(()=>{if(displaced.current){displaced.current=false;if(!document.activeElement||document.activeElement===document.body)button.current?.focus();}});
 const intervalPrevious=useRef<HTMLDetailsElement|null>(null);
 const intervalRegion=useCallback((node:HTMLDetailsElement|null)=>{if(!node&&intervalPrevious.current?.contains(document.activeElement))displaced.current=true;intervalPrevious.current=node;},[]);
 const displayName=tile.appearance.dotPlotLayout==='slope'?'Slope chart':tile.appearance.dotPlotLayout==='small_multiples'?'Small multiples':'Dot plot';
 const width=Math.max(640,tile.layout.width-32);let height=Math.max(220,tile.layout.height-110),svg='',issue='';
 try{const drawing=dotPlotDrawing(tile,width,height,format);svg=drawing.svg;height=drawing.height;}catch(error){issue=error instanceof Error?error.message:'This dot plot is unavailable. Use the complete table.';}
 return <div className="dot-plot-view" data-canvas-keyboard-scope="controls"><p>{tile.appearance.dotPlotIntervals!==undefined?dotIntervalExplanation:tile.appearance.dotPlotLayout==='paired'?pairedDotPlotExplanation:tile.appearance.dotPlotLayout==='small_multiples'?smallMultiplesExplanation:tile.appearance.dotPlotLayout==='slope'?slopePlotExplanation:dotPlotExplanation} Points use solid palette colors.</p>
  {issue?<p role="status">{issue}</p>:<div ref={region} className="dot-plot-scroll" style={{background:tile.appearance.chartBackground}} role="region" tabIndex={0} aria-label={`${displayName} with recorded values`}><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Recorded ${tile.result.metric.label}; ${tile.result.table.length} rows and ${tile.result.columns.length} series${tile.appearance.dotPlotIntervals!==undefined?'; individual 95% Wilson intervals, not difference intervals or a significance test':''}`} dangerouslySetInnerHTML={{__html:svg}}/></div>}
  {!issue && tile.appearance.dotPlotIntervals!==undefined && <IntervalValues tile={tile} containerRef={intervalRegion}/>}
  <button ref={button} type="button" onClick={()=>setComplete(true)}>Explore complete dot-plot values</button>{complete&&<CompleteTableDialog tile={tile} onClose={()=>setComplete(false)}/>}</div>;
}
