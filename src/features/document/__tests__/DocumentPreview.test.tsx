import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentPreview } from "../DocumentPreview";
import { initialDashboard } from "../documentSeeds";
import { createCanvasElement } from "../../builder/builderDocumentCommands";
import type { DashboardPage } from "../../../../shared/types/dashboard";
function page(value=500):DashboardPage {
 const page=structuredClone(initialDashboard.pages[0]);page.elements=[];page.tiles=[page.tiles[0]];const tile=page.tiles[0];tile.title="Synthetic tile";tile.name=tile.title;tile.visualization="table";tile.layout={x:48,y:50,width:760,height:460,zIndex:1};
 tile.result.columns=[{id:"summary",label:"Total"}];tile.result.table=[{optionId:"answer",label:"Answer A",values:{summary:value},bases:{summary:500}}];tile.result.series=[{id:"answer",label:"Answer A",values:[value],bases:[500]}];tile.result.metric={id:"count",label:"Count",valueFormat:"number"};tile.result.query={...tile.query,metric:"count"};tile.query=tile.result.query;
 return page;
}
describe("recognizable bounded document thumbnails",()=>{
 it("shows a table as cells with its actual column and value",()=>{
  const markup=renderToStaticMarkup(<DocumentPreview page={page()}/>);expect(markup).toContain("Total");expect(markup).toContain(">500<");
 });
 it("keeps large numeric bar geometry inside the page rather than scaling every metric as a percentage",()=>{
  const fixture=page();fixture.tiles[0].visualization="horizontal_bar";const markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);
  const rectangles=[...markup.matchAll(/<rect ([^>]+)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([a-z]+)="([^"]+)"/g)].map(attribute=>[attribute[1],attribute[2]])));
  for(const rect of rectangles)if(rect.x!==undefined&&rect.width!==undefined)expect(Number(rect.x)+Number(rect.width)).toBeLessThanOrEqual(1280);
 });
 it("paints mixed text and tile objects in their actual shared layer order",()=>{
  const fixture=page(),element=createCanvasElement("text",fixture);element.content="Layer above";element.layout.zIndex=100;fixture.elements=[element];
  const markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);expect(markup.indexOf("Layer above")).toBeGreaterThan(markup.indexOf("Synthetic tile"));
 });
 it("does not mutate the document when making its preview",()=>{const fixture=page(),original=structuredClone(fixture);renderToStaticMarkup(<DocumentPreview page={fixture}/>);expect(fixture).toEqual(original);});
});

it("gives every document and object a unique clipping scope",()=>{
 const fixture=page();const markup=renderToStaticMarkup(<><DocumentPreview page={fixture}/><DocumentPreview page={fixture}/></>);
 const ids=[...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(match=>match[1]);expect(ids.length).toBeGreaterThanOrEqual(4);expect(new Set(ids).size).toBe(ids.length);
});
it("labels a bounded table preview when it omits rows or groups",()=>{
 const fixture=page(),tile=fixture.tiles[0];tile.result.columns=Array.from({length:4},(_,index)=>({id:`c${index}`,label:`Group ${index}`}));tile.result.table=Array.from({length:20},(_,index)=>({optionId:`r${index}`,label:`Answer ${index}`,values:Object.fromEntries(tile.result.columns.map(column=>[column.id,index])),bases:Object.fromEntries(tile.result.columns.map(column=>[column.id,20]))}));
 const original=structuredClone(fixture),markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);expect(markup).toContain("Partial preview · 5/20 rows · 3/4 groups");expect(markup).toContain("Group 2");expect(markup).not.toContain(">Group 3<");expect(fixture).toEqual(original);
});
it("does not give a real numeric zero a fabricated minimum-width bar",()=>{
 const fixture=page(0);fixture.tiles[0].visualization="horizontal_bar";const markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);
 const valueBar=markup.match(/<rect[^>]* width="0"[^>]*><title>Answer A/);expect(valueBar).toBeTruthy();
});
it("draws multi-series bars and line gaps while retaining series labels",()=>{
 const fixture=page(-10),tile=fixture.tiles[0];tile.result.metric.id="average";tile.result.columns=[{id:"a",label:"Panel A"},{id:"b",label:"Panel B"}];tile.result.table=[{optionId:"first",label:"First",values:{a:-10,b:-20},bases:{a:1,b:1}},{optionId:"gap",label:"Gap",values:{a:NaN,b:NaN},bases:{a:0,b:0}},{optionId:"last",label:"Last",values:{a:0,b:-5},bases:{a:1,b:1}}];
 tile.visualization="grouped_bar";const bars=renderToStaticMarkup(<DocumentPreview page={fixture}/>);expect(bars).toContain("Panel A");expect(bars).toContain("Panel B");expect(bars).not.toContain('height="NaN"');
 tile.visualization="line_chart";const lines=renderToStaticMarkup(<DocumentPreview page={fixture}/>);expect([...lines.matchAll(/<circle /g)]).toHaveLength(4);expect(lines).not.toContain("<polyline");
});

it("reduces narrow table columns and clips long values inside their cells",()=>{
 const fixture=page(1e100),tile=fixture.tiles[0];tile.layout.width=180;
 tile.result.columns=[{id:"summary",label:"Total"},{id:"other",label:"Second"}];tile.result.table[0].values.other=4;
 const markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);
 expect(markup).toContain("1/2 groups");expect(markup).not.toContain(">Second<");expect(markup).toMatch(/<text clip-path="url\(#[^)]*-cell-0-0\)"/);
 tile.layout.width=120;expect(renderToStaticMarkup(<DocumentPreview page={fixture}/>)).toContain("Open report for full analysis");
});
it("bounds pasted text nodes to the visible line budget without changing the source",()=>{
 const fixture=page(),element=createCanvasElement("text",fixture);element.content=Array.from({length:10000},(_,n)=>`Pasted line ${n}`).join("\n");element.layout.height=120;fixture.elements=[element];
 const original=structuredClone(fixture),markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);
 expect([...markup.matchAll(/Pasted line /g)].length).toBeLessThanOrEqual(40);expect(markup).toContain("…");expect(markup).not.toContain("Pasted line 9999");expect(fixture).toEqual(original);
 element.layout.height=1;expect(renderToStaticMarkup(<DocumentPreview page={fixture}/>)).not.toContain("Pasted line");
});
it("discloses a cropped donut legend while retaining all segment geometry",()=>{
 const fixture=page(),tile=fixture.tiles[0];tile.visualization="donut";tile.layout.height=210;tile.result.metric={id:"percent_selected",label:"Percent",valueFormat:"percent"};
 tile.result.query.sourceIdentity={kind:"imported",datasetId:"synthetic",datasetLabel:"Synthetic",primaryFieldId:"answer",primaryFieldLabel:"Answer"};
 tile.result.table=Array.from({length:10},(_,n)=>({optionId:`r${n}`,label:`Answer ${n}`,values:{summary:10},bases:{summary:100}}));
 const markup=renderToStaticMarkup(<DocumentPreview page={fixture}/>);expect(markup).toContain("Partial legend · 6/10 answers");expect([...markup.matchAll(/<circle /g)]).toHaveLength(10);
});

