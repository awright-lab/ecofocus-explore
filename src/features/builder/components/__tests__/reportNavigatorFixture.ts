import { initialDashboard } from "../../../document/documentSeeds";
import { createCanvasElement } from "../../builderDocumentCommands";
/** Fully synthetic authored content; no respondent data or remote dependencies. */
export function reportNavigatorPages(count = 100, objects = 20) {
  return Array.from({ length: count }, (_, p) => {
    const page = structuredClone(initialDashboard.pages[0]);
    page.id = `page/東京#${p}`; page.order = p + 1; page.title = `Chapter ${p + 1} · Research findings`;
    page.tiles = []; page.elements = [];
    for (let n = 0; n < objects; n++) {
      const note = createCanvasElement(n % 5 === 3 ? "rectangle" : "text", page);
      note.id = `note/Δ#${p}:${n}`; note.name = "Research note";
      note.content = `Synthetic insight ${p * objects + n + 1}: customers value clear information.`;
      note.layout = { x: 50 + (n % 4) * 290, y: 80 + Math.floor(n / 4) * 125, width: 270, height: 105, zIndex: n };
      note.hidden = n === 18; note.locked = n === 19;
      page.elements.push(note);
    }
    return page;
  });
}
