import type { DashboardTile } from "../../../../shared/types/dashboard";
import type { DerivedOutputCreationCue, SavedLibraryInsertionCue } from "../builderTypes";

export interface SavedLibraryInsertionCueView {
  label: string;
  message: string;
  helper: string;
}

export interface DerivedOutputCreationCueView {
  label: string;
  message: string;
  helper: string;
}

function derivedOutputKindLabel(kind: NonNullable<DashboardTile["derivedOutput"]>["kind"]) {
  return kind === "top_n_extract" ? "top-N extract" : "lead-row summary";
}

export function buildSavedLibraryInsertionCueView(
  cue: SavedLibraryInsertionCue,
  tile: DashboardTile,
  now = Date.now()
): SavedLibraryInsertionCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  if (cue.sourceKind === "analyticalTemplate") {
    const differenceSummary = cue.templateDifferenceLabels?.length
      ? ` Saved defaults differ from the prior context for ${cue.templateDifferenceLabels.join(", ")}.`
      : "";
    return {
      label: cue.templateDifferenceLabels?.length ? "Created from analytical template using saved defaults" : "Created from analytical template",
      message: `${tile.title || tile.name} was created as a ${cue.objectLabel} from ${cue.sourceLabel}.`,
      helper: cue.sourceSummary
        ? `${cue.sourceSummary}.${differenceSummary} This object is selected for inspector editing.`
        : `${differenceSummary.trim()} Review the saved source, visualization, and query settings below.`.trim()
    };
  }

  return {
    label: "Created from saved variable set",
    message: `${tile.title || tile.name} was created as a ${cue.objectLabel} from ${cue.sourceLabel}.`,
    helper: "This object is selected for inspector editing. Update the analysis settings below or refresh if needed."
  };
}

export function buildDerivedOutputCreationCueView(
  cue: DerivedOutputCreationCue,
  tile: DashboardTile,
  now = Date.now()
): DerivedOutputCreationCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  const outputLabel = derivedOutputKindLabel(cue.outputKind);
  return {
    label: `Created from derived output: ${outputLabel}`,
    message: `${tile.title || tile.name} was created from ${cue.sourceTitle}.`,
    helper: "This read-only derived tile is selected for inspection and keeps its source relationship in the lifecycle summary."
  };
}
