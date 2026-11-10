import { expect, it } from "vitest";
import { reportNavigatorPages } from "./reportNavigatorFixture";
import { type ReportObjectFilters, reportObjectSearchLimits, reportObjectMatchKey, resolveReportObjectMatch, searchReportObjects } from "../reportObjectSearch";
it("enumerates all 2,000 matches in bounded windows, including 21 and the last, without edits", () => {
  const pages = reportNavigatorPages(), before = JSON.stringify(pages), keys: string[] = [];
  for (let offset = 0; offset < 2000; offset += 25) {
    const result = searchReportObjects(pages, "Research note", { browse: true, offset, limit: 25 });
    expect(result.total).toBe(2000); expect(result.matches).toHaveLength(25);
    keys.push(...result.matches.map(reportObjectMatchKey));
    for (const match of result.matches) expect(resolveReportObjectMatch(pages, "Research note", match)?.object.id).toBe(match.object.id);
  }
  expect(new Set(keys).size).toBe(2000); expect(keys[20]).toContain("note/Δ#1:0"); expect(keys.at(-1)).toContain("note/Δ#99:19"); expect(JSON.stringify(pages)).toBe(before);
});
it("filters are complete and revalidated against same-reference changes and ordering", () => {
  const pages = reportNavigatorPages(3);
  const filters: ReportObjectFilters = { pageId: pages[2].id, visibility: "hidden" as const, type: "text" as const };
  // Hidden item 18 is a shape, so the text filter honestly yields none.
  expect(searchReportObjects(pages, "", { browse: true, filters }).total).toBe(0);
  filters.type = "shape";
  const match = searchReportObjects(pages, "", { browse: true, filters }).matches[0];
  expect(match.object.hidden).toBe(true); pages.reverse();
  expect(resolveReportObjectMatch(pages, "", match, { browse: true, filters })?.page.id).toBe(match.page.id);
  match.object.hidden = false; expect(resolveReportObjectMatch(pages, "", match, { browse: true, filters })).toBeNull();
  match.object.hidden = true; match.object.name = "Renamed"; expect(resolveReportObjectMatch(pages, "Research note", match, { browse: true, filters })).toBeNull();
  pages.find(p => p.id === match.page.id)!.elements = []; expect(resolveReportObjectMatch(pages, "", match, { browse: true, filters })).toBeNull();
});
it("rejects ambiguous identities after reordering and never reads payload or analytical cells", () => {
  const pages = reportNavigatorPages(1), image = pages[0].elements[0]; image.type = "image";
  Object.defineProperty(image, "content", { get: () => { throw Error("private image payload read"); } });
  expect(searchReportObjects(pages, "", { browse: true }).total).toBe(20);
  const match = searchReportObjects(pages, "Research note").matches[0];
  pages[0].elements.push({ ...pages[0].elements[1], id: image.id });
  expect(resolveReportObjectMatch(pages, "Research note", match)).toBeNull();
});

it("retains names-only fallback across windows and activation", () => {
  const pages = reportNavigatorPages(2); pages[0].elements[0].content = "x".repeat(reportObjectSearchLimits.textCharacters + 1);
  const result = searchReportObjects(pages, "Research note", { browse: true, offset: 25, limit: 25 });
  expect(result.total).toBe(40); expect(result.matches).toHaveLength(15); expect(result.textIncluded).toBe(false); expect(result.issue).toContain("Names-only"); expect(result.matches.every(match => !match.excerpt)).toBe(true);
  expect(resolveReportObjectMatch(pages, "Research note", result.matches.at(-1)!, { browse: true })).not.toBeNull();
  expect(searchReportObjects(pages, "x".repeat(201), { browse: true }).issue).toContain("200");
});

it.each(["page", "object"])("snapshots %s identity before a mutable reference changes in place", kind => {
  const pages = reportNavigatorPages(2);
  const match = searchReportObjects(pages, "Research note", { browse: true, offset: 21 }).matches[0];
  const key = reportObjectMatchKey(match);
  if (kind === "page") match.page.id = "replacement/page"; else match.object.id = "replacement/object";
  expect(reportObjectMatchKey(match)).toBe(key);
  expect(resolveReportObjectMatch(pages, "Research note", match, { browse: true })).toBeNull();
});
