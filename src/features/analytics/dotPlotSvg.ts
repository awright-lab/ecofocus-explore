import type { DashboardTile } from "../../../shared/types/dashboard";
import { ownAxisLabel } from "../design-system/axisLabels";
import { chartColor } from "../design-system/reportColors";
import { buildDotPlotModel } from "./dotPlotModel";
import { dotIntervals, dotIntervalLabel, dotIntervalSvg, dotIntervalExplanation } from "./dotPlotIntervals";

import {DotPlotFitError, xml, solid, text, wrap, marker, type Area} from "./plotSvgPrimitives";
import {comparisonPlotSvg} from "./comparisonPlotSvg";
export {DotPlotFitError} from "./plotSvgPrimitives";

/** Shared canvas/export body. All source strings are escaped; nothing is omitted. */
export function dotPlotSvg(tile: DashboardTile, area: Area, format: (value: number | null) => string): string {
  const model=buildDotPlotModel(tile.result);if(model.status!=='ready')throw Error(model.reason);
  const intervals = dotIntervals(tile);
  const layout=tile.appearance.dotPlotLayout;
  if(layout!==undefined&&layout!=='separate'&&layout!=='paired'&&layout!=='small_multiples'&&layout!=='slope')throw Error('Choose a supported dot-plot layout. The source and recorded values were retained.');
  if(layout==='small_multiples'||layout==='slope')return comparisonPlotSvg(tile,area,format);
  const paired=layout==='paired';
  if(paired&&tile.result.columns.length!==2)throw Error('Paired dots require exactly two recorded groups. Choose Separate series or change the comparison; no groups were hidden.');
  const axis=tile.appearance.axisFontSize,valueSize=tile.appearance.labelFontSize;
  if(![area.x,area.y,area.width,area.height,axis,valueSize].every(Number.isFinite)||axis<=0||valueSize<=0||area.width<200||area.height<100||area.width>16384||area.height>16384)throw Error('The dot plot needs a valid area within 16,384 pixels per side and valid type sizes.');
  const rows=tile.result.table,columns=tile.result.columns,axisLine=axis*1.5,pointLine=Math.max(16,valueSize*1.5),multi=columns.length>1;
  const names=rows.map(row=>ownAxisLabel(tile.appearance,row.optionId)??row.label),series=columns.map(column=>ownAxisLabel(tile.appearance,column.id)??column.label);
  if([...names,...series].some(name=>name.length>4096))throw Error('A dot-plot display label is too long. Shorten its display alias; the source was retained.');
  const left=Math.max(70,Math.min(area.width*.28,Math.max(...names.map(n=>Array.from(n).length))*axis*1.1+12));
  const basePrefix=tile.result.weighting.applied?'W':tile.result.query.weight?'base (weight unconfirmed)':'n';
  const printed=model.cells.map((row,r)=>row.map((cell,c)=>`${format(cell.value)}${tile.appearance.showBases?`; ${cell.base===null?'base unavailable':`${basePrefix}=${cell.base}`}`:''}${intervals?`; ${tile.appearance.showBases?'':`n=${intervals[r][c].base}; `}${dotIntervalLabel(intervals[r][c])}`:''}`));
  const right=tile.appearance.showValueLabels?Math.max(70,...printed.flat().map(v=>Array.from(v).length*valueSize*1.1+12))+(paired?26:0):8;
  const plot={x:area.x+left,y:area.y,width:area.width-left-right-16};
  if(plot.width<100)throw Error('Dot-plot labels and values cannot fit at the selected type sizes. Enlarge the chart, shorten display aliases or hide value labels; nothing was omitted.');
  const wrapped=names.map(n=>wrap(n,Math.max(1,Math.floor((left-12)/(axis*1.1))),paired));
  const legendLines=multi?series.map(n=>wrap(n,Math.max(1,Math.floor((area.width-24)/(axis*1.1))),paired)):[];
  const legendHeight=legendLines.reduce((total,lines)=>total+lines.length*axisLine+4,0);
  const minimumRows=wrapped.map(lines=>Math.max(lines.length*axisLine+8,columns.length*pointLine+8));
  const needed=legendHeight+axisLine*2+12+minimumRows.reduce((sum,height)=>sum+height,0);
  if(needed>area.height)throw new DotPlotFitError(needed);
  const rowHeights=minimumRows.map(height=>height+(area.height-needed)/rows.length);
  const colors=multi?columns.map((column,index)=>chartColor(tile,'columns',column.id,index)):rows.map((row,index)=>chartColor(tile,'rows',row.optionId,index));
  let svg='',top=area.y;
  legendLines.forEach((lines,c)=>{svg+=marker(c,area.x+(paired?8:6),top+axis*.65,colors[c],paired);lines.forEach((line,n)=>svg+=text(line,area.x+(paired?20:18),top+axis+n*axisLine,axis,tile.appearance.labelColor));top+=lines.length*axisLine+4;});
  top+=axisLine+4;
  const end=top+rowHeights.reduce((sum,height)=>sum+height,0),coordinate=(fraction:number)=>plot.x+fraction*plot.width;
  const scale=Math.max(Math.abs(model.minimum),Math.abs(model.maximum))||1,zero=(0/scale-model.minimum/scale)/(model.maximum/scale-model.minimum/scale);
  svg+=`<line x1="${coordinate(zero)}" x2="${coordinate(zero)}" y1="${top-4}" y2="${end}" stroke="${xml(solid(tile.appearance.gridColor))}"/>`;
  svg+=`<line x1="${plot.x}" x2="${plot.x+plot.width}" y1="${end+3}" y2="${end+3}" stroke="${xml(solid(tile.appearance.gridColor))}"/>`;
  const low=format(model.minimum),high=format(model.maximum);
  if((Array.from(low).length+Array.from(high).length)*axis*1.1+12>plot.width)throw Error('The complete dot-plot axis labels cannot fit. Enlarge the chart or reduce the axis type size.');
  svg+=text(low,plot.x,end+axisLine,axis,tile.appearance.xAxisTextColor)+text(high,plot.x+plot.width,end+axisLine,axis,tile.appearance.xAxisTextColor,'end');
  rows.forEach((row,r)=>{
    const height=rowHeights[r];wrapped[r].forEach((line,n)=>svg+=text(line,area.x,top+(height-wrapped[r].length*axisLine)/2+axis+n*axisLine,axis,tile.appearance.yAxisTextColor));
    const pairY=top+height/2,first=model.cells[r][0],second=model.cells[r][1];
    const laneY=(c:number)=>top+(height-columns.length*pointLine)/2+(c+.5)*pointLine;
    if(paired&&first.fraction!==null&&second.fraction!==null)svg+=`<line data-dot-pair="${xml(row.optionId)}" x1="${coordinate(first.fraction)}" x2="${coordinate(second.fraction)}" y1="${intervals?laneY(0):pairY}" y2="${intervals?laneY(1):pairY}" stroke="${xml(solid(tile.appearance.labelColor))}" stroke-opacity="0.45" stroke-width="1.5"/>`;
    model.cells[r].forEach((cell,c)=>{
      const cy=top+(height-columns.length*pointLine)/2+(c+.5)*pointLine;
      const intervalCell = intervals?.[r][c];
      const detail=`${names[r]} / ${series[c]}: ${printed[r][c]}${intervalCell?`; ${intervalCell.events} events / ${intervalCell.base} valid respondents${intervalCell.base>0&&intervalCell.base<30?'; Small valid base: interpret cautiously':''}`:''}`;
      svg+=`<g data-dot-row="${xml(row.optionId)}" data-dot-column="${xml(columns[c].id)}" data-dot-value="${cell.value??'unavailable'}" data-dot-base="${cell.base??'unavailable'}"><title>${xml(detail)}</title>`;
      if(intervalCell)svg+=dotIntervalSvg(intervalCell,cy,coordinate,xml(solid(colors[multi?c:r])));
      if(cell.fraction!==null)svg+=marker(multi?c:0,coordinate(cell.fraction),paired&&!intervals?pairY:cy,colors[multi?c:r],paired);
      if(tile.appearance.showValueLabels){
        if(paired)svg+=`<g data-dot-label-marker="${xml(columns[c].id)}">${marker(c,plot.x+plot.width+22,cy,colors[c],true)}</g>`;
        svg+=text(printed[r][c],plot.x+plot.width+(paired?36:12),cy+valueSize*.35,valueSize,tile.appearance.labelColor);
      }
      svg+='</g>';
    });top+=height;
  });
  return `<g${paired?' data-dot-layout="paired"':''} data-dot-min="${model.minimum}" data-dot-max="${model.maximum}" data-dot-x="${plot.x}" data-dot-width="${plot.width}">${intervals?`<desc>${xml(dotIntervalExplanation)}</desc>`:''}${svg}</g>`;
}

/** Canvas/thumbnail may scroll a taller complete drawing; fixed-page exports cannot. */
export function dotPlotDrawing(tile: DashboardTile, width: number, minimumHeight: number, format: (value: number | null) => string) {
  let height=minimumHeight,svg='';
  try{svg=dotPlotSvg(tile,{x:12,y:8,width:width-24,height:height-20},format);}
  catch(error){if(!(error instanceof DotPlotFitError))throw error;height=Math.ceil(error.requiredHeight)+21;svg=dotPlotSvg(tile,{x:12,y:8,width:width-24,height:height-20},format);}
  return {svg,width,height};
}
