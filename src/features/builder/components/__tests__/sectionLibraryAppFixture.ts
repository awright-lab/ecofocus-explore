import { formulaFixture } from "../../../metrics/__tests__/formulaFixture";
import { sectionBlocks } from "./sectionLibraryFixture";
export async function sectionLibraryAppFixture() {
  const fixture = await formulaFixture(10, 3);
  fixture.draft.id = "synthetic-section-library";
  fixture.draft.designLibrary.compositionStarters = sectionBlocks(3).map((block, index) => ({ ...block, label: `Curated section ${index + 1}` }));
  const saved = sectionBlocks(497);
  saved[0].items.push({ kind: "tile", tile: { ...structuredClone(fixture.source), id: "stored-analysis", title: "Stored synthetic responses" }, relativeLayout: { x: 16, y: 32, width: 540, height: 230, zIndex: 1 } });
  saved[0].summary = { ...saved[0].summary, objectCount: 3, tileCount: 1 };
  saved[1].description = "Long description without clipping: " + "Averylongunbrokenword".repeat(30) + "\n" + "Full editorial context. ".repeat(30);
  const image = saved[3].items[0];
  if (image.kind === "element") saved[3].items.push({ kind: "element", element: { ...structuredClone(image.element), id: "local-image", type: "image", content: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#19775b"/><circle cx="50" cy="50" r="30" fill="#b7dfc7"/></svg>')}` }, relativeLayout: { x: 40, y: 80, width: 100, height: 100, zIndex: 1 } });
  saved[3].summary = { ...saved[3].summary, objectCount: 3, elementCount: 3 }; saved[3].category = "image_caption";
  fixture.draft.designLibrary.compositionBlocks = saved;
  return fixture;
}
