import { expect, it, vi } from "vitest";
import { acceptComparisonSourceFields, comparisonPlanHasWork, emptyComparisonReviewPlan, suggestComparisonSourceFields } from "../comparisonSourceSuggestionModel";
import { comparisonSuggestionFixture } from "./comparisonSuggestionFixture";

it("suggests only current field roles in an empty unreviewed plan without changing the source", async () => {
  const f = await comparisonSuggestionFixture(), before = JSON.stringify(f), hint = suggestComparisonSourceFields(f, f.origin);
  expect(hint.available).toBe(true); if (!hint.available) return;
  const plan = acceptComparisonSourceFields(hint, f);
  expect(plan).toEqual({ ...emptyComparisonReviewPlan(f.draft.id), datasetId: f.study.id, importedAt: f.study.importedAt, outcomeFieldId: f.study.fields[2].id, outcomeBinding: JSON.stringify(f.study.fields[2]), groupFieldId: f.study.fields[1].id, groupBinding: JSON.stringify(f.study.fields[1]) });
  expect(hint.outcome.column).toBe("Outcome"); expect(hint.group?.column).toBe("Group"); expect(JSON.stringify(f)).toBe(before);
  plan.question = "Independent edit"; expect(hint.plan.question).toBe("");
});
it("leaves the grouping field empty for an analysis with no breakout", async () => {
  const f = await comparisonSuggestionFixture(false), hint = suggestComparisonSourceFields(f, f.origin);
  expect(hint.available).toBe(true); if (hint.available) { expect(hint.group).toBeUndefined(); expect(hint.plan.groupFieldId).toBe(""); }
});
it("does not read any respondent value when suggesting or accepting source fields", async () => {
  const f = await comparisonSuggestionFixture(), read = vi.fn(() => { throw Error("row read"); });
  for (const row of [...f.study.rows, ...f.study.previewRows]) for (const key of Object.keys(row)) Object.defineProperty(row, key, { enumerable: true, configurable: true, get: read });
  const hint = suggestComparisonSourceFields(f, f.origin); expect(hint.available).toBe(true); expect(() => acceptComparisonSourceFields(hint, f)).not.toThrow(); expect(read).not.toHaveBeenCalled();
});
it.each([0, 1, 2, 3, 4, 5])("refuses conflicting explicit provenance at reference site %i", async site => {
  const f = await comparisonSuggestionFixture();
  // Separate aliased query objects so every recorded reference site is exercised independently.
  f.tile.query = structuredClone(f.tile.query); f.tile.result.query = structuredClone(f.tile.result.query); f.tile.result.metadataRefs.source = structuredClone(f.tile.result.metadataRefs.source);
  const refs = [f.tile.source!, f.tile.query, f.tile.query.sourceIdentity!, f.tile.result.query, f.tile.result.query.sourceIdentity!, f.tile.result.metadataRefs.source!];
  refs[site].sourceRef = { kind: "live_connection", provider: "snowflake", datasetId: f.study.id } as never;
  expect(suggestComparisonSourceFields(f, f.origin).available).toBe(false);
});
it.each(["import", "missing", "ambiguous", "field", "pending", "filter", "audience", "weight", "derived", "measure", "scope", "question", "remote", "prepared"])("refuses unsupported or stale %s source context", async kind => {
  const f = await comparisonSuggestionFixture();
  switch (kind) {
    case "import": f.study.importedAt = "2026-01-01T00:00:00Z"; break;
    case "missing": f.studies = []; break;
    case "ambiguous": f.studies.push(f.study); break;
    case "field": f.study.fields[2].id = "replacement"; break;
    case "pending": f.tile.query = { ...f.tile.query, metric: "sum" }; break;
    case "filter": f.tile.result.query.filters = [{ field: "Group", operator: "eq", value: "A" }] as never; break;
    case "audience": Object.assign(f.tile.result.query.sourceIdentity!, { audience: { id: "old" } }); break;
    case "weight": f.tile.result.weighting.applied = true; break;
    case "derived": f.tile.derivedOutput = {} as never; break;
    case "measure": f.tile.result.query.metric = "average"; break;
    case "scope": Object.assign(f.tile.result.query.sourceIdentity!, { groupingScope: "all_respondents" }); break;
    case "question": Object.assign(f.tile.source!, { kind: "question" }); break;
    case "remote": f.study.remote = { provider: "netlify" } as never; break;
    case "prepared": f.study.preparation = {} as never; break;
  }
  expect(suggestComparisonSourceFields(f, f.origin).available).toBe(false);
});
it.each(["field", "tile", "removed", "forged", "mutated"])("revalidates the original receipt before applying a %s suggestion", async kind => {
  const f = await comparisonSuggestionFixture(), hint = suggestComparisonSourceFields(f, f.origin); expect(hint.available).toBe(true); if (!hint.available) return;
  if (kind === "field") f.study.fields[2].sourceColumn = "Changed column";
  if (kind === "tile") f.tile.title = "Changed analysis";
  if (kind === "removed") f.draft.pages[0].tiles = [];
  if (kind === "mutated") hint.plan.design = "unweighted_independent";
  expect(() => acceptComparisonSourceFields(kind === "forged" ? structuredClone(hint) : hint, f)).toThrow();
});
it("rejects source metadata/query accessors without executing them", async () => {
  const f = await comparisonSuggestionFixture(), read = vi.fn(() => "unexpected"); Object.defineProperty(f.tile.query, "weight", { enumerable: true, get: read });
  expect(suggestComparisonSourceFields(f, f.origin).available).toBe(false); expect(read).not.toHaveBeenCalled();
  const g = await comparisonSuggestionFixture(); Object.defineProperty(g.study, "title", { enumerable: true, get: read }); expect(suggestComparisonSourceFields(g, g.origin).available).toBe(false); expect(read).not.toHaveBeenCalled();
});
it("does not pretend field hints seal raw-row values or replay original numeric results", async () => {
  const f = await comparisonSuggestionFixture(), hint = suggestComparisonSourceFields(f, f.origin); f.study.rows[0].Outcome = "N";
  expect(() => acceptComparisonSourceFields(hint, f)).not.toThrow(); // Final reviewed comparison binds and recounts these rows separately.
});
it.each(["question", "alpha", "design", "eventCodes"])("protects existing %s work, including edits without a selected study", key => {
  const p = emptyComparisonReviewPlan("report"); expect(comparisonPlanHasWork(p)).toBe(false);
  Object.assign(p, key === "alpha" ? { alpha: .01 } : key === "design" ? { design: "weighted" } : key === "eventCodes" ? { eventCodes: ["Y"] } : { question: "My question" }); expect(comparisonPlanHasWork(p)).toBe(true);
});
