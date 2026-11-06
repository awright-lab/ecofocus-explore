import type { DashboardDraft, DashboardPage, DashboardTile, SavedDerivedDefinition } from "../../../shared/types/dashboard";
import { makePageId, makeTileId } from "../document/documentModel";
import { buildDerivedDefinitionFromTile, buildDerivedDefinitionFromDerivedTile, buildDerivedOutputMetadata } from "../builder/components/derivedOutputModel";
import { buildCellFormulaResponse, canonicalFormulaValue, cellFormulaSourceToken, makeCellFormulaSpec, type CellFormulaConfig } from "./cellFormulaModel";

export interface CellFormulaPlan { reportId: string; sourceId: string; definitionId: string; rowId: string; comparedRowId: string; columnId: string; expression: string; label: string; targetId: string; expectedBinding: string }
export interface CellFormulaPreview { token: string; source: DashboardTile; sourcePage: DashboardPage; response: DashboardTile["result"]; metadata: NonNullable<DashboardTile["derivedOutput"]>; definition: SavedDerivedDefinition }
export function previewCellFormula(draft: DashboardDraft, plan: CellFormulaPlan): CellFormulaPreview {
  if (draft.id !== plan.reportId) throw Error("The report changed. Start a formula in the current report.");
  const sources = draft.pages.flatMap(page => page.tiles.filter(tile => tile.id === plan.sourceId).map(tile => ({ tile, page })));
  if (sources.length !== 1) throw Error("Choose one available, unambiguous source analysis.");
  const { tile: source, page: sourcePage } = sources[0];
  const config: CellFormulaConfig = { rowId: plan.rowId, comparedRowId: plan.comparedRowId, columnId: plan.columnId, formula: { expression: plan.expression, label: plan.label, binding: plan.expectedBinding || undefined } };
  const spec = makeCellFormulaSpec(source, config), response = buildCellFormulaResponse(source, config), metadata = buildDerivedOutputMetadata(source, "cell_formula", config)!;
  const definition = buildDerivedDefinitionFromTile(source, "cell_formula", config)!;
  definition.id = plan.definitionId; definition.label = spec.label; definition.description = `Reusable paired-cell formula: ${spec.expression}. A=${spec.input.a.label}; B=${spec.input.b.label}; ${spec.input.column.label}.`;
  const identity = source.result.query.sourceIdentity;
  if (identity?.kind !== "imported") throw Error("The source context is unavailable.");
  definition.source = { kind: "importedField", id: `${identity.datasetId}:${identity.primaryFieldId}`, label: identity.primaryFieldLabel };
  return { token: canonicalFormulaValue({ plan, existingDefinition: draft.analysisLibrary.derivedDefinitions.filter(item => item.id === plan.definitionId), sourcePageId: sourcePage.id, source: cellFormulaSourceToken(source), spec }), source, sourcePage, response, metadata, definition };
}
export function commitCellFormula(draft: DashboardDraft, plan: CellFormulaPlan, reviewedToken: string, mode: "save" | "create" | "refresh", ids = { tileId: makeTileId(), pageId: makePageId() }): { draft: DashboardDraft; pageId?: string; tileId?: string } {
  const preview = previewCellFormula(draft, plan);
  if (preview.token !== reviewedToken) throw Error("The formula, source or bindings changed since preview. Review the current calculation before saving.");
  const library = draft.analysisLibrary.derivedDefinitions;
  if (!plan.definitionId.trim() || library.filter(item => item.id === plan.definitionId).length > 1 || library.some(item => item.id === plan.definitionId && item.outputKind !== "cell_formula")) throw Error("The saved formula identity conflicts with another definition.");
  if (library.some(item => item.id !== plan.definitionId && item.label.trim().toLocaleLowerCase() === preview.definition.label.toLocaleLowerCase())) throw Error("Another saved calculation already uses that name. Choose a different name; the existing definition was preserved.");
  if (!library.some(item => item.id === plan.definitionId) && library.filter(item => item.outputKind === "cell_formula").length >= 100) throw Error("This report supports up to 100 saved formulas. Remove an unused definition before adding another.");
  const next = { ...draft, status: "draft" as const, analysisLibrary: { ...draft.analysisLibrary, derivedDefinitions: [...library.filter(item => item.id !== plan.definitionId), structuredClone(preview.definition)] } };
  if (mode === "save") return { draft: next };
  const metadata = { ...preview.metadata, lastRecreatedAt: mode === "refresh" ? Date.now() : undefined, savedDefinition: { id: plan.definitionId, label: preview.definition.label, outputKind: "cell_formula" as const, sourceTileId: preview.source.id, sourceTileTitle: preview.source.title } };
  const response = structuredClone(preview.response); response.query.chartType = "table";
  const tile: DashboardTile = { ...structuredClone(preview.source), id: ids.tileId, title: preview.definition.label, name: preview.definition.label, hidden: false, locked: false, query: structuredClone(response.query), result: response, visualization: "table", derivedOutput: structuredClone(metadata), analysisLifecycle: { role: "derived", canonicalTileId: preview.source.analysisLifecycle?.canonicalTileId ?? preview.source.id, canonicalLabel: preview.source.title, derivedFrom: { tileId: preview.source.id, title: preview.source.title, visualization: preview.source.visualization } }, layout: { x: 64, y: 100, width: 1152, height: 500, zIndex: 1 }, appearance: { ...structuredClone(preview.source.appearance), titleWidth: 1080, titleFontSize: 22, showTable: true, showBases: true, showNotes: true, showAnnotations: false } };
  if (mode === "refresh") {
    const targets = draft.pages.flatMap(page => page.tiles.filter(item => item.id === plan.targetId).map(item => ({ page, item })));
    if (targets.length !== 1 || targets[0].item.derivedOutput?.kind !== "cell_formula" || targets[0].item.derivedOutput.sourceTileId !== plan.sourceId) throw Error("The selected formula result is missing or its source changed. No report result was replaced.");
    const target = targets[0];
    return { draft: { ...next, pages: next.pages.map(page => page.id !== target.page.id ? page : { ...page, tiles: page.tiles.map(item => item.id !== target.item.id ? item : { ...tile, id: item.id, title: item.title !== item.derivedOutput?.formula?.label ? item.title : tile.title, name: item.name !== item.derivedOutput?.formula?.label ? item.name : tile.name, layout: item.layout, appearance: item.appearance, hidden: item.hidden, locked: item.locked }) }) }, pageId: target.page.id, tileId: target.item.id };
  }
  if (draft.pages.some(page => page.id === ids.pageId) || draft.pages.some(page => page.tiles.some(item => item.id === ids.tileId))) throw Error("The generated output identity conflicts with the report. Retry; existing pages were preserved.");
  const page: DashboardPage = { ...structuredClone(preview.sourcePage), id: ids.pageId, title: preview.definition.label, order: Math.max(0, ...draft.pages.map(item => item.order)) + 1, elements: [], tiles: [tile], provenance: { masterStatus: "none", status: "custom" } };
  return { draft: { ...next, pages: [...next.pages, page] }, pageId: page.id, tileId: tile.id };
}
export function planFromFormula(draft: DashboardDraft, definition: SavedDerivedDefinition, targetId = ""): CellFormulaPlan {
  if (definition.outputKind !== "cell_formula" || !definition.spec.formula) throw Error("Choose a saved formula definition.");
  return { reportId: draft.id, sourceId: definition.sourceTileId, definitionId: definition.id, rowId: definition.spec.rowId ?? "", comparedRowId: definition.spec.comparedRowId ?? "", columnId: definition.spec.columnId, expression: definition.spec.formula.expression, label: definition.spec.formula.label, targetId, expectedBinding: definition.spec.formula.binding };
}
export function definitionForFormulaResult(draft: DashboardDraft, tile: DashboardTile, copyId: string): SavedDerivedDefinition {
  const definition = buildDerivedDefinitionFromDerivedTile(tile); if (!definition?.spec.formula || definition.outputKind !== "cell_formula") throw Error("The result's formula metadata is unavailable. Original content was preserved.");
  const saved = draft.analysisLibrary.derivedDefinitions.find(item => item.id === tile.derivedOutput?.savedDefinition?.id);
  const recipe = (item: SavedDerivedDefinition) => ({ binding: item.spec.formula?.binding, expression: item.spec.formula?.expression, label: item.spec.formula?.label });
  definition.id = saved && canonicalFormulaValue(recipe(saved)) === canonicalFormulaValue(recipe(definition)) ? saved.id : copyId;
  definition.label = definition.spec.formula.label; return definition;
}
