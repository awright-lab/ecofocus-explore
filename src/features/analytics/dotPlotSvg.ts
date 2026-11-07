import type { DashboardTile } from "../../../shared/types/dashboard";
import { ownAxisLabel } from "../design-system/axisLabels";
import { chartColor } from "../design-system/reportColors";
import { buildDotPlotModel } from "./dotPlotModel";

type Area = { x: number; y: number; width: number; height: number };
export class DotPlotFitError extends Error {
  constructor(readonly requiredHeight: number) {
    super('All dot-plot series and labels cannot fit readably. Enlarge the chart, reduce type sizes or use the complete table/Excel; no points were truncated.');
  }
}
const xml = (value: unknown) => {
  const raw=String(value);
  for(const character of raw){const code=character.codePointAt(0)!;if((code<32&&![9,10,13].includes(code))||(code>=0xd800&&code<=0xdfff)||code===0xfffe||code===0xffff)throw Error('A dot-plot label contains unsupported XML characters. Review its display alias; the source was retained.');}
  return raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
};
function solid(value: string) {
  if (value.length<=256&&(/^#(?:[a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value) || /^[a-z]+$/i.test(value) || /^rgba?\([\d.,%\s]+\)$/i.test(value))) return value;
  throw Error("Dot plots require solid colors. Review the chart palette before rendering or exporting.");
}
function text(value: string, x: number, y: number, size: number, color: string, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" text-anchor="${anchor}" fill="${xml(solid(color))}">${xml(value)}</text>`;
}
function wrap(value: string, characters: number, words = false): string[] {
  const source = Array.from(value), lines: string[] = [];
  if (source.length > characters * 6) throw Error("A full dot-plot label cannot fit. Enlarge the chart or shorten its display alias; no label was truncated.");
  for(let i=0;i<source.length;){
    let length=Math.min(characters,source.length-i);
    if(words&&i+length<source.length)for(let n=length-1;n>0;n--)if(/\s/u.test(source[i+n])){length=n+1;break;}
    lines.push(source.slice(i,i+length).join(''));i+=length;
  }
  if(lines.length>6)throw Error("A full dot-plot label cannot fit. Enlarge the chart or shorten its display alias; no label was truncated.");
  return lines.length ? lines : [""];
}
function marker(index: number, x: number, y: number, fill: string, paired = false) {
  const color=xml(solid(fill));
  switch(index % 6) {
    case 1:return paired ? `<rect x="${x-6}" y="${y-6}" width="12" height="12" fill="none" stroke="${color}" stroke-width="2"/>` : `<rect x="${x-4}" y="${y-4}" width="8" height="8" fill="${color}"/>`;
    case 2:return `<polygon points="${x},${y-5} ${x+5},${y} ${x},${y+5} ${x-5},${y}" fill="${color}"/>`;
    case 3:return `<polygon points="${x},${y-5} ${x+5},${y+4} ${x-5},${y+4}" fill="${color}"/>`;
    case 4:return `<polygon points="${x-5},${y-4} ${x+5},${y-4} ${x},${y+5}" fill="${color}"/>`;
    case 5:return `<path d="M${x-5} ${y-1.5}h3.5v-3.5h3v3.5h3.5v3h-3.5v3.5h-3v-3.5h-3.5z" fill="${color}"/>`;
    default:return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;
  }
}

/** Shared canvas/export body. All source strings are escaped; nothing is omitted. */
export function dotPlotSvg(tile: DashboardTile, area: Area, format: (value: number | null) => string): string {
  const model=buildDotPlotModel(tile.result);if(model.status!=='ready')throw Error(model.reason);
  const layout=tile.appearance.dotPlotLayout;
  if(layout!==undefined&&layout!=='separate'&&layout!=='paired')throw Error('Choose a supported dot-plot layout. The source and recorded values were retained.');
  const paired=layout==='paired';
  if(paired&&tile.result.columns.length!==2)throw Error('Paired dots require exactly two recorded groups. Choose Separate series or change the comparison; no groups were hidden.');
  const axis=tile.appearance.axisFontSize,valueSize=tile.appearance.labelFontSize;
  if(![area.x,area.y,area.width,area.height,axis,valueSize].every(Number.isFinite)||axis<=0||valueSize<=0||area.width<200||area.height<100||area.width>16384||area.height>16384)throw Error('The dot plot needs a valid area within 16,384 pixels per side and valid type sizes.');
  const rows=tile.result.table,columns=tile.result.columns,axisLine=axis*1.5,pointLine=Math.max(16,valueSize*1.5),multi=columns.length>1;
  const names=rows.map(row=>ownAxisLabel(tile.appearance,row.optionId)??row.label),series=columns.map(column=>ownAxisLabel(tile.appearance,column.id)??column.label);
  if([...names,...series].some(name=>name.length>4096))throw Error('A dot-plot display label is too long. Shorten its display alias; the source was retained.');
  const left=Math.max(70,Math.min(area.width*.28,Math.max(...names.map(n=>Array.from(n).length))*axis*1.1+12));
  const basePrefix=tile.result.weighting.applied?'W':tile.result.query.weight?'base (weight unconfirmed)':'n';
  const printed=model.cells.map(row=>row.map(cell=>`${format(cell.value)}${tile.appearance.showBases?`; ${cell.base===null?'base unavailable':`${basePrefix}=${cell.base}`}`:''}`));
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
    if(paired&&first.fraction!==null&&second.fraction!==null)svg+=`<line data-dot-pair="${xml(row.optionId)}" x1="${coordinate(first.fraction)}" x2="${coordinate(second.fraction)}" y1="${pairY}" y2="${pairY}" stroke="${xml(solid(tile.appearance.labelColor))}" stroke-opacity="0.45" stroke-width="1.5"/>`;
    model.cells[r].forEach((cell,c)=>{
      const cy=top+(height-columns.length*pointLine)/2+(c+.5)*pointLine;
      const detail=`${names[r]} / ${series[c]}: ${printed[r][c]}`;
      svg+=`<g data-dot-row="${xml(row.optionId)}" data-dot-column="${xml(columns[c].id)}" data-dot-value="${cell.value??'unavailable'}" data-dot-base="${cell.base??'unavailable'}"><title>${xml(detail)}</title>`;
      if(cell.fraction!==null)svg+=marker(multi?c:0,coordinate(cell.fraction),paired?pairY:cy,colors[multi?c:r],paired);
      if(tile.appearance.showValueLabels){
        if(paired)svg+=`<g data-dot-label-marker="${xml(columns[c].id)}">${marker(c,plot.x+plot.width+22,cy,colors[c],true)}</g>`;
        svg+=text(printed[r][c],plot.x+plot.width+(paired?36:12),cy+valueSize*.35,valueSize,tile.appearance.labelColor);
      }
      svg+='</g>';
    });top+=height;
  });
  return `<g${paired?' data-dot-layout="paired"':''} data-dot-min="${model.minimum}" data-dot-max="${model.maximum}" data-dot-x="${plot.x}" data-dot-width="${plot.width}">${svg}</g>`;
}

/** Canvas/thumbnail may scroll a taller complete drawing; fixed-page exports cannot. */
export function dotPlotDrawing(tile: DashboardTile, width: number, minimumHeight: number, format: (value: number | null) => string) {
  let height=minimumHeight,svg='';
  try{svg=dotPlotSvg(tile,{x:12,y:8,width:width-24,height:height-20},format);}
  catch(error){if(!(error instanceof DotPlotFitError))throw error;height=Math.ceil(error.requiredHeight)+21;svg=dotPlotSvg(tile,{x:12,y:8,width:width-24,height:height-20},format);}
  return {svg,width,height};
}
