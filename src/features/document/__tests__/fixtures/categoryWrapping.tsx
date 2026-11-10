import { createRoot } from "react-dom/client";
import { initialDashboard } from "../../documentSeeds";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { buildPageVisualSvg } from "../../../export/pageVisualExport";
import type { ChartType } from "../../../../../shared/types/analytics";

const bytes = new TextEncoder().encode("Answer,Banner,Spend\nNorth,A,10\nNorth,B,15\nSouth,A,20\nSouth,B,25\n");
const imported = await importDatasetBuffer(bytes.buffer, "synthetic-category-wrap.csv");
if (!imported.dataset) throw new Error(imported.error);
const dataset = imported.dataset;
const kinds: ChartType[] = ["vertical_bar", "horizontal_bar", "grouped_bar", "stacked_bar", "line_chart"];
const output = kinds.map(kind => {
  const grouped = kind === "grouped_bar" || kind === "stacked_bar";
  const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], bannerField: grouped ? dataset.fields[1] : null,
    measureField: dataset.fields[2], metric: "sum", chartType: kind });
  const page = structuredClone(initialDashboard.pages[0]);
  page.elements = [];
  page.tiles = [{ ...page.tiles[0], title: `${kind}: 23px wrapped category`, result, query: result.query, visualization: kind,
    layout: { x: 20, y: 20, width: 1200, height: 680, zIndex: 1 },
    appearance: { ...page.tiles[0].appearance, axisFontSize: 23, showValueLabels: false,
      axisLabelOverrides: { [result.table[0].optionId]: "North\nGrowth" } } }];
  return { kind, svg: buildPageVisualSvg(page) };
});
createRoot(document.getElementById("root")!).render(<main>
  <h1>Wrapped category labels at 23px</h1>
  <p>Synthetic data only. Actual reconstructed export SVG; no workspace writes, downloads or service calls.</p>
  {output.map(item => <section key={item.kind} aria-label={item.kind}><h2>{item.kind}</h2>
    <div style={{ width: 1280, maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: item.svg }}/></section>)}
</main>);
