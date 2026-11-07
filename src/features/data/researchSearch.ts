// Local metadata search only: use declared question wording/topics and field
// names, never infer a concept or scan respondent values. Compile query terms
// once per search; empty searches avoid formatting every field.
function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}
export function researchSearchMatcher(query: string) {
  const terms = [...new Set(normalize(query).match(/[\p{L}\p{N}_]+/gu) ?? [])];
  return (metadata: ReadonlyArray<string | undefined | null>) => {
    if (!terms.length) return true;
    const text = normalize(metadata.filter(value => typeof value === "string").join(" "));
    return terms.every(term => text.includes(term));
  };
}
