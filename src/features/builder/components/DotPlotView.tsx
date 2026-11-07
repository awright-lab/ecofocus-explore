import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import type {DashboardTile} from '../../../../shared/types/dashboard';
import {dotPlotDrawing} from '../../analytics/dotPlotSvg';
import {dotPlotExplanation,pairedDotPlotExplanation} from '../../analytics/dotPlotModel';
import {CompleteTableDialog} from './CompleteTableDialog';
import './dot-plot.css';

export function DotPlotView({tile,format}:{tile:DashboardTile;format:(value:number|null)=>string}){
 const[complete,setComplete]=useState(false),button=useRef<HTMLButtonElement|null>(null),previous=useRef<HTMLDivElement|null>(null),displaced=useRef(false);
 const region=useCallback((node:HTMLDivElement|null)=>{if(!node&&previous.current?.contains(document.activeElement))displaced.current=true;previous.current=node;},[]);
 useLayoutEffect(()=>{if(displaced.current){displaced.current=false;if(!document.activeElement||document.activeElement===document.body)button.current?.focus();}});
 const width=Math.max(640,tile.layout.width-32);let height=Math.max(220,tile.layout.height-110),svg='',issue='';
 try{const drawing=dotPlotDrawing(tile,width,height,format);svg=drawing.svg;height=drawing.height;}catch(error){issue=error instanceof Error?error.message:'This dot plot is unavailable. Use the complete table.';}
 return <div className="dot-plot-view" data-canvas-keyboard-scope="controls"><p>{tile.appearance.dotPlotLayout==='paired'?pairedDotPlotExplanation:dotPlotExplanation} Points use solid palette colors.</p>
  {issue?<p role="status">{issue}</p>:<div ref={region} className="dot-plot-scroll" style={{background:tile.appearance.chartBackground}} role="region" tabIndex={0} aria-label="Dot plot with recorded values"><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Recorded ${tile.result.metric.label}; ${tile.result.table.length} rows and ${tile.result.columns.length} series`} dangerouslySetInnerHTML={{__html:svg}}/></div>}
  <button ref={button} type="button" onClick={()=>setComplete(true)}>Explore complete dot-plot values</button>{complete&&<CompleteTableDialog tile={tile} onClose={()=>setComplete(false)}/>}</div>;
}
