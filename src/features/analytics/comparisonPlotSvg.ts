import { dotIntervals, dotIntervalLabel, dotIntervalSvg, dotIntervalExplanation } from "./dotPlotIntervals";
import type {DashboardTile} from "../../../shared/types/dashboard";
import {ownAxisLabel} from "../design-system/axisLabels";
import {chartColor} from "../design-system/reportColors";
import {buildDotPlotModel} from "./dotPlotModel";
import {DotPlotFitError, xml, solid, text, marker, type Area} from "./plotSvgPrimitives";

// Break at word boundaries without putting a leading space in the next word's budget.
// Trailing whitespace has no ink; retaining it also preserves the full authored string.
function wrap(value:string,characters:number,_words=true):string[]{
 const source=Array.from(value),lines:string[]=[];
 if(source.length>characters*6)throw Error("A full comparison label cannot fit. Enlarge the chart or shorten its display alias; no label was truncated.");
 for(let start=0;start<source.length;){
  let end=Math.min(source.length,start+characters);
  if(end<source.length){
   if(/\s/u.test(source[end])){while(end<source.length&&/\s/u.test(source[end]))end++;}
   else for(let i=end-1;i>start;i--)if(/\s/u.test(source[i])){end=i+1;break;}
  }
  lines.push(source.slice(start,end).join(''));start=end;
 }
 if(lines.length>6)throw Error("A full comparison label cannot fit. Enlarge the chart or shorten its display alias; no label was truncated.");
 return lines.length?lines:[""];
}

/** Presentation only: preserve every validated recorded cell and use one common scale. */
export function comparisonPlotSvg(tile:DashboardTile, area:Area, format:(value:number|null)=>string):string {
 const model=buildDotPlotModel(tile.result);if(model.status!=="ready")throw Error(model.reason);
 const slope=tile.appearance.dotPlotLayout==="slope";
 if(!slope&&tile.appearance.dotPlotLayout!=="small_multiples")throw Error("Choose a supported comparison layout.");
 const intervals=dotIntervals(tile);
 const a=tile.appearance,axis=a.axisFontSize,valueSize=a.labelFontSize;
 if(![area.x,area.y,area.width,area.height,axis,valueSize].every(Number.isFinite)||axis<=0||valueSize<=0||area.width<200||area.height<100||area.width>16384||area.height>16384)throw Error("The comparison chart needs a valid area within 16,384 pixels per side and valid type sizes.");
 const rows=tile.result.table,cols=tile.result.columns;
 if(slope&&cols.length!==2)throw Error("Slope charts require exactly two recorded groups. Choose another layout; no groups were hidden.");
 const names=rows.map(r=>ownAxisLabel(a,r.optionId)??r.label),series=cols.map(c=>ownAxisLabel(a,c.id)??c.label);
 if([...names,...series].some(n=>n.length>4096))throw Error("A comparison display label is too long. Shorten its display alias; the source was retained.");
 const prefix=tile.result.weighting.applied?"W":tile.result.query.weight?"base (weight unconfirmed)":"n";
 const printed=model.cells.map((row,r)=>row.map((cell,c)=>`${format(cell.value)}${a.showBases?`; ${cell.base===null?'base unavailable':`${prefix}=${cell.base}`}`:''}${intervals?`; ${a.showBases?'':`n=${intervals[r][c].base}; `}${dotIntervalLabel(intervals[r][c])}`:''}`));
 const char=(s:string)=>Array.from(s).length,axisLine=axis*1.5,valueLine=valueSize*1.5;
 const low=format(model.minimum),high=format(model.maximum),grid=xml(solid(a.gridColor));
 const cellGroup=(r:number,c:number,body:string)=>`<g data-dot-row="${xml(rows[r].optionId)}" data-dot-column="${xml(cols[c].id)}" data-dot-value="${model.cells[r][c].value??'unavailable'}" data-dot-base="${model.cells[r][c].base??'unavailable'}"><title>${xml(`${names[r]} / ${series[c]}: ${printed[r][c]}${intervals?`; ${intervals[r][c].events} events / ${intervals[r][c].base} valid respondents${intervals[r][c].base>0&&intervals[r][c].base<30?'; Small valid base: interpret cautiously':''}`:''}`)}</title>${body}</g>`;
 let svg="";
 if(!slope){
  const longestWord=Math.max(...names.flatMap(n=>n.split(/\s+/u).map(char)));
  const gap=24,labels=Math.max(70,Math.min(200,Math.max(...names.map(char))*axis*1.1+12),Math.min(300,(longestWord+0.01)*axis*1.1+12));
  const values=a.showValueLabels?Math.max(70,...printed.flat().map(n=>char(n)*valueSize*1.1+12)):8;
  const minimumPlotWidth=Math.max(100,(char(low)+char(high))*axis*1.1+12);
  const minimumWidth=labels+values+16+minimumPlotWidth;
  const panelsAcross=Math.min(cols.length,3,Math.floor((area.width+gap)/(minimumWidth+gap)));
  if(panelsAcross<1)throw Error("Small-multiple labels and values cannot fit. Enlarge the chart or reduce type sizes; nothing was omitted.");
  const panelWidth=(area.width-gap*(panelsAcross-1))/panelsAcross,plotWidth=panelWidth-labels-values-16;
  if((char(low)+char(high))*axis*1.1+12>plotWidth)throw Error("The complete small-multiple axis labels cannot fit. Enlarge the chart or reduce axis type size.");
  const wrapped=names.map(n=>wrap(n,Math.max(1,Math.floor((labels-12)/(axis*1.1))),true));
  const headers=series.map(n=>wrap(n,Math.max(1,Math.floor((panelWidth-16)/(axis*1.1))),true));
  const headerHeight=Math.max(...headers.map(n=>n.length))*axisLine+8;
  const rowHeights=wrapped.map(n=>Math.max(n.length*axisLine,valueLine)+12);
  const panelHeight=headerHeight+rowHeights.reduce((s,h)=>s+h,0)+axisLine*2+8,panelRows=Math.ceil(cols.length/panelsAcross);
  const needed=panelRows*panelHeight+(panelRows-1)*gap;
  if(needed>area.height)throw new DotPlotFitError(needed);
  const scale=Math.max(Math.abs(model.minimum),Math.abs(model.maximum))||1,zero=(0/scale-model.minimum/scale)/(model.maximum/scale-model.minimum/scale);
  cols.forEach((column,c)=>{
   const x=area.x+(c%panelsAcross)*(panelWidth+gap),y=area.y+Math.floor(c/panelsAcross)*(panelHeight+gap),plotX=x+labels,color=chartColor(tile,'columns',column.id,c),end=y+headerHeight+rowHeights.reduce((s,h)=>s+h,0);
   svg+=`<g data-small-panel="${xml(column.id)}" data-panel-x="${x}" data-panel-y="${y}" data-panel-width="${panelWidth}" data-panel-height="${panelHeight}" data-dot-x="${plotX}" data-dot-width="${plotWidth}">`;
   headers[c].forEach((line,i)=>svg+=text(line,x,y+axis+i*axisLine,axis,a.labelColor));
   svg+=`<line x1="${plotX+zero*plotWidth}" x2="${plotX+zero*plotWidth}" y1="${y+headerHeight}" y2="${end}" stroke="${grid}"/><line x1="${plotX}" x2="${plotX+plotWidth}" y1="${end+3}" y2="${end+3}" stroke="${grid}"/>`;
   let top=y+headerHeight;
   rows.forEach((_,r)=>{
    const height=rowHeights[r],cy=top+height/2,cell=model.cells[r][c];
    wrapped[r].forEach((line,i)=>svg+=text(line,x,top+(height-wrapped[r].length*axisLine)/2+axis+i*axisLine,axis,a.yAxisTextColor));
    let body=intervals?dotIntervalSvg(intervals[r][c],cy,fraction=>plotX+fraction*plotWidth,xml(solid(color))):'';
    if(cell.fraction!==null)body+=marker(c,plotX+cell.fraction*plotWidth,cy,color);
    if(a.showValueLabels)body+=text(printed[r][c],plotX+plotWidth+12,cy+valueSize*.35,valueSize,a.labelColor);
    svg+=cellGroup(r,c,body);top+=height;
   });
   svg+=text(low,plotX,end+axisLine,axis,a.xAxisTextColor)+text(high,plotX+plotWidth,end+axisLine,axis,a.xAxisTextColor,'end')+'</g>';
  });
 }else{
  // Labels are packed separately on each side. Leaders retain true quantitative endpoints.
  const labelWidth=Math.min(area.width*.32,Math.max(130,Math.max(...names.map(char))*axis*1.1+12));
  const axisWidth=Math.max(char(low),char(high))*axis*1.1+12;
  const left=area.x+labelWidth+axisWidth+20,right=area.x+area.width-labelWidth-20;
  if(right-left<100)throw Error("Slope labels and axis cannot fit. Enlarge the chart or reduce type sizes; nothing was omitted.");
  const nameLines=names.map(n=>wrap(n,Math.max(1,Math.floor((labelWidth-8)/(axis*1.1))),true));
  const valueLines=printed.map(row=>row.map(n=>a.showValueLabels?wrap(n,Math.max(1,Math.floor((labelWidth-8)/(valueSize*1.1))),true):[]));
  const headers=series.map(n=>wrap(n,Math.max(1,Math.floor((Math.min(labelWidth*2,right-left)-16)/(axis*1.1))),true));
  const headerHeight=Math.max(...headers.map(n=>n.length))*axisLine+16;
  const heights=rows.map((_,r)=>Math.max(...[0,1].map(c=>nameLines[r].length*axisLine+valueLines[r][c].length*valueLine))+12);
  const packedHeight=heights.reduce((s,h)=>s+h,0)+Math.max(0,rows.length-1)*8;
  const needed=headerHeight+Math.max(100,packedHeight)+axisLine*2+16;
  if(needed>area.height)throw new DotPlotFitError(needed);
  const top=area.y+headerHeight,bottom=area.y+area.height-axisLine*2-16,plotHeight=bottom-top;
  const y=(fraction:number)=>bottom-fraction*plotHeight;
  svg+=`<g data-slope-top="${top}" data-slope-bottom="${bottom}" data-slope-left="${left}" data-slope-right="${right}">`;
  headers.forEach((lines,c)=>lines.forEach((line,i)=>svg+=text(line,c?right:left,area.y+axis+i*axisLine,axis,a.labelColor,'middle')));
  svg+=`<line x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" stroke="${grid}"/><line x1="${right}" x2="${right}" y1="${top}" y2="${bottom}" stroke="${grid}"/>`;
  svg+=text(high,left-12,top+axis*.35,axis,a.yAxisTextColor,'end')+text(low,left-12,bottom+axis*.35,axis,a.yAxisTextColor,'end');
  const centers=[0,1].map(c=>{
   const order=rows.map((_,r)=>r).sort((a,b)=>(model.cells[a][c].fraction===null?bottom:y(model.cells[a][c].fraction!))-(model.cells[b][c].fraction===null?bottom:y(model.cells[b][c].fraction!))||a-b);
   const tops=new Map<number,number>();let edge=top;
   order.forEach(r=>{const desired=(model.cells[r][c].fraction===null?bottom:y(model.cells[r][c].fraction!))-heights[r]/2;const start=Math.max(edge,desired);tops.set(r,start);edge=start+heights[r]+8;});
   edge=bottom;
   [...order].reverse().forEach(r=>{const start=Math.min(tops.get(r)!,edge-heights[r]);tops.set(r,start);edge=start-8;});
   return tops;
  });
  rows.forEach((row,r)=>{
   const color=chartColor(tile,'rows',row.optionId,r),stroke=xml(solid(color)),first=model.cells[r][0],second=model.cells[r][1];
   if(first.fraction!==null&&second.fraction!==null)svg+=`<line data-slope-line="${xml(row.optionId)}" x1="${left}" x2="${right}" y1="${y(first.fraction)}" y2="${y(second.fraction)}" stroke="${stroke}" stroke-width="2" stroke-opacity="0.7"/>`;
   [0,1].forEach(c=>{
    const cell=model.cells[r][c],cx=c?right:left,start=centers[c].get(r)!,labelX=c?right+20:area.x+labelWidth,anchor=c?'start':'end',labelCenter=start+heights[r]/2;
    let body=`<g data-slope-label="${xml(row.optionId)}" data-label-top="${start}" data-label-height="${heights[r]}">`;
    nameLines[r].forEach((line,i)=>body+=text(line,labelX,start+axis+i*axisLine,axis,a.yAxisTextColor,anchor));
    valueLines[r][c].forEach((line,i)=>body+=text(line,labelX,start+nameLines[r].length*axisLine+valueSize+i*valueLine,valueSize,a.labelColor,anchor));body+='</g>';
    if(cell.fraction!==null){body+=`<line data-slope-leader="${xml(row.optionId)}" x1="${cx}" x2="${c?labelX-6:labelX+6}" y1="${y(cell.fraction)}" y2="${labelCenter}" stroke="${stroke}" stroke-opacity="0.45"/>`+marker(r,cx,y(cell.fraction),color);}
    svg+=cellGroup(r,c,body);
   });
  });svg+='</g>';
 }
 return `<g data-dot-layout="${slope?'slope':'small_multiples'}" data-dot-min="${model.minimum}" data-dot-max="${model.maximum}">${intervals?`<desc>${xml(dotIntervalExplanation)}</desc>`:''}${svg}</g>`;
}
