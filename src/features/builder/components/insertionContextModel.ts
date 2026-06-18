import type { DashboardPage } from "../../../../shared/types/dashboard";
import type { LayerItem } from "../builderTypes";

export interface InsertionContextView {
  targetPageLabel: string;
  selectedObjectLabel: string;
  placementLabel: string;
  helperText: string;
}

export function buildInsertionContextView(args: {
  activePage: DashboardPage;
  layerItems: LayerItem[];
  selectedTileId: string | null;
  selectedElementId: string | null;
}): InsertionContextView {
  const { activePage, layerItems, selectedTileId, selectedElementId } = args;
  const selectedLayer = layerItems.find((item) => item.id === selectedTileId || item.id === selectedElementId);

  if (!selectedLayer) {
    return {
      targetPageLabel: activePage.title,
      selectedObjectLabel: "No object selected",
      placementLabel: "Default canvas position",
      helperText: "New design objects are added to the current page at the default canvas position."
    };
  }

  const kindLabel = selectedLayer.type === "tile" ? "tile" : "element";

  return {
    targetPageLabel: activePage.title,
    selectedObjectLabel: `${selectedLayer.name} (${kindLabel})`,
    placementLabel: "Below selected object",
    helperText: "New design objects are added to the current page below the selected object and selected for editing."
  };
}
