import { canvasHeight, canvasWidth, effectPresetValues, type EffectPreset } from "../builderConstants";
import { getBarStyle } from "../components/CanvasRenderers";
import type { BuilderInspectorProps } from "../components/BuilderInspector";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardDraft,
  DashboardPage,
  DashboardTile,
  DesignColorPalette,
  PageThemePreset,
  TextStylePreset,
  TileAppearance
} from "../../../../shared/types/dashboard";

type SetDashboard = (updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory?: boolean) => void;

type UseBuilderDesignCommandsArgs = {
  activePage: DashboardPage;
  selectedTile: DashboardTile | null;
  selectedTileId: string | null;
  selectedElement: DashboardCanvasElement | null;
  selectedTextElement: DashboardCanvasElement | null;
  selectedChartPart: { id: string; label: string } | null;
  setDashboard: SetDashboard;
  updateActivePage: (updates: Partial<DashboardPage>) => void;
  updateSelectedTile: (updates: Partial<DashboardTile>) => void;
  updateSelectedElement: (updates: Partial<DashboardCanvasElement>) => void;
  updateTileLayout: (tileId: string, layout: Partial<CanvasLayout>) => void;
  updateElementLayout: (elementId: string, layout: Partial<CanvasLayout>) => void;
};

export function useBuilderDesignCommands({
  activePage,
  selectedTile,
  selectedTileId,
  selectedElement,
  selectedTextElement,
  selectedChartPart,
  setDashboard,
  updateActivePage,
  updateSelectedTile,
  updateSelectedElement,
  updateTileLayout,
  updateElementLayout
}: UseBuilderDesignCommandsArgs) {
  function applyPaletteToTile(palette: DesignColorPalette, scope: "selected" | "all" = "selected") {
    const updateAppearance = (appearance: TileAppearance): TileAppearance => ({
      ...appearance,
      primaryColor: palette.colors[0],
      palette: palette.colors,
      labelColor: palette.colors[0],
      barFillMode: "solid",
      barGradientStops: [],
      barStyles: {},
      gridColor: appearance.gridColor,
      xAxisTextColor: appearance.xAxisTextColor,
      yAxisTextColor: appearance.yAxisTextColor
    });

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => {
                if (scope === "selected" && tile.id !== selectedTileId) {
                  return tile;
                }
                return {
                  ...tile,
                  appearance: updateAppearance(tile.appearance)
                };
              })
            }
          : page
      )
    }));
  }

  function applyTextStylePresetToSelection(preset: TextStylePreset) {
    if (!selectedTextElement) return;
    updateSelectedElement({
      style: {
        ...selectedTextElement.style,
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        textAlign: preset.textAlign,
        lineHeight: preset.lineHeight,
        textColor: preset.textColor
      }
    });
  }

  function applyPageTheme(theme: PageThemePreset) {
    updateActivePage({
      backgroundMode: theme.backgroundMode,
      background: theme.background,
      backgroundImage: theme.backgroundImage,
      backgroundImageFit: theme.backgroundImageFit,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo,
      gradientType: theme.gradientType,
      gradientAngle: theme.gradientAngle,
      gradientStops: theme.gradientStops,
      showCanvasGrid: theme.showCanvasGrid,
      provenance: {
        ...activePage.provenance,
        themeId: theme.id,
        themeLabel: theme.label,
        status: "custom"
      }
    });
  }

  function updateSelectedAppearance(updates: Partial<TileAppearance>) {
    if (!selectedTile) return;
    updateSelectedTile({ appearance: { ...selectedTile.appearance, ...updates } });
  }

  function applySelectedElementEffectPreset(preset: EffectPreset) {
    if (!selectedElement) return;
    updateSelectedElement({
      style: {
        ...selectedElement.style,
        shadowPreset: preset,
        shadow: true,
        ...effectPresetValues(preset),
        glow: preset === "glow" ? true : selectedElement.style.glow
      }
    });
  }

  function applySelectedTileEffectPreset(preset: EffectPreset) {
    if (!selectedTile) return;
    updateSelectedAppearance({
      shadowPreset: preset,
      shadow: true,
      ...effectPresetValues(preset),
      glow: preset === "glow" ? true : selectedTile.appearance.glow
    });
  }

  function updateSelectedBarStyle(updates: Partial<TileAppearance["barStyles"][string]>) {
    if (!selectedTile || !selectedChartPart) return;

    const fallback = getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor);
    updateSelectedAppearance({
      barStyles: {
        ...selectedTile.appearance.barStyles,
        [selectedChartPart.id]: {
          ...fallback,
          ...updates
        }
      }
    });
  }

  function clearBarColorOverrides(nextShared?: Partial<TileAppearance>) {
    if (!selectedTile) return;

    const nextBarStyles = Object.fromEntries(
      Object.entries(selectedTile.appearance.barStyles).map(([id, style]) => [
        id,
        {
          radius: style.radius ?? selectedTile.appearance.barRadius
        }
      ])
    ) as TileAppearance["barStyles"];

    updateSelectedAppearance({
      ...nextShared,
      barStyles: nextBarStyles
    });
  }

  function applyPalettePresetToBars(paletteColors: string[]) {
    if (!selectedTile) return;

    const nextBarStyles = selectedTile.result.table.reduce<TileAppearance["barStyles"]>((styles, row, index) => {
      styles[row.optionId] = {
        color: paletteColors[index % paletteColors.length] ?? paletteColors[0],
        fillMode: "solid",
        gradientTo: selectedTile.appearance.barGradientTo,
        gradientType: selectedTile.appearance.barGradientType,
        gradientAngle: selectedTile.appearance.barGradientAngle,
        gradientStops: selectedTile.appearance.barGradientStops,
        radius: selectedTile.appearance.barStyles[row.optionId]?.radius ?? selectedTile.appearance.barRadius
      };
      return styles;
    }, {});

    updateSelectedAppearance({
      palette: paletteColors,
      primaryColor: paletteColors[0],
      barFillMode: "solid",
      barStyles: nextBarStyles
    });
  }

  function applyPaletteColorToSelectedBar(color: string) {
    if (!selectedTile || !selectedChartPart) return;

    updateSelectedBarStyle({
      color,
      fillMode: "solid",
      gradientTo: selectedTile.appearance.barGradientTo,
      gradientType: selectedTile.appearance.barGradientType,
      gradientAngle: selectedTile.appearance.barGradientAngle,
      gradientStops: selectedTile.appearance.barGradientStops
    });
  }

  function applySolidColorToBars(color: string) {
    if (!selectedTile) return;

    const nextBarStyles = selectedTile.result.table.reduce<TileAppearance["barStyles"]>((styles, row) => {
      styles[row.optionId] = {
        color,
        fillMode: "solid",
        gradientTo: selectedTile.appearance.barGradientTo,
        gradientType: selectedTile.appearance.barGradientType,
        gradientAngle: selectedTile.appearance.barGradientAngle,
        gradientStops: selectedTile.appearance.barGradientStops,
        radius: selectedTile.appearance.barStyles[row.optionId]?.radius ?? selectedTile.appearance.barRadius
      };
      return styles;
    }, {});

    updateSelectedAppearance({
      primaryColor: color,
      palette: [color, ...selectedTile.appearance.palette.slice(1)],
      barFillMode: "solid",
      barStyles: nextBarStyles
    });
  }

  function updateSelectedAxisLabel(value: string) {
    if (!selectedTile || !selectedChartPart) return;

    updateSelectedAppearance({
      axisLabelOverrides: {
        ...selectedTile.appearance.axisLabelOverrides,
        [selectedChartPart.id]: value
      }
    });
  }

  function updateSelectedLayout(layout: Partial<CanvasLayout>) {
    if (selectedTile) {
      updateTileLayout(selectedTile.id, layout);
    }

    if (selectedElement) {
      updateElementLayout(selectedElement.id, layout);
    }
  }

  function alignSelected(direction: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    const layout = selectedTile?.layout ?? selectedElement?.layout;
    if (!layout) return;

    if (direction === "left") updateSelectedLayout({ x: 0 });
    if (direction === "center") updateSelectedLayout({ x: Math.round((canvasWidth - layout.width) / 2) });
    if (direction === "right") updateSelectedLayout({ x: canvasWidth - layout.width });
    if (direction === "top") updateSelectedLayout({ y: 0 });
    if (direction === "middle") updateSelectedLayout({ y: Math.round((canvasHeight - layout.height) / 2) });
    if (direction === "bottom") updateSelectedLayout({ y: canvasHeight - layout.height });
  }

  function applyLayoutPreset(preset: "hero" | "leftColumn" | "rightColumn" | "footer") {
    const layout = selectedTile?.layout ?? selectedElement?.layout;
    if (!layout) return;

    const nextLayout: Partial<CanvasLayout> =
      preset === "hero"
        ? { x: 80, y: 72, width: Math.min(720, canvasWidth - 160) }
        : preset === "leftColumn"
          ? { x: 72, y: layout.y, width: Math.min(460, canvasWidth / 2 - 96) }
          : preset === "rightColumn"
            ? { x: Math.round(canvasWidth / 2 + 24), y: layout.y, width: Math.min(460, canvasWidth / 2 - 96) }
            : { x: 72, y: canvasHeight - Math.min(layout.height, 120) - 48, width: Math.min(460, canvasWidth - 144), height: Math.min(layout.height, 120) };

    updateSelectedLayout(nextLayout);
  }

  return {
    applyPaletteToTile,
    applyTextStylePresetToSelection,
    applyPageTheme,
    updateSelectedAppearance,
    applySelectedElementEffectPreset,
    applySelectedTileEffectPreset,
    updateSelectedBarStyle,
    clearBarColorOverrides,
    applyPalettePresetToBars,
    applyPaletteColorToSelectedBar,
    applySolidColorToBars,
    updateSelectedAxisLabel,
    updateSelectedLayout,
    alignSelected,
    applyLayoutPreset
  } satisfies Pick<
    BuilderInspectorProps,
    | "applyTextStylePresetToSelection"
    | "applyPalettePresetToBars"
    | "applyPaletteColorToSelectedBar"
    | "applySolidColorToBars"
    | "clearBarColorOverrides"
    | "updateSelectedAppearance"
    | "applySelectedElementEffectPreset"
    | "applySelectedTileEffectPreset"
    | "updateSelectedBarStyle"
    | "updateSelectedAxisLabel"
    | "updateSelectedLayout"
    | "alignSelected"
    | "applyLayoutPreset"
  > & {
    applyPaletteToTile: (palette: DesignColorPalette, scope?: "selected" | "all") => void;
    applyPageTheme: (theme: PageThemePreset) => void;
  };
}
