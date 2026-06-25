import type React from "react";
import { canvasHeight, canvasWidth, historyLimit } from "../builderConstants";
import {
  buildPageFromTemplate,
  createCanvasElement,
  createElementsFromPageMaster,
  createTextBlockElement,
  duplicateElement,
  duplicatePage,
  reorderPage,
  duplicateTile,
  remainingPagesAfterDelete
} from "../builderDocumentCommands";
import { initialDashboard } from "../../document/documentSeeds";
import { clampZIndex, nextZIndex } from "../../document/documentModel";
import { buildMultiSelectionLayoutUpdates, type MultiSelectionLayoutAction } from "../components/multiSelectionModel";
import type { LayerItem, LeftPanelView, SettingsView } from "../builderTypes";
import type { MultiSelectedObject } from "../builderTypes";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardCanvasElementType,
  DashboardDraft,
  DashboardPage,
  DashboardTile,
  PageMasterPreset,
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
  pageMasters: PageMasterPreset[];
  pageThemes: PageThemePreset[];
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  selectedTileId: string | null;
  selectedElementId: string | null;
  multiSelectedObjects: MultiSelectedObject[];
  setActivePageId: (id: string) => void;
  setSelectedTileId: SetNullableId;
  setSelectedElementId: SetNullableId;
  setMultiSelectedObjects: React.Dispatch<React.SetStateAction<MultiSelectedObject[]>>;
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
  pageMasters,
  pageThemes,
  selectedTile,
  selectedElement,
  selectedTileId,
  selectedElementId,
  multiSelectedObjects,
  setActivePageId,
  setSelectedTileId,
  setSelectedElementId,
  setMultiSelectedObjects,
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
    setMultiSelectedObjects([]);
    setSelectedChartPartId("all");
    setSettingsView("chart");
  }

  function selectElement(elementId: string) {
    setSelectedElementId(elementId);
    setSelectedTileId(null);
    setMultiSelectedObjects([]);
    setSelectedChartPartId("all");
    setSettingsView("element");
  }

  function selectPage() {
    setSelectedTileId(null);
    setSelectedElementId(null);
    setMultiSelectedObjects([]);
    setSelectedChartPartId("all");
    setSettingsView("page");
  }

  function toggleMultiSelectedObject(item: MultiSelectedObject) {
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("layout");
    setMultiSelectedObjects((current) => {
      const exists = current.some((selected) => selected.id === item.id && selected.type === item.type);
      return exists ? current.filter((selected) => selected.id !== item.id || selected.type !== item.type) : [...current, item];
    });
  }

  function clearMultiSelection() {
    setMultiSelectedObjects([]);
  }

  function setMultiSelectedHidden(hidden: boolean) {
    if (multiSelectedObjects.length === 0) return;
    const selectedTileIds = new Set(multiSelectedObjects.filter((item) => item.type === "tile").map((item) => item.id));
    const selectedElementIds = new Set(multiSelectedObjects.filter((item) => item.type === "element").map((item) => item.id));

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (selectedTileIds.has(tile.id) ? { ...tile, hidden } : tile)),
              elements: page.elements.map((element) => (selectedElementIds.has(element.id) ? { ...element, hidden } : element))
            }
          : page
      )
    }));
  }

  function setMultiSelectedLocked(locked: boolean) {
    if (multiSelectedObjects.length === 0) return;
    const selectedTileIds = new Set(multiSelectedObjects.filter((item) => item.type === "tile").map((item) => item.id));
    const selectedElementIds = new Set(multiSelectedObjects.filter((item) => item.type === "element").map((item) => item.id));

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (selectedTileIds.has(tile.id) ? { ...tile, locked } : tile)),
              elements: page.elements.map((element) => (selectedElementIds.has(element.id) ? { ...element, locked } : element))
            }
          : page
      )
    }));
  }

  function alignMultiSelected(action: MultiSelectionLayoutAction) {
    if (multiSelectedObjects.length < 2) return;
    const selectedTileIds = new Set(multiSelectedObjects.filter((item) => item.type === "tile").map((item) => item.id));
    const selectedElementIds = new Set(multiSelectedObjects.filter((item) => item.type === "element").map((item) => item.id));
    const layoutUpdates = buildMultiSelectionLayoutUpdates(activePage, multiSelectedObjects, action);
    if (layoutUpdates.size === 0) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) =>
                selectedTileIds.has(tile.id)
                  ? { ...tile, layout: { ...tile.layout, ...layoutUpdates.get(`tile:${tile.id}`) } }
                  : tile
              ),
              elements: page.elements.map((element) =>
                selectedElementIds.has(element.id)
                  ? { ...element, layout: { ...element.layout, ...layoutUpdates.get(`element:${element.id}`) } }
                  : element
              )
            }
          : page
      )
    }));
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
    const selectedLayout = selectedTile?.layout ?? selectedElement?.layout;
    const element = createCanvasElement(
      type,
      activePage,
      selectedLayout ? { mode: "below-selection", referenceLayout: selectedLayout } : { mode: "default" }
    );

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

  function applyPageMasterLayout(pageMaster: PageMasterPreset) {
    const elements = createElementsFromPageMaster(pageMaster, activePage);
    if (elements.length === 0) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, ...elements] } : page))
    }));
    setSelectedTileId(null);
    setSelectedElementId(elements[0]?.id ?? null);
    setSelectedChartPartId("all");
    setSettingsView("element");
  }

  function renamePage(pageId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === pageId ? { ...page, title: nextTitle } : page))
    }));
    setActivePageId(pageId);
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("page");
  }

  function addPage(template?: PageTemplatePreset) {
    const page = buildPageFromTemplate({ template, pageCount: dashboard.pages.length, pageThemes, pageMasters });

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

  function duplicatePageById(pageId: string) {
    const sourcePage = sortedPages.find((page) => page.id === pageId);
    if (!sourcePage) return;

    const duplicate = duplicatePage(sourcePage, dashboard.pages.length);

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

  function deletePageById(pageId: string) {
    if (dashboard.pages.length <= 1) return;

    const pageToDelete = sortedPages.find((page) => page.id === pageId);
    if (!pageToDelete) return;

    const remainingPages = remainingPagesAfterDelete(sortedPages, pageToDelete);
    const deletedPageIndex = sortedPages.findIndex((page) => page.id === pageId);
    const fallbackPage = remainingPages[Math.max(0, Math.min(deletedPageIndex, remainingPages.length - 1))];

    setDashboard((current) => ({ ...current, status: "draft", pages: remainingPages }));
    if (activePage.id === pageId) {
      setActivePageId(fallbackPage.id);
      setSelectedTileId(null);
      setSelectedElementId(null);
      setSelectedChartPartId("all");
      setSettingsView("page");
    }
  }

  function movePage(pageId: string, direction: "up" | "down") {
    const currentIndex = sortedPages.findIndex((page) => page.id === pageId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= sortedPages.length) return;

    setDashboard((current) => {
      const nextPages = reorderPage(current.pages, pageId, direction);
      return {
        ...current,
        status: "draft",
        pages: nextPages
      };
    });
    setActivePageId(pageId);
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("page");
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
    setDashboard((current) => {
      const nextPublishCount = current.publishMetadata.publishCount + 1;
      return {
        ...current,
        status: "published",
        publishMetadata: {
          publishedAt: new Date().toISOString(),
          publishCount: nextPublishCount,
          versionLabel: `v${nextPublishCount}`
        }
      };
    });
    setViewerMode(true);
  }

  function unpublishDashboard() {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      publishMetadata: {
        ...current.publishMetadata,
        versionLabel: current.publishMetadata.publishCount > 0 ? `Draft after ${current.publishMetadata.versionLabel}` : "Draft"
      }
    }));
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
    toggleMultiSelectedObject,
    clearMultiSelection,
    setMultiSelectedHidden,
    setMultiSelectedLocked,
    alignMultiSelected,
    changeSelectedLayer,
    addCanvasElement,
    addTextBlockPreset,
    updateActivePage,
    renamePage,
    addPage,
    applyPageMasterLayout,
    duplicateActivePage,
    duplicatePageById,
    deleteActivePage,
    deletePageById,
    movePage,
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
