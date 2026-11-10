import { useState } from "react";
import { createRoot } from "react-dom/client";
import { initialDashboard } from "../../documentSeeds";
import { ChartView } from "../../../builder/components/CanvasRenderers";
import { buildPageVisualSvg } from "../../../export/pageVisualExport";
import { buildPdfBlob, buildPptxBlob } from "../../../export/coreDocumentExports";
import "../../../../styles.css";
import "../../../../studio.css";
const page = structuredClone(initialDashboard.pages[0]);
page.elements = []; page.tiles = [page.tiles[0]];
const tile = page.tiles[0]; tile.visualization = "grouped_bar";
tile.layout = { x:30,y:30,width:1200,height:680,zIndex:1 };
tile.appearance = {...tile.appearance,barStyles:{},barFillMode:"gradient",barGradientType:"conic",showValueLabels:false};
const source = JSON.stringify(tile.result);
function App() {
 const [mode,setMode] = useState<"conic"|"linear">("conic"),[status,setStatus] = useState("Synthetic seeded result; no workspace writes or network calls.");
 const current={...page,tiles:[{...tile,appearance:{...tile.appearance,barGradientType:mode}}]};
 async function attempt(format:"SVG"|"PDF"|"PPTX") {
  try { const result = format === "SVG" ? buildPageVisualSvg(current) : format === "PDF" ? await buildPdfBlob([current]) : await buildPptxBlob([current]);
   setStatus(`${format} constructed (${typeof result === "string" ? result.length : result.size} bytes/characters). Original analysis unchanged: ${JSON.stringify(current.tiles[0].result)===source}. No automatic download.`);
  } catch(error) { setStatus(`${format}: ${error instanceof Error ? error.message : "Failed"} Original analysis unchanged: ${JSON.stringify(current.tiles[0].result)===source}.`); }
 }
 return <main style={{padding:24}}><h1>Chart paint safety acceptance</h1><p role="status">{status}</p><button onClick={()=>void attempt("SVG")}>Construct SVG</button><button onClick={()=>void attempt("PDF")}>Construct PDF</button><button onClick={()=>void attempt("PPTX")}>Construct PowerPoint</button><button onClick={()=>setMode("linear")}>Choose linear fill</button><div style={{height:400,width:1000}}><ChartView tile={current.tiles[0]}/></div></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
