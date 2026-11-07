import { useId } from "react";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import { getCompatibleChartTypes, getChartTypeLabel } from "../analytics/analyticsDisplay";
import { formatImportedMeasureValue } from "../data/importedDatasetAnalytics";
import type { DashboardPage, DashboardTile } from "../../../shared/types/dashboard";

type Area = { x: number; y: number; width: number; height: number };
const tableColumnLimit = (area: Area) => Math.max(0, Math.min(3, Math.floor(area.width * 0.6 / 70)));
const donutLegendLimit = (area: Area) => Math.max(1, Math.floor(area.height / 18));
const short = (value: string, maximum = 22) => value.length > maximum ? `${value.slice(0, Math.max(1,maximum-1))}…` : value;
const ink = (background: string) => /^#[0-9a-f]{6}$/i.test(background) && parseInt(background.slice(1,3),16)*0.299 + parseInt(background.slice(3,5),16)*0.587 + parseInt(background.slice(5,7),16)*0.114 < 130 ? "#edf6f1" : "#263e34";
function color(tile: DashboardTile, id: string, index: number) {
  return tile.appearance.barStyles[id]?.color || tile.appearance.palette[index % Math.max(1,tile.appearance.palette.length)] || tile.appearance.primaryColor;
}
function valueLabel(tile: DashboardTile, amount: number | null) {
  return amount === null ? "Unavailable" : tile.result.metric.valueFormat === "percent" ? `${amount}%` : formatImportedMeasureValue(amount,tile.result.metric.id);
}

function TablePreview({ tile, area }: { tile: DashboardTile; area: Area }) {
  const instance=useId().replace(/[^a-zA-Z0-9_-]/g,"_");
  const columns=tile.result.columns.slice(0,tableColumnLimit(area)), rows=tile.result.table.slice(0,Math.max(1,Math.min(5,Math.floor((area.height-24)/24))));
  if(!columns.length || !rows.length) return <text x={area.x} y={area.y+18} fontSize="12">No result data</text>;
  const labelWidth=area.width*0.4, cell=(area.width-labelWidth)/columns.length, rowHeight=Math.min(28,(area.height-24)/rows.length);
  return <g fill="#263e34" fontSize="12">
    <rect x={area.x} y={area.y} width={area.width} height={22} fill="#edf2ee"/>
    <text x={area.x+6} y={area.y+15}>Answer</text>
    {columns.map((column,index)=><text key={column.id} x={area.x+labelWidth+index*cell+6} y={area.y+15}>{short(tile.appearance.axisLabelOverrides[column.id]||column.label,Math.max(4,Math.floor(cell/7)))}</text>)}
    {rows.map((row,index)=>{const top=area.y+22+index*rowHeight;return <g key={row.optionId} data-preview-row={row.optionId}>
      <rect x={area.x} y={top} width={area.width} height={rowHeight} fill={index%2?"#fff":"#f6f9f7"} stroke="#e1e9e3"/>
      <text x={area.x+6} y={top+rowHeight*0.68}>{short(tile.appearance.axisLabelOverrides[row.optionId]||row.label,Math.max(4,Math.floor(labelWidth/7)))}</text>
      {columns.map((column,n)=>{const label=valueLabel(tile,analyticalCell(tile.result,row,column.id).value), clipId=`${instance}-cell-${index}-${n}`;return <g key={column.id}>
        <defs><clipPath id={clipId}><rect x={area.x+labelWidth+n*cell+4} y={top} width={Math.max(0,cell-8)} height={rowHeight}/></clipPath></defs>
        <text clipPath={`url(#${clipId})`} x={area.x+labelWidth+n*cell+6} y={top+rowHeight*0.68}><title>{label}</title>{short(label,Math.max(4,Math.floor((cell-12)/7)))}</text>
      </g>;})}
    </g>;})}
  </g>;
}

function ChartPreview({ tile, area }: { tile: DashboardTile; area: Area }) {
  const rows=tile.result.table.slice(0,6), columns=tile.result.columns.slice(0,3);
  if(!getCompatibleChartTypes(tile.result).includes(tile.visualization)) return <text x={area.x} y={area.y+18} fontSize="12">Chart preview unavailable</text>;
  const values=rows.map(row=>columns.map(column=>analyticalCell(tile.result,row,column.id).value));
  if(!values.some(row=>row.some(value=>value!==null))) return <text x={area.x} y={area.y+18} fontSize="12">Unavailable</text>;
  if(tile.visualization==="donut") {
    if(tile.result.table.length>12) return <text x={area.x} y={area.y+18} fontSize="14">Donut · {tile.result.table.length} answers</text>;
    const all=tile.result.table, column=tile.result.columns[0], total=all.reduce((sum,row)=>sum+row.values[column.id],0);
    if(!Number.isFinite(total)||total<=0) return <text x={area.x} y={area.y+18} fontSize="12">Donut preview unavailable</text>;
    const radius=Math.max(1,Math.min(area.width*0.24,area.height*0.36)), circumference=2*Math.PI*radius;
    let offset=0;
    return <g>{all.map((row,index)=>{const length=circumference*row.values[column.id]/total,start=offset;offset+=length;return <circle key={row.optionId} cx={area.x+area.width*0.36} cy={area.y+area.height/2} r={radius} fill="none" stroke={color(tile,row.optionId,index)} strokeWidth={Math.max(3,radius*0.4)} strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-start} transform={`rotate(-90 ${area.x+area.width*0.36} ${area.y+area.height/2})`}/>;})}
      {all.slice(0,donutLegendLimit(area)).map((row,index)=><text key={row.optionId} x={area.x+area.width*0.68} y={area.y+16+index*18} fontSize="11">{short(row.label,16)}</text>)}
    </g>;
  }
  const stacked=tile.visualization==="stacked_bar", horizontal=tile.visualization==="horizontal_bar";
  const extents=stacked ? values.flatMap(row=>[row.reduce<number>((sum,value)=>sum+Math.max(0,value??0),0),row.reduce<number>((sum,value)=>sum+Math.min(0,value??0),0)]) : values.flat().filter((value):value is number=>value!==null);
  if(!extents.every(Number.isFinite)) return <text x={area.x} y={area.y+18} fontSize="12">Numeric range unavailable</text>;
  const low=Math.min(0,...extents), high=Math.max(0,...extents), scale=Math.max(Math.abs(low),Math.abs(high))||1, span=(high/scale-low/scale)||1;
  const fraction=(value:number)=>(value/scale-low/scale)/span;
  const plot={x:area.x+(horizontal?area.width*0.28:20),y:area.y+20,width:area.width*(horizontal?0.72:1)-(horizontal?8:28),height:area.height-42};
  if(plot.width<20||plot.height<20)return null;
  const y=(value:number)=>plot.y+(1-fraction(value))*plot.height, x=(value:number)=>plot.x+fraction(value)*plot.width;
  const categorySlot=(horizontal?plot.height:plot.width)/Math.max(1,rows.length);
  const legend=columns.length>1?columns.map((column,index)=><text key={column.id} x={area.x+index*area.width/columns.length} y={area.y+10} fontSize="10" fill={color(tile,column.id,index)}>{short(column.label,22)}</text>):null;
  if(tile.visualization==="line_chart") {
    return <g>{legend}<line x1={plot.x} x2={plot.x+plot.width} y1={y(0)} y2={y(0)} stroke="#bacac0"/>
      {columns.map((column,index)=>{
        const runs:Array<Array<{x:number;y:number;label:string;value:number}>>=[];let run:Array<{x:number;y:number;label:string;value:number}>=[];
        rows.forEach((row,n)=>{const value=values[n][index];if(value===null){if(run.length)runs.push(run);run=[];}else run.push({x:plot.x+(n+0.5)*categorySlot,y:y(value),label:row.label,value});});if(run.length)runs.push(run);
        return <g key={column.id} stroke={color(tile,column.id,index)} fill={color(tile,column.id,index)}>{runs.map((points,n)=><g key={n}>{points.length>1&&<polyline points={points.map(point=>`${point.x},${point.y}`).join(" ")} fill="none" strokeWidth="2"/>}{points.map((point,m)=><circle key={m} cx={point.x} cy={point.y} r="2"><title>{`${point.label}: ${valueLabel(tile,point.value)}`}</title></circle>)}</g>)}</g>;
      })}
      {rows.map((row,index)=><text key={row.optionId} x={plot.x+(index+0.5)*categorySlot} y={plot.y+plot.height+14} textAnchor="middle" fontSize="10">{short(row.label,12)}</text>)}
    </g>;
  }
  return <g>{legend}{horizontal?<line x1={x(0)} x2={x(0)} y1={plot.y} y2={plot.y+plot.height} stroke="#bacac0"/>:<line x1={plot.x} x2={plot.x+plot.width} y1={y(0)} y2={y(0)} stroke="#bacac0"/>}
    {rows.map((row,rowIndex)=>{let positive=0,negative=0;return <g key={row.optionId}>
      {columns.map((column,index)=>{const amount=values[rowIndex][index];if(amount===null)return null;
        const start=stacked?(amount>=0?positive:negative):0,end=start+amount;if(stacked){if(amount>=0)positive=end;else negative=end;}
        const slot=categorySlot*0.8/(stacked?1:columns.length),position=(horizontal?plot.y:plot.x)+rowIndex*categorySlot+categorySlot*0.1+(stacked?0:index*slot);
        return <rect key={column.id} x={horizontal?Math.min(x(start),x(end)):position} y={horizontal?position:Math.min(y(start),y(end))} width={horizontal?Math.abs(x(end)-x(start)):Math.max(0,slot-2)} height={horizontal?Math.max(0,slot-2):Math.abs(y(end)-y(start))} fill={color(tile,columns.length===1?row.optionId:column.id,columns.length===1?rowIndex:index)}><title>{`${row.label} · ${column.label}: ${valueLabel(tile,amount)}`}</title></rect>;
      })}
      <text x={horizontal?area.x:plot.x+(rowIndex+0.5)*categorySlot} y={horizontal?plot.y+(rowIndex+0.65)*categorySlot:plot.y+plot.height+14} textAnchor={horizontal?"start":"middle"} fontSize="10">{short(row.label,horizontal?24:12)}</text>
    </g>;})}
  </g>;
}

function TilePreview({ tile, clipId }: {tile:DashboardTile;clipId:string}) {
  const {x,y,width,height}=tile.layout, area={x:x+16,y:y+58,width:Math.max(0,width-32),height:Math.max(0,height-86)};
  const caption=`${getChartTypeLabel(tile.visualization)} · ${tile.result.table.length} row${tile.result.table.length===1?"":"s"} · ${tile.result.columns.length} group${tile.result.columns.length===1?"":"s"}`;
  const columnLimit=tile.visualization==="table"?tableColumnLimit(area):3;
  const canDraw=area.width>60&&area.height>70&&columnLimit>0;
  const rowLimit=tile.visualization==="table"?Math.max(1,Math.min(5,Math.floor((area.height-24)/24))):tile.visualization==="donut"?12:6;
  const compatible=tile.visualization==="table"||getCompatibleChartTypes(tile.result).includes(tile.visualization);
  const footer=!canDraw||!compatible||(tile.visualization==="donut"&&tile.result.table.length>12)?"Open report for full analysis":tile.visualization==="donut"&&tile.result.table.length>donutLegendLimit(area)?`Partial legend · ${donutLegendLimit(area)}/${tile.result.table.length} answers`:tile.result.table.length>rowLimit||tile.result.columns.length>columnLimit?`Partial preview · ${Math.min(tile.result.table.length,rowLimit)}/${tile.result.table.length} rows · ${Math.min(tile.result.columns.length,columnLimit)}/${tile.result.columns.length} groups`:"Preview of stored result";
  return <g data-preview-object={tile.id} data-preview-kind="tile" opacity={tile.appearance.opacity/100}>
    <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height} rx={tile.appearance.borderRadius}/></clipPath></defs>
    <g clipPath={`url(#${clipId})`} fill={ink(tile.appearance.background)}>
      <rect x={x} y={y} width={width} height={height} rx={tile.appearance.borderRadius} fill={tile.appearance.background}/>
      <text x={x+16} y={y+25} fontSize="18" fontWeight="600">{short(tile.title,Math.max(4,Math.floor((width-32)/10)))}</text>
      <text x={x+16} y={y+43} fontSize="11" opacity="0.75">{caption}</text>
      {canDraw&&(tile.visualization==="table"?<TablePreview tile={tile} area={area}/>:<ChartPreview tile={tile} area={area}/>)}
      <text x={x+16} y={y+height-10} fontSize="10" opacity="0.7">{footer}</text>
    </g>
  </g>;
}

// Lightweight bounded previews preserve document layers and chart/table shape.
// They are explicitly partial thumbnails, not analytical exports.
export function DocumentPreview({ page }: { page: DashboardPage }) {
  const instance=useId().replace(/[^a-zA-Z0-9_-]/g,"_");
  const objects=[...page.elements.map(element=>({kind:"element" as const,id:element.id,layout:element.layout,hidden:element.hidden,element})),...page.tiles.map(tile=>({kind:"tile" as const,id:tile.id,layout:tile.layout,hidden:tile.hidden,tile}))].filter(object=>!object.hidden).sort((left,right)=>left.layout.zIndex-right.layout.zIndex);
  return <svg viewBox="0 0 1280 760" className="document-preview" aria-label={`Preview of ${page.title}`} role="img">
    <defs><clipPath id={`${instance}-page`}><rect width="1280" height="760"/></clipPath></defs>
    <rect width="1280" height="760" fill={page.background||"#fff"}/>
    <g clipPath={`url(#${instance}-page)`}>{objects.map((object,index)=>{
      if(object.kind==="tile")return <TilePreview key={`tile:${object.id}`} tile={object.tile} clipId={`${instance}-tile-${index}`}/>;
      const element=object.element,{x,y,width,height}=element.layout;
      const lineBudget=Math.max(0,Math.min(40,Math.floor((height-2*element.style.padding-element.style.fontSize)/(element.style.fontSize*element.style.lineHeight))+1));
      const lines=element.type==="text"&&lineBudget>0?element.content.split("\n",lineBudget+1):[];
      return <g key={`element:${element.id}`} data-preview-object={element.id} data-preview-kind="element" opacity={element.style.opacity/100}>
        <defs><clipPath id={`${instance}-element-${index}`}><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
        <g clipPath={`url(#${instance}-element-${index})`}>
        <rect x={x} y={y} width={width} height={height} rx={element.type==="circle"?Math.min(width,height)/2:element.style.borderRadius} fill={element.style.fill||"transparent"}/>
        {lines.slice(0,lineBudget).map((line,n)=><text key={n} x={x+element.style.padding} y={y+element.style.padding+element.style.fontSize+n*element.style.fontSize*element.style.lineHeight} fontFamily={element.style.fontFamily} fontSize={element.style.fontSize} fontWeight={element.style.fontWeight} fill={element.style.textColor}>{short(line,110)}{n===lineBudget-1&&lines.length>lineBudget?"…":""}</text>)}
        {element.type==="image"&&element.content&&<image href={element.content} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice"/>}
        </g>
      </g>;
    })}</g>
  </svg>;
}
