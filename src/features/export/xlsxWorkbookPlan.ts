import type {DashboardDraft,DashboardPage} from "../../../shared/types/dashboard";
import {analyticalBase,analyticalCell} from "../../../shared/analytics/resultCells";
import {heatmapMetricIssue} from "../analytics/heatmapModel";
import {ownAxisLabel} from "../design-system/axisLabels";
import {narrativeCitation} from "../narratives/narrativeEvidence";
import {importedMeasureBasesNeedRefresh} from "../data/importedDatasetAnalytics";
import {analysisContextRows,assertExportResultsCurrent} from "./exportIntegrity";
function visiblePages(pages:DashboardPage[]){return [...pages].sort((a,b)=>a.order-b.order);}
function visibleTiles(page:DashboardPage){return page.tiles.filter(tile=>!tile.hidden).sort((a,b)=>a.layout.zIndex-b.layout.zIndex);}

function safeSheetName(value: string, fallback: string, used: Set<string>) {
  const base = (value || fallback).replace(/[\][*?/\\:\r\n\t]/g, " ").trim().slice(0, 28).replace(/^'+|'+$/g, "") || fallback;
  let name = base;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export interface XlsxWorkbookSheet { name: string; rows: Array<Array<string | number>> }

export function buildXlsxWorkbookPlan(dashboard: DashboardDraft, pages: DashboardPage[], generatedAt = new Date().toISOString()): XlsxWorkbookSheet[] {
  assertExportResultsCurrent(pages);
  const sortedPages = visiblePages(pages);
  const usedSheetNames = new Set<string>();
  const sheets: Array<{ name: string; rows: Array<Array<string | number>> }> = [
    {
      name: safeSheetName("Report", "Report", usedSheetNames),
      rows: [
        ["Report", dashboard.title],
        ["Status", dashboard.status],
        ["Version", dashboard.publishMetadata.versionLabel],
        ["Pages", sortedPages.length],
        ["Generated", generatedAt]
      ]
    }
  ];

  sortedPages.forEach((page) => {
    const narratives=page.elements.filter(element=>!element.hidden&&element.evidence!==undefined);
    if(narratives.length)sheets.push({name:safeSheetName(`${page.order}-Evidence`,"Evidence",usedSheetNames),rows:[
      ["Page",page.title],["Scope","Recorded links track selected result cells; they do not validate the written conclusion or authenticate source data."],
      ...narratives.flatMap(element=>[["Text object",element.name],["Written claim",element.content],["Reviewed at",element.evidence!.reviewedAt],["Recorded citations",narrativeCitation(element)],["Evidence definition (JSON)",JSON.stringify(element.evidence)],[]])
    ]});
    visibleTiles(page).forEach((tile) => {
      if (tile.visualization === "heatmap") { const issue = heatmapMetricIssue(tile.result); if (issue) throw Error(issue); }
      if (importedMeasureBasesNeedRefresh(tile.result)) throw new Error(`Refresh "${tile.title || tile.name}" before exporting: its cached numeric sample bases are unverified. JSON preserves the original result.`);
      for (const row of tile.result.table) for (const column of tile.result.columns) {
        if (analyticalBase(tile.result,row,column.id) === null) {
          throw new Error(`Cannot export "${tile.title || tile.name}": a cell base is missing or invalid. Refresh the analysis or use JSON to preserve it.`);
        }
      }
      sheets.push({
        name: safeSheetName(`${page.order}-${tile.title || tile.name}`, `Tile ${sheets.length}`, usedSheetNames),
        rows: [
          ["Page", page.title],
          ["Tile", tile.title || tile.name],
          ["Visualization", tile.visualization],
          ...analysisContextRows(tile),
          [],
          ["Source row label", "Display row label", ...tile.result.columns.flatMap((column) => {
            const alias = ownAxisLabel(tile.appearance,column.id);
            const label = alias && alias !== column.label ? `${column.label} (display: ${alias})` : column.label;
            return [`${label} — value`, `${label} — ${tile.result.weighting.applied ? "weighted base total" : "base"}`];
          })],
          ...tile.result.table.map((row) => [
            row.label,
            ownAxisLabel(tile.appearance,row.optionId) ?? row.label,
            ...tile.result.columns.flatMap((column) => [analyticalCell(tile.result,row,column.id).value ?? "Unavailable", row.bases[column.id]])
          ])
        ]
      });
    });
  });

  // Keep the authored story, including unlinked headings and methodology,
  // alongside the existing analytical tables and evidence definitions.
  const narrativeTextRows: Array<Array<string | number>> = [];
  for(const page of sortedPages.filter(page=>page.elements.some(element=>!element.hidden&&element.evidence!==undefined))){
    for(const element of page.elements.filter(element=>!element.hidden&&element.type==="text")){
      const parts:string[]=[];let part="",lineFeeds=0;
      for(const char of element.content){
        if(part.length+char.length>32000||char==="\n"&&lineFeeds>=250){parts.push(part);part="";lineFeeds=0;}
        part+=char;if(char==="\n")lineFeeds+=1;
      }
      parts.push(part);
      parts.forEach((content,index)=>narrativeTextRows.push([page.title,element.name,index+1,parts.length,content]));
    }
  }
  if(narrativeTextRows.length)sheets.push({name:safeSheetName("Narrative text","Narrative text",usedSheetNames),rows:[
    ["Scope","Authored text from pages with recorded evidence links. Layout is not reproduced; see each page's Evidence worksheet for citations and recorded analytical context."],
    ["Page","Text object","Part","Parts","Authored content"],...narrativeTextRows
  ]});

  return sheets;
}

