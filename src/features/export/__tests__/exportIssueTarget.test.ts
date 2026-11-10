import { expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { resolveExportIssueTarget } from "../exportIssueTarget";
function fixture() { const draft = structuredClone(initialDashboard); draft.pages = [draft.pages[0]]; return draft; }
it("resolves page, analysis and element targets without changing source", () => {
 const draft = fixture(), before = structuredClone(draft), page = draft.pages[0], base = { reportId: draft.id, pageId: page.id };
 expect(resolveExportIssueTarget(draft, base)).toEqual({pageId:page.id,kind:"page"});
 expect(resolveExportIssueTarget(draft, {...base,objectId:page.tiles[0].id})).toEqual({pageId:page.id,objectId:page.tiles[0].id,kind:"tile"});
 expect(resolveExportIssueTarget(draft, {...base,objectId:page.elements[0].id})).toEqual({pageId:page.id,objectId:page.elements[0].id,kind:"element"}); expect(draft).toEqual(before);
});
it.each(["report", "page", "object", "duplicate page", "duplicate object", "cross-kind collision", "hidden tile", "hidden element"])("refuses stale or ambiguous target: %s", kind => {
 const draft=fixture(),page=draft.pages[0],target={reportId:draft.id,pageId:page.id,objectId:page.tiles[0].id};
 if(kind==="report")target.reportId="other";if(kind==="page")target.pageId="other";if(kind==="object")target.objectId="other";
 if(kind==="duplicate page")draft.pages.push(structuredClone(page));if(kind==="duplicate object")page.tiles.push(structuredClone(page.tiles[0]));
 if(kind==="cross-kind collision")page.elements[0].id=target.objectId;if(kind==="hidden tile")page.tiles[0].hidden=true;
 if(kind==="hidden element"){target.objectId=page.elements[0].id;page.elements[0].hidden=true;}
 const before=structuredClone(draft);expect(resolveExportIssueTarget(draft,target)).toBeNull();expect(draft).toEqual(before);
});
