import type React from "react";
import { canvasHeight, canvasWidth, historyLimit } from "../builderConstants";
import {
  buildPageFromTemplate,
  createCanvasElement,
  createTextBlockElement,
  duplicateElement,
  duplicatePage,
  duplicateTile,
  remainingPagesAfterDelete
} from "../builderDocumentCommands";
import { initialDashboard } from "../../document/documentSeeds";
import { clampZIndex, nextZIndex } from "../../document/documentModel";
import type { LayerItem, LeftPanelView, SettingsView } from "../builderTypes";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardCanvasElementType,
  DashboardDraft,
  DashboardPage,
  DashboardTile,
  PageTemplatePreset,
  PageThemePreset,
  TextBlockPreset
} from "../../../../shared/types/dashboard";

type SetDashboardState = React.Dispatch<React.SetStateAction<DashboardDraft>>;
type SetDashboardList = React.Dispatch<React.SetStateAction<DashboardDraft[]>>;
type SetNullableId = React.Dispatch<React.SetStateAction<string | null>>;

type UseBuilderDocumentSessionCommandsArgs = {
  dashboard: DashboardDraft;
  setDashboardState: SetDashboardState;
  history: DashboardDraft[];
  setHistory: SetDashboardList;
  future: DashboardDraft[];
  setFuture: SetDashboardList;
  setSaveState: (value: string) => void;
  activePage: DashboardPage;
  sortedPages: DashboardPage[];
  pageThemes: PageThemePreset[];
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  selectedTileId: string | null;
  selectedElementId: string | null;
  setActivePageId: (id: string) => void;
  setSelectedTileId: SetNullableId;
  setSelectedElementId: SetNullableId;
  setSelectedChartPartId: (id: string) => void;
  setSettingsView: (view: SettingsView) => void;
  setLeftPanelView: (view: LeftPanelView) => void;
  setCanvasZoom: (value: number) => void;
  setViewerMode: (value: boolean) => void;
};

export function useBuilderDocumentSessionCommands({
  dashboard,
  setDashboardState,
  history,
  setHistory,
  future,
  setFuture,
  setSaveState,
  activePage,
  sortedPages,
  pageThemes,
  selectedTile,
  selectedElement,
  selectedTileId,
  selectedElementId,
  setActivePageId,
  setSelectedTileId,
  setSelectedElementId,
  setSelectedChartPartId,
  setSettingsView,
  setLeftPanelView,
  setCanvasZoom,
  setViewerMode
}: UseBuilderDocumentSessionCommandsArgs) {
  function setDashboard(updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory = true) {
    setDashboardState((current) => {
      const nextDashboard = typeof updater === "function" ? updater(current) : updater;

      if (trackHistory) {
        setHistory((items) => [...items.slice(-historyLimit + 1), current]);
        setFuture([]);
        setSaveState("Saving...");
      }

      return nextDashboard;
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;

    setFuture((items) => [dashboard, ...items]);
    setHistory((items) => items.slice(0, -1));
    setDashboard(previous, false);
  }

  function redo() {
    const nextDashboard = future[0];
    if (!nextDashboard) return;

    setHistory((items) => [...items, dashboard]);
    setFuture((items) => items.slice(1));
    setDashboard(nextDashboard, false);
  }

  function updateSelectedTile(updates: Partial<DashboardTile>) {
    if (!selectedTileId) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (tile.id === selectedTileId ? { ...tile, ...updates } : tile))
            }
          : page
      )
    }));
  }

  function updateTile(tileId: string, updates: Partial<DashboardTile>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (tile.id === tileId ? { ...tile, ...updates } : tile))
            }
          : page
      )
    }));
  }

  function updateTileLayout(tileId: string, layout: Partial<CanvasLayout>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (tile.id === tileId ? { ...tile, layout: { ...tile.layout, ...layout } } : tile))
            }
          : page
      )
    }));
  }

  function updateSelectedElement(updates: Partial<DashboardCanvasElement>) {
    if (!selectedElementId) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === selectedElementId ? { ...element, ...updates } : element))
            }
          : page
      )
    }));
  }

  function updateElement(elementId: string, updates: Partial<DashboardCanvasElement>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === elementId ? { ...element, ...updates } : element))
            }
          : page
      )
    }));
  }

  function updateElementLayout(elementId: string, layout: Partial<CanvasLayout>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === elementId ? { ...element, layout: { ...element.layout, ...layout } } : element))
            }
          : page
      )
    }));
  }

  function selectTile(tileId: string) {
    setSelectedTileId(tileId);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("chart");
  }

  function selectElement(elementId: string) {
    setSelectedElementId(elementId);
    setSelectedTileId(null);
    setSelectedChartPartId("all");
    setSettingsView("element");
  }

  function selectPage() {
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("page");
  }

  function selectLayer(item: LayerItem) {
    if (item.type === "tile") {
      selectTile(item.id);
    } else {
      selectElement(item.id);
    }

    setSelectedChartPartId("all");
  }

  function changeSelectedLayer(direction: "front" | "back" | "forward" | "backward") {
    const currentZ = selectedTile?.layout.zIndex ?? selectedElement?.layout.zIndex;
    if (!currentZ) return;

    const nextZ =
      direction === "front"
        ? nextZIndex(activePage)
        : direction === "back"
          ? 1
          : direction === "forward"
            ? currentZ + 1
            : clampZIndex(currentZ - 1);

    if (selectedTile) {
      updateTileLayout(selectedTile.id, { zIndex: nextZ });
    }

    if (selectedElement) {
      updateElementLayout(selectedElement.id, { zIndex: nextZ });
    }
  }

  function addCanvasElement(type: DashboardCanvasElementType) {
    const element = createCanvasElement(type, activePage);

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    selectElement(element.id);
  }

  function addTextBlockPreset(block: TextBlockPreset) {
    const element = createTextBlockElement(block, activePage);

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    selectElement(element.id);
    setSettingsView("element");
  }

  function updateActivePage(updates: Partial<DashboardPage>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, ...updates } : page))
    }));
  }

  function addPage(template?: PageTemplatePreset) {
    const page = buildPageFromTemplate({ template, pageCount: dashboard.pages.length, pageThemes });

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, page] }));
    setActivePageId(page.id);
    selectPage();
  }

  function duplicateActivePage() {
    const duplicate = duplicatePage(activePage, dashboard.pages.length);

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, duplicate] }));
    setActivePageId(duplicate.id);
    selectPage();
  }

  function deleteActivePage() {
    if (dashboard.pages.length <= 1) return;

    const remainingPages = remainingPagesAfterDelete(sortedPages, activePage);
    setDashboard((current) => ({ ...current, status: "draft", pages: remainingPages }));
    setActivePageId(remainingPages[0].id);
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
  }

  function deleteSelectedItem() {
    if (!selectedTile && !selectedElement) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: selectedTile ? page.tiles.filter((tile) => tile.id !== selectedTile.id) : page.tiles,
              elements: selectedElement ? page.elements.filter((element) => element.id !== selectedElement.id) : page.elements
            }
          : page
      )
    }));
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
  }

  function duplicateSelectedItem() {
    if (selectedTile) {
      const duplicate = duplicateTile(selectedTile, activePage);

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, duplicate] } : page))
      }));
      selectTile(duplicate.id);
      return;
    }

    if (selectedElement) {
      const duplicate = duplicateElement(selectedElement, activePage);

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, duplicate] } : page))
      }));
      selectElement(duplicate.id);
    }
  }

  function resetDashboard() {
    setDashboard(initialDashboard);
    setActivePageId("page_overview");
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("page");
    setLeftPanelView("pages");
  }

  function chooseLayer(item: LayerItem) {
    selectLayer(item);
    setLeftPanelView("pages");
    setSettingsView(item.type === "tile" ? "chart" : "element");
  }

  function updateCanvasZoom(value: number) {
    setCanvasZoom(Math.min(160, Math.max(35, value)));
  }

  function publishDashboard() {
    setDashboard((current) => ({ ...current, status: "published" }));
    setViewerMode(true);
  }

  function unpublishDashboard() {
    setDashboard((current) => ({ ...current, status: "draft" }));
    setViewerMode(false);
  }

  function openPublishedReport() {
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setViewerMode(true);
  }

  function closePublishedReport() {
    setViewerMode(false);
  }

  return {
    setDashboard,
    undo,
    redo,
    updateSelectedTile,
    updateTile,
    updateTileLayout,
    updateSelectedElement,
    updateElement,
    updateElementLayout,
    selectLayer,
    selectTile,
    selectElement,
    selectPage,
    changeSelectedLayer,
    addCanvasElement,
    addTextBlockPreset,
    updateActivePage,
    addPage,
    duplicateActivePage,
    deleteActivePage,
    deleteSelectedItem,
    duplicateSelectedItem,
    resetDashboard,
    chooseLayer,
    updateCanvasZoom,
    publishDashboard,
    unpublishDashboard,
    openPublishedReport,
    closePublishedReport
  };
}
