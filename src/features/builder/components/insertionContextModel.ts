import type { DashboardPage } from "../../../../shared/types/dashboard";
import type { LayerItem } from "../builderTypes";

export interface InsertionContextView {
  targetPageLabel: string;
  selectedObjectLabel: string;
  placementLabel: string;
  helperText: string;
  dropHelperText?: string;
}

export function buildInsertionContextView(args: {
  activePage: DashboardPage;
  layerItems: LayerItem[];
  selectedTileId: string | null;
  selectedElementId: string | null;
  objectKind?: "design" | "analytical";
}): InsertionContextView {
  const { activePage, layerItems, selectedTileId, selectedElementId, objectKind = "design" } = args;
  const selectedLayer = layerItems.find((item) => item.id === selectedTileId || item.id === selectedElementId);
  const objectLabel = objectKind === "analytical" ? "analytical objects" : "design objects";
  const defaultPlacementLabel = objectKind === "analytical" ? "Default analytical position" : "Default canvas position";

  if (!selectedLayer) {
    return {
      targetPageLabel: activePage.title,
      selectedObjectLabel: "No object selected",
      placementLabel: defaultPlacementLabel,
      helperText: `New ${objectLabel} are added to the current page at the ${defaultPlacementLabel.toLowerCase()}.`,
      dropHelperText: objectKind === "analytical" ? "Dragging a source onto the canvas places it at the drop position." : undefined
    };
  }

  const kindLabel = selectedLayer.type === "tile" ? "tile" : "element";

  return {
    targetPageLabel: activePage.title,
    selectedObjectLabel: `${selectedLayer.name} (${kindLabel})`,
    placementLabel: "Below selected object",
    helperText: `New ${objectLabel} are added to the current page below the selected object and selected for editing.`,
    dropHelperText: objectKind === "analytical" ? "Dragging a source onto the canvas still places it at the drop position." : undefined
  };
}
