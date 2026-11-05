import { expect, it } from "vitest";
import { researchSearchMatcher } from "../researchSearch";
it("matches full wording and declared topic across multiple terms in any order", () => { const match = researchSearchMatcher("packaging trust"); expect(match(["How much do you trust sustainability claims?", "Food and beverage packaging"])).toBe(true); expect(match(["Packaging purchase priorities"])).toBe(false); });
it("normalizes case, accents and compatibility characters without altering source metadata", () => { const metadata = ["Café sustainability", "Ｑ１２_A1"]; const before = [...metadata]; expect(researchSearchMatcher("CAFE q12 a1")(metadata)).toBe(true); expect(metadata).toEqual(before); });
it("supports punctuation in questions and field codes", () => { expect(researchSearchMatcher("trust? q12-a1")(["Q12_A1: Trust in claims"])).toBe(true); });
it("keeps empty and punctuation-only searches open without requiring metadata", () => { expect(researchSearchMatcher("  ")([])).toBe(true); expect(researchSearchMatcher("?!")([])).toBe(true); });
it("does not invent synonyms or matches for metadata that is absent", () => { expect(researchSearchMatcher("environmental")(["Annual spending", null, undefined])).toBe(false); expect(researchSearchMatcher("organic")(["Q1", "Shopping frequency"])).toBe(false); });
it("requires all distinct terms rather than silently broadening a multiword query", () => { expect(researchSearchMatcher("packaging packaging trust")(["Packaging trust"])).toBe(true); expect(researchSearchMatcher("packaging trust")(["Trust in brands"])).toBe(false); });
