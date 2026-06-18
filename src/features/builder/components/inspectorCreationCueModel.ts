import type { DashboardTile } from "../../../../shared/types/dashboard";
import type { SavedLibraryInsertionCue } from "../builderTypes";

export interface SavedLibraryInsertionCueView {
  label: string;
  message: string;
  helper: string;
}

export function buildSavedLibraryInsertionCueView(
  cue: SavedLibraryInsertionCue,
  tile: DashboardTile,
  now = Date.now()
): SavedLibraryInsertionCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  return {
    label: "Created from saved variable set",
    message: `${tile.title || tile.name} was created as a ${cue.objectLabel} from ${cue.sourceLabel}.`,
    helper: "This object is selected for inspector editing. Update the analysis settings below or refresh if needed."
  };
}
