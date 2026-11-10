import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analyticalBase, analyticalCell } from "../../../shared/analytics/resultCells";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { recordedCalculation } from "../../../shared/analytics/recordedCalculation";
import { localExecutionShape } from "../../../shared/analytics/localExecutionEvidence";
import { audienceSummary } from "../audiences/audienceModel";
import { resultInferenceLabel, withSafeInference } from "../../../shared/analytics/inferenceSafety";
import { getQuestionMetadata, getDimensionMetadata } from "../../../shared/metadata/ecofocus2025";
import type { DashboardTile } from "../../../shared/types/dashboard";
export interface ResultEvidence {
  status: "available" | "unavailable";
  heading: string;
  facts: Array<{ label: string; value: string }>;
  explanation: string;
  warnings: string[];
  cellWarnings: string[];
  settingsCurrent: boolean;
}
// IDs are dictionary keys, not object properties to inherit. Preserve explicit
// own overrides, including keys such as constructor or __proto__.
export function resultRowLabelOverride(tile: Pick<DashboardTile, "appearance">, rowId: string): string | null {
  const overrides = tile.appearance.axisLabelOverrides;
  const value = Object.hasOwn(overrides, rowId) ? overrides[rowId] : null;
  return typeof value === "string" && value.trim() ? value : null;
}
export function buildResultEvidence(tile: DashboardTile, rowId: string, columnId: string,localVerified=false): ResultEvidence | null {
  if (resultIdentityIssue(tile.result)) return null;
  const result = withSafeInference(tile.result), row = result.table.find(item => item.optionId === rowId), column = result.columns.find(item => item.id === columnId);
  if (!row || !column) return null;
  const source = result.metadataRefs.source ?? result.query.sourceIdentity;
  const imported = source?.kind === "imported" ? source : null;
  const cell = analyticalCell(result, row, columnId), base = analyticalBase(result,row,columnId);
  const calculation = recordedCalculation(result, row, columnId);
  const noDenominator = calculation !== null && !calculation.hasObservations;
  const unavailableInput = result.calculationInputs ? "Not available for this saved cell" : "Not stored separately";
  const appliedWeight = result.weighting.applied;
  const unverifiedWeight = !appliedWeight && Boolean(result.query.weight);
  const weighted = appliedWeight || unverifiedWeight;
  const measure = result.metric.id === "average" || result.metric.id === "sum";
  const verifiedMeasureBase = Boolean(imported && measure && imported.measureBaseScope === "cell");
  const validBase = base !== null;
  const baseValue = imported && measure && !verifiedMeasureBase ? "Unverified; rerun analysis" : validBase ? String(base) : "Not recorded as a valid base";
  const baseLabel = appliedWeight ? "Recorded weighted base total" : unverifiedWeight ? "Recorded base (weighting unverified)" : verifiedMeasureBase ? "Valid numeric observations in this cell" : "Recorded base";
  const value = noDenominator ? "Unavailable: no valid observations" : cell.status === "available" ? `${String(cell.value)}${result.metric.valueFormat === "percent" ? "%" : ""}` : cell.status === "no_observations" ? "Unavailable: no valid observations" : cell.status === "rerun_required" ? "Unavailable: rerun to verify sample bases" : "Unavailable: invalid saved value or base";
  const dataset = source?.kind === "imported" || source?.kind === "live" ? source.datasetLabel : source?.kind === "seeded" ? source.datasetLabel ?? source.datasetId : result.query.sourceRef?.label ?? result.query.dataset;
  const grouping = imported?.primaryFieldLabel ?? (source?.kind === "seeded" ? source.questionLabel ?? getQuestionMetadata(result.query.dataset, result.query.question)?.label : null) ?? result.query.question;
  const filter = imported ? imported.filterFieldLabel && imported.filterValue !== undefined ? `${imported.filterFieldLabel} is ${imported.filterValue}` : "No filter recorded" : result.query.filters.filter(item => !item.values.includes("all")).map(item => {
    const metadata = getDimensionMetadata(result.query.dataset, item.field as Parameters<typeof getDimensionMetadata>[1]);
    return `${metadata?.label ?? item.field}: ${item.values.map(value => metadata?.values.find(option => option.id === value)?.label ?? value).join(" or ")}`;
  }).join("; ") || "No filter recorded";
  const rowOverride = resultRowLabelOverride(tile, row.optionId);
  const receipt=localVerified&&localExecutionShape(result)?result.localExecution:null;
  const facts = [
    { label: "Stored value", value }, { label: "Row", value: row.label }, { label: "Column", value: column.label },
    ...(rowOverride && rowOverride !== row.label ? [{ label: "Canvas row label", value: rowOverride }] : []),
    { label: "Study", value: dataset }, { label: imported ? "Grouping" : "Question", value: grouping },
    ...(imported?.primaryFieldPrompt ? [{ label: "Recorded question wording", value: imported.primaryFieldPrompt }] : []),
    ...(measure ? [{ label: "Numeric measure", value: imported?.measureFieldLabel ?? "Not identified in the saved source metadata" }] : []),
    { label: "Metric", value: result.metric.label }, { label: baseLabel, value: baseValue },
    { label: "Weighting", value: unverifiedWeight ? "A weight was requested, but its application is not confirmed in the saved result" : appliedWeight ? `${result.weighting.label || "Weight applied"}; weighted totals are not respondent sample sizes` : "Unweighted" },
    { label: "Filter", value: filter },
    ...(imported?[{label:"Recorded audience",value:result.localExecution&&!receipt?"Unverified recorded audience snapshot; refresh before using its provenance":imported.audience?audienceSummary(imported.audience):"No audience predicate recorded; other filters or exclusions may apply"}]:[]),
    ...(imported?.datasetImportedAt && Number.isFinite(Date.parse(imported.datasetImportedAt)) ? [{ label: "Study import event", value: imported.datasetImportedAt }] : []),
    { label: "Data version", value: receipt?`SHA-256 analysis-input version: ${receipt.sourceDigest}`:result.localExecution?"Recorded source version is unverified":"No immutable content version recorded" },
    ...(receipt?[{label:"Versioned execution",value:receipt.executedAt},{label:"Source-version scope",value:`All ${receipt.coverage.sourceRows} source rows projected onto ${receipt.projectedFieldCount} of ${receipt.sourceFieldCount} fields used by this analysis; includes their metadata, import identity and query. ${receipt.preparation?'Includes the recorded preparation recipe and its original-study fingerprint; not source authentication.':'Not a hash of unrelated columns or source authentication.'}`}]:[]),
    { label: "Statistical testing", value: resultInferenceLabel(result) },
  ];
  if (receipt?.preparation) {
    const lineage = receipt.preparation, recipe = lineage.recipe;
    facts.push(
      { label: "Preparation source", value: `${lineage.sourceTitle} (${recipe.sourceDatasetId})` },
      { label: "Preparation source import event", value: recipe.sourceImportedAt },
      { label: "Preparation source version", value: `SHA-256 original preparation inputs: ${recipe.sourceFingerprint}. Covers the original study identity, fields and all rows, not source authentication.` },
      { label: "Preparation verification", value: "At this execution the complete prepared fields and rows matched replay of this recorded recipe from the retained original. This receipt does not recheck current studies or prove historical source authenticity." },
      { label: "Recorded preparation recipe", value: JSON.stringify(recipe, null, 2) },
    );
  }
  let explanation: string;
  if (result.metric.id === "average") {
    explanation = calculation ? noDenominator ? "No valid numeric observations were recorded for this cell. Its zero placeholder is not an observed average." : "The recorded numeric total divided by the valid observations produced this average. These inputs were retained separately from the displayed average." : unverifiedWeight ? "The saved weighting status is unconfirmed. Do not reconstruct a numerator or interpret its recorded base as an unweighted observation count." : weighted ? "A weighted average uses weighted values and weighting totals. The separate calculation inputs were not retained here, so no weighted numerator or denominator is reconstructed." : "An average divides the numeric total by the valid observations for that cell. Compatible calculation inputs are unavailable and are not reconstructed from this average.";
    facts.push({ label: "Numeric total", value: calculation ? noDenominator ? "Unavailable: no valid observations" : String(calculation.numerator) : unavailableInput });
    if (calculation) facts.push({ label: "Calculation denominator", value: String(calculation.denominator) });
  } else if (result.metric.id === "sum") explanation = "This is the recorded sum for the observations in this row and column. The valid-observation base describes coverage; it is not a divisor.";
  else if (result.metric.id === "count") explanation = unverifiedWeight ? "This is the recorded total; weighting application is unconfirmed, so it is not treated as a respondent count." : weighted ? "This is a recorded weighted total. It must not be interpreted as the number of people." : "This is the count recorded for this row and column. The recorded base may cover the whole column rather than this row alone.";
  else {
    explanation = calculation ? noDenominator ? "There is no valid denominator for this cell. A zero placeholder does not establish a measured percentage." : calculation.percentageValueMode ? "The recorded response count times 100 divided by its recorded denominator produced this unrounded percentage. Labels may be rounded for display." : "The recorded response count divided by its recorded denominator produced this percentage. Counts were retained before rounding the percentage to one decimal place." : "This is the percentage recorded for this row and column. Compatible separate inputs are unavailable; an exact response count cannot be recovered from a rounded percentage.";
    facts.push({ label: "Exact numerator", value: calculation ? String(calculation.numerator) : unavailableInput });
    if (calculation) facts.push({ label: "Calculation denominator", value: String(calculation.denominator) });
  }
  const warnings = [...result.warnings];
  if(receipt){warnings.push('The local result/receipt integrity check passed. This does not authenticate the source, verify representativeness or establish that the current source has not changed. Preview a fresh versioned execution to compare current inputs.');const c=receipt.coverage;facts.push({label:'Whole-analysis exclusion stages',value:`${c.sourceRows} source rows; ${c.audienceExcluded} audience nonmembers; ${c.audienceUnknown} unknown audience membership; ${c.filterExcluded} filter exclusions; ${c.missingGrouping} missing grouping answers; ${c.invalidNumeric} invalid numeric values; ${c.includedRows} included rows. These disjoint stages describe the whole query, not just this cell. Blank breakout answers remain their own group.`});if(result.metric.id==='count'&&cell.status==='available')facts.push({label:'Exact count numerator',value:String(cell.value)},{label:'Calculation divisor',value:'None: this is a response count, not a ratio.'});if(result.metric.id==='sum'&&cell.status==='available')facts.push({label:'Recorded numeric total',value:String(cell.value)},{label:'Calculation divisor',value:'None: the valid-observation base describes coverage and is not a divisor.'});}
  const cellWarnings: string[] = [];
  if (result.calculationInputs && !calculation) cellWarnings.push("This cell has no compatible recorded calculation inputs. They were not inferred from the displayed value.");
  if (weighted) warnings.push("The unweighted respondent sample size is not retained separately in this result.");
  if (!validBase) cellWarnings.push("This cell does not contain a valid recorded base. Rerun the analysis before interpreting its sample size.");
  if (result.metric.id === "sum" && base === 0) cellWarnings.push("This zero total has no valid observations; it does not establish that observed values were zero.");
  if (source?.kind === "seeded" || source?.sourceRef?.kind === "seeded_demo" || result.query.sourceRef?.kind === "seeded_demo") warnings.push("This result uses illustrative sample data.");
  return { status: cell.status === "available" && !noDenominator ? "available" : "unavailable", heading: `${row.label} / ${column.label}`, facts, explanation,
    warnings: [...new Set(warnings)], cellWarnings: [...new Set(cellWarnings)], settingsCurrent: analysisSettingsMatch(tile.query, result.query) };
}
