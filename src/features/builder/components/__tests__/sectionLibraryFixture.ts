import { initialDashboard } from "../../../document/documentSeeds";
import type { SavedCompositionBlock } from "../../../../../shared/types/dashboard";
export function sectionBlocks(count = 500): SavedCompositionBlock[] {
  const page = initialDashboard.pages[0], text = structuredClone(page.elements.find(element => element.type === "text") ?? page.elements[0]);
  text.type = "text"; text.hidden = false; text.locked = false; text.name = "Section commentary"; text.content = "Stored commentary · editable report copy";
  text.style = { ...text.style, fontSize: 24, padding: 12, fill: "transparent", opacity: 100 };
  const shape = structuredClone(text); shape.type = "rectangle"; shape.name = "Section background"; shape.content = ""; shape.style.fill = "#dceee3";
  return Array.from({ length: count }, (_, index) => ({
    id: ["constructor", "__proto__", "toString", "saved/東京#Δ"][index] ?? `section-${index}`,
    label: index < 4 ? "Reusable insight" : `Reusable insight ${index + 1}`,
    description: `Synthetic reusable section ${index + 1}. An editorial layout for a clear research story.`,
    category: index % 2 ? "callout" : "narrative", createdAt: 1000,
    summary: { objectCount: 2, tileCount: 0, elementCount: 2, width: 800, height: 300 },
    items: [
      { kind: "element", element: { ...structuredClone(text), id: `text-${index}` }, relativeLayout: { x: 400, y: 50, width: 360, height: 160, zIndex: 2 } },
      { kind: "element", element: { ...structuredClone(shape), id: `shape-${index}` }, relativeLayout: { x: 0, y: 0, width: 800, height: 300, zIndex: 0 } }
    ]
  }));
}
