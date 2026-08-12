import { useState, type CSSProperties, type ReactNode } from "react";
import { BuilderPanel, type OutcomeWorkspaceMode } from "./BuilderChrome";
import { LayoutInspector, ObjectInspector, PageInspector } from "./InspectorSections";
import { TileAnalysisQuerySection, TileAnalysisResultSection } from "./InspectorTileAnalysisSections";
import { buildMultiSelectionSummary } from "./multiSelectionModel";
import type { MultiSelectionLayoutAction } from "./multiSelectionModel";
import { buildStoryGuidanceView } from "./storyGuidanceModel";
import { BarColorField, ColorField, PageBackgroundField, rangeFill } from "../../design-system/DesignControls";
import {
  axisRotationPresets,
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  defaultGridSize,
  effectPresets,
  filterDimensions,
  fontFamilies,
  waveComparisonChartTypes,
  type EffectPreset
} from "../builderConstants";
import { effectShadow, gradientCss } from "../builderHelpers";
import { comparisonSummaryLabel, getAxisLabel, getBarStyle, getPaletteId, resultSourceLabel, tileSourceKindLabel } from "./CanvasRenderers";
import { getChartTypeLabel, getQuestionLabel } from "../../analytics/analyticsDisplay";
import { buildExecutedColumnComparisonPresentation } from "./analysisSignificancePresentationModel";
import type { BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type {
  CanvasLayout,
  DashboardCanvasElement,
  DashboardPage,
  DashboardTile,
  DesignColorPalette,
  ImportedDatasetRecord,
  PageMasterPreset,
  PageThemePreset,
  SavedBanner,
  SavedDerivedDefinition,
  SavedFilterSet,
  SavedSegmentProfile,
  SavedVariableSet,
  SavedWeightProfile,
  TextStylePreset,
  TileAppearance
} from "../../../../shared/types/dashboard";
import type { AnalysisLibraryView, DerivedDefinitionRecreationCue, DerivedOutputCreationCue, DerivedOutputLibraryActionCue, DerivedOutputRecreationCue, DesignModal, MultiSelectedObject, RelatedObjectNavigationCue, ReportTreeSelectionCue, SavedLibraryInsertionCue, SavedSettingOriginCue, SettingsView } from "../builderTypes";
import type { DerivedOutputConfig, DerivedOutputKind } from "./derivedOutputModel";

type AssistantRailIcon = "style" | "page" | "layout" | "effects" | "options" | "data" | "insight";

function AssistantIcon({ icon }: { icon: AssistantRailIcon }) {
  const paths: Record<AssistantRailIcon, ReactNode> = {
    style: <><path d="M5 19c3.8 1.2 6.5-1.1 6.5-4.1 0-1.4-1-2.6-2.4-2.6H7.5A3.5 3.5 0 0 1 4 8.8C4 5.9 6.5 4 9.8 4H12c4.4 0 8 3.3 8 7.5S16.6 19 12.2 19H11" /><circle cx="9" cy="7.5" r="1" /><circle cx="13" cy="7.4" r="1" /><circle cx="16" cy="10.2" r="1" /></>,
    page: <><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>,
    layout: <><rect x="4" y="5" width="7" height="6" rx="1.5" /><rect x="13" y="5" width="7" height="6" rx="1.5" /><rect x="4" y="13" width="16" height="6" rx="1.5" /></>,
    effects: <><path d="M12 4v3" /><path d="M12 17v3" /><path d="M4 12h3" /><path d="M17 12h3" /><path d="m6.6 6.6 2.1 2.1" /><path d="m15.3 15.3 2.1 2.1" /><path d="m17.4 6.6-2.1 2.1" /><path d="m8.7 15.3-2.1 2.1" /><circle cx="12" cy="12" r="3.2" /></>,
    options: <><path d="M6 5v14" /><path d="M18 5v14" /><path d="M6 9h12" /><path d="M6 15h12" /><circle cx="10" cy="9" r="1.8" /><circle cx="14" cy="15" r="1.8" /></>,
    data: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    insight: <><path d="M12 3.5 13.7 8l4.8 1.6-4.8 1.7L12 16l-1.7-4.7-4.8-1.7L10.3 8z" /><path d="M18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>
  };

  return (
    <svg className="assistant-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

function AssistantFolder({
  title,
  helper,
  defaultOpen = false,
  children
}: {
  title: string;
  helper: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="assistant-folder" open={defaultOpen}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{helper}</small>
        </span>
      </summary>
      <div className="assistant-folder-body">
        {children}
      </div>
    </details>
  );
}

export type BuilderInspectorProps = {
  outcomeMode: OutcomeWorkspaceMode | null;
  outcomeLabel: string;
  outcomeHelper: string;
  settingsView: SettingsView;
  setSettingsView: (view: SettingsView) => void;
  activePage: DashboardPage;
  dashboardPageCount: number;
  updateActivePage: (updates: Partial<DashboardPage>) => void;
  duplicateActivePage: () => void;
  deleteActivePage: () => void;
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  multiSelectedObjects: MultiSelectedObject[];
  setMultiSelectedHidden: (hidden: boolean) => void;
  setMultiSelectedLocked: (locked: boolean) => void;
  alignMultiSelected: (action: MultiSelectionLayoutAction) => void;
  clearMultiSelection: () => void;
  savedBanners: SavedBanner[];
  savedFilters: SavedFilterSet[];
  savedVariableSets: SavedVariableSet[];
  savedWeights: SavedWeightProfile[];
  savedSegmentProfiles: SavedSegmentProfile[];
  savedDerivedDefinitions: SavedDerivedDefinition[];
  importedDatasets: ImportedDatasetRecord[];
  selectedTileQuestion: typeof defaultDataset.questions[number] | null;
  selectedTileFilterDimension?: typeof filterDimensions[number];
  selectedChartPart: { id: string; label: string } | null;
  selectedChartPartId: string;
  setSelectedChartPartId: (id: string) => void;
  chartStyleTargets: Array<{ id: string; label: string }>;
  textStylePresets: TextStylePreset[];
  designPalettes: DesignColorPalette[];
  pageMasters: PageMasterPreset[];
  pageThemes: PageThemePreset[];
  applyPageMasterLayout: (pageMaster: PageMasterPreset) => void;
  setDesignModal: (modal: DesignModal) => void;
  changeSelectedLayer: (direction: "front" | "back" | "forward" | "backward") => void;
  alignSelected: (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  applyLayoutPreset: (preset: "hero" | "leftColumn" | "rightColumn" | "footer") => void;
  updateSelectedLayout: (layout: Partial<CanvasLayout>) => void;
  updateSelectedElement: (updates: Partial<DashboardCanvasElement>) => void;
  updateSelectedTile: (updates: Partial<DashboardTile>) => void;
  selectTile: (tileId: string) => void;
  updateSelectedAppearance: (updates: Partial<TileAppearance>) => void;
  updateSelectedBarStyle: (updates: Partial<TileAppearance["barStyles"][string]>) => void;
  updateSelectedAxisLabel: (value: string) => void;
  applyTextStylePresetToSelection: (preset: TextStylePreset) => void;
  applyPageTheme: (theme: PageThemePreset) => void;
  applyPalettePresetToBars: (colors: string[]) => void;
  applyPaletteColorToSelectedBar: (color: string) => void;
  applySolidColorToBars: (color: string) => void;
  clearBarColorOverrides: (nextShared?: Partial<TileAppearance>) => void;
  applySelectedElementEffectPreset: (preset: EffectPreset) => void;
  applySelectedTileEffectPreset: (preset: EffectPreset) => void;
  tileWithVisualization: (tile: DashboardTile, nextVisualization: ChartType) => Partial<DashboardTile>;
  duplicateTileAsVisualization: (tile: DashboardTile, nextVisualization: ChartType) => void;
  duplicateDerivedOutputTile: (tile: DashboardTile) => string | null;
  createDerivedOutputTile: (tile: DashboardTile, kind: DerivedOutputKind, options?: { config?: DerivedOutputConfig }) => string | null;
  recreateDerivedOutputTile: (tile: DashboardTile) => boolean;
  saveDerivedDefinition: (definition: SavedDerivedDefinition) => void;
  rerunTileAnalysis: (tile: DashboardTile, nextQuery: import("../../../../shared/types/analytics").AnalyticsQueryRequest) => Promise<boolean>;
  saveSelectedTileVariableSet: () => void;
  saveSelectedTileAnalyticalTemplate: () => void;
  saveSelectedTileBanner: () => void;
  saveSelectedTileFilter: () => void;
  saveSelectedTileWeight: () => void;
  onViewSavedSettingInLibrary: (view: AnalysisLibraryView, handoff?: { action?: "derivedDefinitionSaved"; itemId?: string }) => void;
  savedSettingOriginCue: SavedSettingOriginCue;
  recordSavedSettingOriginCue: (kind: "banner" | "filter" | "weight", label: string, tileId: string) => void;
  completeSavedSettingOriginCue: (tileId: string) => void;
  relatedObjectNavigationCue: RelatedObjectNavigationCue;
  recordRelatedObjectNavigationCue: (cue: Omit<NonNullable<RelatedObjectNavigationCue>, "createdAt">) => void;
  reportTreeSelectionCue: ReportTreeSelectionCue;
  savedLibraryInsertionCue: SavedLibraryInsertionCue;
  derivedOutputCreationCue: DerivedOutputCreationCue;
  derivedOutputRecreationCue: DerivedOutputRecreationCue;
  derivedDefinitionRecreationCue: DerivedDefinitionRecreationCue;
  derivedOutputLibraryActionCue: DerivedOutputLibraryActionCue;
  deleteSelectedItem: () => void;
  isLoading: boolean;
  comparisonDatasets: DatasetId[];
};

export function BuilderInspector(props: BuilderInspectorProps) {
  const {
  outcomeMode,
  outcomeLabel,
  outcomeHelper,
  settingsView,
  setSettingsView,
  activePage,
  dashboardPageCount,
  updateActivePage,
  duplicateActivePage,
  deleteActivePage,
  selectedTile,
  selectedElement,
  multiSelectedObjects,
  setMultiSelectedHidden,
  setMultiSelectedLocked,
  alignMultiSelected,
  clearMultiSelection,
  selectedTileQuestion,
  selectedTileFilterDimension,
  selectedChartPart,
  selectedChartPartId,
  setSelectedChartPartId,
  chartStyleTargets,
  textStylePresets,
  designPalettes,
  pageThemes,
  setDesignModal,
  changeSelectedLayer,
  alignSelected,
  applyLayoutPreset,
  updateSelectedLayout,
  updateSelectedElement,
  updateSelectedTile,
  updateSelectedAppearance,
  updateSelectedBarStyle,
  updateSelectedAxisLabel,
  applyTextStylePresetToSelection,
  applyPageTheme,
  applyPalettePresetToBars,
  applyPaletteColorToSelectedBar,
  applySolidColorToBars,
  clearBarColorOverrides,
  applySelectedElementEffectPreset,
  applySelectedTileEffectPreset,
  tileWithVisualization,
  duplicateTileAsVisualization,
  rerunTileAnalysis,
  saveSelectedTileVariableSet,
  saveSelectedTileBanner,
  saveSelectedTileFilter,
  saveSelectedTileWeight,
  onViewSavedSettingInLibrary,
  deleteSelectedItem,
  isLoading,
  comparisonDatasets
  } = props;
  const [inspectorSurface, setInspectorSurface] = useState<"style" | "data" | "insight">("style");
  const multiSelectionSummary = buildMultiSelectionSummary(activePage, multiSelectedObjects);
  const inspectorFocus = multiSelectionSummary.count
    ? {
        label: "Multi-selection",
        title: `${multiSelectionSummary.count} objects selected`,
        helper: `${multiSelectionSummary.tiles.length} tiles and ${multiSelectionSummary.elements.length} elements on ${activePage.title}.`
      }
    : selectedTile
      ? {
          label: "Selected tile",
          title: selectedTile.title || selectedTile.name,
          helper: "Analysis, chart style, layout, and reusable analytical workflows."
        }
      : selectedElement
        ? {
            label: "Selected element",
            title: selectedElement.name,
            helper: "Element styling, layout, layering, and canvas placement."
          }
        : {
            label: "Page focus",
            title: activePage.title,
            helper: "Page design, grid, templates, master provenance, and canvas defaults."
          };
  const insightNotes = selectedTile?.result.notes ?? [];
  const insightWarnings = selectedTile?.result.warnings ?? [];
  const storyGuidance = buildStoryGuidanceView(activePage, selectedTile, selectedElement, dashboardPageCount);
  const dataContext = selectedTile
    ? {
        source: resultSourceLabel(selectedTile.result),
        banner: comparisonSummaryLabel(selectedTile.query),
        chart: getChartTypeLabel(selectedTile.visualization),
        rows: selectedTile.result.table.length,
        columns: selectedTile.result.columns.length
      }
    : null;
  const leadColumn = selectedTile?.result.columns[0] ?? null;
  const leadRow = selectedTile?.result.table[0] ?? null;
  const leadValue = leadColumn && leadRow ? leadRow.values[leadColumn.id] : undefined;
  const leadValueLabel =
    typeof leadValue === "number"
      ? selectedTile?.result.metric.valueFormat === "percent"
        ? `${Math.round(leadValue)}%`
        : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(leadValue)
      : null;
  const executionReport = selectedTile?.result.statistics.significanceExecutionReport ?? null;
  const executionSummary =
    executionReport?.status === "executed"
      ? `${executionReport.method.replace("_", " ")} ran`
      : selectedTile?.result.statistics.significance.status === "eligible"
        ? "Eligible, not tested"
        : selectedTile?.result.statistics.significance.status === "unsupported"
          ? "Unsupported significance"
          : selectedTile?.result.statistics.significance.hasPlaceholders
            ? "Placeholder context"
            : "No test run";
  const storyRoleLabel = selectedTile
    ? selectedTile.result.columns.length > 1 || (selectedTile.query.comparisonMode ?? "none") !== "none"
      ? "Comparison story"
      : selectedTile.visualization === "table"
        ? "Evidence table"
        : "Lead evidence"
    : selectedElement
      ? selectedElement.type === "text"
        ? "Narrative object"
        : "Visual object"
      : "Page story";
  const groundedTakeaway = selectedTile
    ? leadValueLabel && leadRow
      ? `${leadRow.label} is the lead visible result at ${leadValueLabel}. Use the surrounding section to explain why that signal matters and what action it implies.`
      : `This ${getChartTypeLabel(selectedTile.visualization).toLowerCase()} frames ${resultSourceLabel(selectedTile.result)}. Pair it with one clear interpretation and a short context note.`
    : selectedElement
      ? "Use this object to support the page narrative. Pair decorative or text elements with nearby analytical evidence when possible."
      : "Start with a section pattern, then add one analytical object and one interpretation block to keep the page story focused.";
  const assistantNextStep = selectedTile
    ? selectedTile.result.columns.length > 1 || (selectedTile.query.comparisonMode ?? "none") !== "none"
      ? {
          label: "Explain the comparison",
          helper: "Use the Insight tab to frame which segment, banner, or wave difference matters most."
        }
      : {
          label: selectedTile.visualization === "table" ? "Design from the numbers" : "Pair chart with a takeaway",
          helper: selectedTile.visualization === "table"
            ? "Start with the table for plain reading, then duplicate as a chart when the story is clear."
            : "Add an insight callout or KPI strip near this chart to make the section easier to scan."
        }
    : selectedElement
      ? {
          label: "Connect this object to evidence",
          helper: "Select or add a chart nearby so the visual block supports a measured insight."
        }
      : {
          label: "Start with a story section",
          helper: "Use the Brand panel starters for KPI strips, insight callouts, chart commentary, or opportunity cards."
        };
  const assistantRailItems: Array<{
    id: "style" | "page" | "layout" | "effects" | "options" | "data" | "insight";
    label: string;
    icon: AssistantRailIcon;
    disabled?: boolean;
    active: boolean;
    helper: string;
  }> = [
    {
      id: "style",
      label: "Style",
      icon: "style",
      active: inspectorSurface === "style" && (settingsView === "home" || settingsView === "chart" || settingsView === "element" || settingsView === "container"),
      helper: selectedTile || selectedElement ? "Edit fill, color, type, and visible marks." : "Show the main style assistant."
    },
    {
      id: "page",
      label: "Page",
      icon: "page",
      active: inspectorSurface === "style" && settingsView === "page",
      helper: "Edit page theme, background, grid, and slide setup."
    },
    {
      id: "effects",
      label: "Effects",
      icon: "effects",
      disabled: !selectedTile && !selectedElement,
      active: inspectorSurface === "style" && settingsView === "effects",
      helper: "Edit shadow, glow, transparency, and soft edges."
    },
    {
      id: "options",
      label: "Options",
      icon: "options",
      disabled: !selectedTile && !selectedElement,
      active: inspectorSurface === "style" && (settingsView === "options" || settingsView === "layout"),
      helper: selectedTile ? "Edit series, gap width, size, and position." : "Edit size, position, and text box options."
    },
    {
      id: "data",
      label: "Data",
      icon: "data",
      active: inspectorSurface === "data",
      helper: "Review the selected analysis source, query, and result."
    },
    {
      id: "insight",
      label: "Insight",
      icon: "insight",
      active: inspectorSurface === "insight",
      helper: "Review story guidance and evidence framing."
    }
  ];
  function activateAssistantRailItem(itemId: typeof assistantRailItems[number]["id"]) {
    if (itemId === "data" || itemId === "insight") {
      setInspectorSurface(itemId);
      return;
    }
    setInspectorSurface("style");
    if (itemId === "style") setSettingsView(selectedElement ? "element" : selectedTile ? "chart" : "home");
    if (itemId === "page") setSettingsView("page");
    if (itemId === "layout") setSettingsView("layout");
    if (itemId === "effects") setSettingsView("effects");
    if (itemId === "options") setSettingsView("options");
  }
  const chartTypeOptions = selectedTile
    ? defaultDataset.chartTypes
        .filter((chartTypeOption) => chartTypeOption.supportedMetrics.includes(selectedTile.query.metric))
        .filter((chartTypeOption) => !chartTypeOption.minSeries || selectedTile.result.columns.length >= chartTypeOption.minSeries)
        .map((chartTypeOption) => chartTypeOption.id)
    : [];
  const activeDesignPaletteId = selectedTile
    ? (designPalettes.find((palette) => palette.colors.join(",") === selectedTile.appearance.palette.join(","))?.id ?? getPaletteId(selectedTile.appearance.palette))
    : "custom";
  const executedSignificanceView = selectedTile ? buildExecutedColumnComparisonPresentation(selectedTile.result) : null;
  const hasRenderableSignificanceMarkers = Boolean(
    selectedTile
    && (
      selectedTile.result.annotations.length > 0
      || (selectedTile.visualization === "table" && executedSignificanceView?.available && executedSignificanceView.significantComparisons > 0)
    )
  );
  const chartBasicsCard = selectedTile ? (
    <div className="assistant-style-card assistant-style-card--flush">
      <AssistantFolder title="Chart basics" helper={`${getChartTypeLabel(selectedTile.visualization)} · ${selectedTile.result.metric.label}`} defaultOpen>
        <label>
          Chart type
          <select
            value={selectedTile.visualization}
            onChange={(event) => updateSelectedTile(tileWithVisualization(selectedTile, event.target.value as ChartType))}
          >
            {chartTypeOptions.map((type) => (
              <option key={type} value={type}>{getChartTypeLabel(type)}</option>
            ))}
          </select>
        </label>
        <label className="toggle-row">
          <span>
            Show significance markers
            {!hasRenderableSignificanceMarkers && <small>No markers available for this tile yet.</small>}
          </span>
          <input
            type="checkbox"
            checked={selectedTile.appearance.showAnnotations && hasRenderableSignificanceMarkers}
            disabled={!hasRenderableSignificanceMarkers}
            onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })}
          />
        </label>
        <label className="toggle-row">
          <span>Show sample size</span>
          <input
            type="checkbox"
            checked={selectedTile.appearance.showBases}
            onChange={(event) => updateSelectedAppearance({ showBases: event.target.checked })}
          />
        </label>
      </AssistantFolder>
    </div>
  ) : null;

  const selectedObjectHeader = selectedTile || selectedElement || multiSelectionSummary.count ? (
    <div className="assistant-object-header">
      <span>{inspectorFocus.label}</span>
      <strong>{inspectorFocus.title}</strong>
      <small>{inspectorFocus.helper}</small>
    </div>
  ) : null;

  const styleQuickCard = selectedTile ? (
    <div className="assistant-style-card assistant-style-card--flush">
      <AssistantFolder title="Theme and type" helper={`${designPalettes.find((palette) => palette.id === activeDesignPaletteId)?.label ?? "Custom"} palette`}>
        <span className="assistant-field-label">Color theme</span>
        <div className="assistant-palette-row" aria-label="Color theme">
          {designPalettes.slice(0, 5).map((palette) => (
            <button
              type="button"
              key={palette.id}
              className={activeDesignPaletteId === palette.id ? "active" : ""}
              title={palette.label}
              onClick={() => applyPalettePresetToBars(palette.colors)}
              style={{ "--swatch-color": palette.colors[0] } as CSSProperties}
            />
          ))}
        </div>
        <label>
          Number format
          <select value="percentage" onChange={() => undefined}>
            <option value="percentage">Percentage (0%)</option>
            <option value="whole">Whole number</option>
            <option value="decimal">Decimal</option>
          </select>
        </label>
        <label>
          Font
          <select value={selectedTile.appearance.axisFontSize > 12 ? "Inter" : "Inter"} onChange={() => undefined}>
            <option value="Inter">Inter</option>
            <option value="Georgia">Georgia</option>
            <option value="IBM Plex Sans">IBM Plex Sans</option>
          </select>
        </label>
        <label>
          Title style
          <select value="title-case" onChange={() => undefined}>
            <option value="title-case">Title Case</option>
            <option value="sentence">Sentence case</option>
            <option value="compact">Compact label</option>
          </select>
        </label>
      </AssistantFolder>
    </div>
  ) : (
    <div className="inspector-story-card quiet">
      <span>Style</span>
      <strong>No stylable tile selected</strong>
      <small>Select a chart or table to adjust palette, number format, and type styling.</small>
    </div>
  );

  const positionShortcutsCard = selectedTile || selectedElement ? (
    <div className="assistant-style-card assistant-style-card--flush">
      <AssistantFolder title="Position shortcuts" helper="Moves the selected object only">
        <div className="layout-suggestion-list">
          <button type="button" className="layout-suggestion active" onClick={() => applyLayoutPreset("leftColumn")}>
            <span className="layout-suggestion-icon"><AssistantIcon icon="layout" /></span>
            <span><strong>Left chart column</strong><small>Place this object in the left half</small></span>
            <em>selected only</em>
          </button>
          <button type="button" className="layout-suggestion" onClick={() => applyLayoutPreset("hero")}>
            <span className="layout-suggestion-icon"><AssistantIcon icon="options" /></span>
            <span><strong>Lead chart frame</strong><small>Make this object wide and readable</small></span>
            <em>top section</em>
          </button>
          <button type="button" className="layout-suggestion" onClick={() => applyLayoutPreset("rightColumn")}>
            <span className="layout-suggestion-icon"><AssistantIcon icon="layout" /></span>
            <span><strong>Right support column</strong><small>Move this object beside another block</small></span>
            <em>comparison</em>
          </button>
        </div>
      </AssistantFolder>
    </div>
  ) : (
    <div className="inspector-story-card quiet">
      <span>Arrange</span>
      <strong>No object selected</strong>
      <small>Select an object on the canvas to move, align, resize, or layer it.</small>
    </div>
  );

  const multiSelectionCard = multiSelectionSummary.count > 0 && (
            <div className="multi-selection-card inspector-primary-card">
              <div className="explorer-section-header">
                <strong>{multiSelectionSummary.count} selected</strong>
                <small>{multiSelectionSummary.tiles.length} tiles · {multiSelectionSummary.elements.length} elements</small>
              </div>
              {multiSelectionSummary.bounds && (
                <div className="multi-selection-bounds" aria-label="Selection bounds">
                  <div>
                    <span>Origin</span>
                    <strong>{multiSelectionSummary.bounds.x}, {multiSelectionSummary.bounds.y}</strong>
                  </div>
                  <div>
                    <span>Footprint</span>
                    <strong>{multiSelectionSummary.bounds.width} x {multiSelectionSummary.bounds.height}</strong>
                  </div>
                  <small>{multiSelectionSummary.footprintLabel}</small>
                  <small>{multiSelectionSummary.horizontalGapLabel}</small>
                  <small>{multiSelectionSummary.verticalGapLabel}</small>
                </div>
              )}
              <div className="multi-selection-list">
                {[...multiSelectionSummary.tiles.map((tile) => ({ id: tile.id, label: tile.title || tile.name, kind: "Tile", hidden: tile.hidden, locked: tile.locked })), ...multiSelectionSummary.elements.map((element) => ({ id: element.id, label: element.name, kind: "Element", hidden: element.hidden, locked: element.locked }))].map((item) => (
                  <div className="multi-selection-row" key={`${item.kind}-${item.id}`}>
                    <span>{item.label}</span>
                    <small>{item.kind} · {item.hidden ? "Hidden" : "Visible"} · {item.locked ? "Locked" : "Unlocked"}</small>
                  </div>
                ))}
              </div>
              <div className="multi-selection-action-group">
                <strong>Visibility</strong>
                <div className="brand-card-actions">
                <button type="button" className="secondary" onClick={() => setMultiSelectedHidden(true)}>Hide</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedHidden(false)}>Show</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedLocked(true)}>Lock</button>
                <button type="button" className="secondary" onClick={() => setMultiSelectedLocked(false)}>Unlock</button>
                </div>
              </div>
              <div className="multi-selection-action-group">
                <strong>Align</strong>
                <div className="layout-action-grid">
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("left")} disabled={multiSelectionSummary.count < 2}>Left</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("center")} disabled={multiSelectionSummary.count < 2}>Center</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("right")} disabled={multiSelectionSummary.count < 2}>Right</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("top")} disabled={multiSelectionSummary.count < 2}>Top</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("middle")} disabled={multiSelectionSummary.count < 2}>Middle</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("bottom")} disabled={multiSelectionSummary.count < 2}>Bottom</button>
                </div>
              </div>
              <div className="multi-selection-action-group">
                <strong>Distribute</strong>
                <div className="brand-card-actions">
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("distributeHorizontal")} disabled={multiSelectionSummary.count < 3}>Horizontal</button>
                  <button type="button" className="secondary" onClick={() => alignMultiSelected("distributeVertical")} disabled={multiSelectionSummary.count < 3}>Vertical</button>
                </div>
              </div>
              <button type="button" className="secondary" onClick={clearMultiSelection}>Clear selection</button>
            </div>
          );

  const detailedControlTitle = settingsView === "page"
    ? "Page"
    : settingsView === "layout"
      ? "Arrange"
      : settingsView === "effects"
        ? "Effects"
        : settingsView === "options"
          ? selectedElement
            ? "Object options"
            : "Series options"
          : settingsView === "container"
            ? "Container"
            : selectedElement
              ? "Element"
              : "More tile styling";
  const detailedControlHelper = settingsView === "page"
    ? "Page setup and background"
    : settingsView === "layout"
      ? "Position, alignment, and layering"
      : settingsView === "effects"
        ? "Shadow, glow, transparency, and surface treatment"
        : settingsView === "options"
          ? selectedElement
            ? "Size, position, and text box behavior"
            : "Series spacing, label offsets, size, and position"
          : settingsView === "container"
            ? "Tile surface, border, and effects"
            : selectedElement
              ? "Element appearance and content"
              : "Display and advanced chart styling";
  const detailedControls = settingsView === "page"
    ? <PageInspector {...props} />
    : settingsView === "layout"
      ? <LayoutInspector {...props} />
      : settingsView === "chart" || settingsView === "element" || settingsView === "container" || settingsView === "effects" || settingsView === "options"
        ? <ObjectInspector {...props} />
        : null;

  const styleSurface = (
    <>
          {selectedObjectHeader}
          {settingsView === "home" && styleQuickCard}
          {selectedTile && (settingsView === "chart" || settingsView === "container") && (
            <>
              {chartBasicsCard}
              {styleQuickCard}
            </>
          )}
          {settingsView === "layout" && positionShortcutsCard}
          {settingsView === "layout" && multiSelectionCard}
          {settingsView !== "home" && (
            <details className="advanced-inspector-details" open={settingsView === "page" || settingsView === "effects" || settingsView === "options" || settingsView === "container"}>
              <summary>
                <strong>{detailedControlTitle}</strong>
                <span>{detailedControlHelper}</span>
              </summary>
              {settingsView === "page" && (
                <div className="panel-title with-action">
                  <h2>{detailedControlTitle}</h2>
                </div>
              )}
              {detailedControls}
            </details>
          )}
    </>
  );
  const dataSurface = selectedTile ? (
    <>
      {selectedObjectHeader}
      <div className="inspector-story-card">
        <span>Selected analysis</span>
        <strong>{dataContext?.source}</strong>
        <small>{dataContext?.chart} · {dataContext?.banner}</small>
        <div className="inspector-context-chips">
          <span>{dataContext?.rows} rows</span>
          <span>{dataContext?.columns} columns</span>
          <span>{selectedTile.query.weight ? "Weighted" : "Unweighted"}</span>
        </div>
      </div>
      <AssistantFolder title="Edit analysis" helper={`${dataContext?.chart} · ${dataContext?.banner}`} defaultOpen>
        <TileAnalysisQuerySection {...props} />
      </AssistantFolder>
      <AssistantFolder title="Details and provenance" helper={`${dataContext?.rows} rows · ${dataContext?.columns} columns`}>
        <TileAnalysisResultSection {...props} />
      </AssistantFolder>
    </>
  ) : (
    <div className="inspector-story-card quiet">
      <span>Data context</span>
      <strong>No analytical tile selected</strong>
      <small>Select a chart or table to review query, source, result, and live-provider context.</small>
    </div>
  );
  const insightSurface = (
    <>
      {selectedObjectHeader}
      {outcomeMode && (
        <div className={`outcome-inspector-card ${outcomeMode}`}>
          <span>
            {outcomeMode === "dashboard"
              ? "Dashboard review"
              : outcomeMode === "report"
                ? "Report review"
                : "Present review"}
          </span>
          <strong>{outcomeLabel}</strong>
          <small>{outcomeHelper}</small>
        </div>
      )}
      <div className="inspector-insight-hero">
        <span>{storyGuidance.selectedRoleLabel}</span>
        <strong>{inspectorFocus.title}</strong>
        <small>{storyGuidance.selectedRoleHelper}</small>
      </div>
      <AssistantFolder title="Story structure" helper={`${storyGuidance.pageRoleLabel} · ${storyGuidance.arcLabel}`} defaultOpen>
        <div className="inspector-story-arc-card">
          <div>
            <span>Page role</span>
            <strong>{storyGuidance.pageRoleLabel}</strong>
            <small>{storyGuidance.pagePurpose}</small>
          </div>
          <div>
            <span>Suggested arc</span>
            <strong>{storyGuidance.arcLabel}</strong>
            <small>{storyGuidance.nextStepLabel}: {storyGuidance.nextStepHelper}</small>
          </div>
          <div>
            <span>Page flow</span>
            <strong>{storyGuidance.pageFlowLabel}</strong>
            <small>{storyGuidance.pageFlowHelper}</small>
          </div>
        </div>
      </AssistantFolder>
      {selectedTile ? (
        <>
          <AssistantFolder title="Evidence snapshot" helper={leadValueLabel ? `${leadValueLabel} lead visible result` : `${selectedTile.result.table.length} result rows`} defaultOpen>
            <div className="inspector-story-grid">
              <div className="inspector-story-metric">
                <span>Evidence</span>
                <strong>{leadValueLabel ?? `${selectedTile.result.table.length} rows`}</strong>
                <small>{leadRow?.label ?? `${selectedTile.result.columns.length} result columns`}</small>
              </div>
              <div className="inspector-story-metric">
                <span>Confidence</span>
                <strong>{Math.round(selectedTile.result.statistics.confidenceLevel * 100)}%</strong>
                <small>{selectedTile.result.weighting.label}</small>
              </div>
            </div>
            <div className="inspector-story-card quiet">
              <span>Analytical context</span>
              <strong>{executionSummary}</strong>
              <small>{selectedTile.result.statistics.significance.comparisonBasis} basis · {dataContext?.banner}</small>
              <div className="inspector-context-chips">
                <span>{selectedTile.result.weighting.applied ? "Weighted" : "Unweighted"}</span>
                <span>{selectedTile.result.statistics.significance.method.replace("_", " ")}</span>
                <span>{selectedTile.result.metric.label}</span>
              </div>
            </div>
          </AssistantFolder>
          <AssistantFolder title="Takeaway" helper="Grounded draft interpretation">
            <div className="inspector-ai-takeaway">
              <div>
                <span>Story takeaway</span>
                <small>Grounded in current result</small>
              </div>
              <p>{groundedTakeaway}</p>
            </div>
          </AssistantFolder>
          {(insightWarnings.length > 0 || insightNotes.length > 0) && (
            <AssistantFolder title="Warnings and notes" helper={`${insightWarnings.length} warnings · ${insightNotes.length} notes`}>
              <div className="inspector-story-card quiet">
                <span>Result notes</span>
                <strong>{insightWarnings.length > 0 ? `${insightWarnings.length} warning${insightWarnings.length === 1 ? "" : "s"}` : "No provider warnings"}</strong>
                {[...insightWarnings, ...insightNotes].slice(0, 4).map((note) => (
                  <small key={note}>{note}</small>
                ))}
              </div>
            </AssistantFolder>
          )}
          <button type="button" className="menu-card" onClick={() => {
            setInspectorSurface("style");
            setSettingsView("container");
          }}>
            <strong>Open provenance and lifecycle</strong>
            <span>Review saved settings, derived-output, template, segment, and starter context.</span>
          </button>
        </>
      ) : (
        <div className="inspector-story-card quiet">
          <span>Insight surface</span>
          <strong>{selectedElement ? "Pair with analytical evidence" : "Build a story section"}</strong>
          <small>{selectedElement ? "Select a chart or table to see evidence, significance, weighting, and story framing." : "Use KPI, insight, chart commentary, and opportunity starters from the Brand panel."}</small>
        </div>
      )}
    </>
  );

  return (
<BuilderPanel className="panel settings story-inspector" label="Design and insight inspector">
          <div className="assistant-side-rail" aria-label="Assistant tools">
            {assistantRailItems.map((item) => (
              <button
                type="button"
                className={item.active ? "active" : ""}
                key={item.id}
                disabled={item.disabled}
                title={item.helper}
                aria-pressed={item.active}
                onClick={() => activateAssistantRailItem(item.id)}
              >
                <AssistantIcon icon={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="inspector-shell-title">
            <h2><span aria-hidden="true">✣</span> Design + Insight Assistant</h2>
          </div>
          {inspectorSurface === "style" && styleSurface}
          {inspectorSurface === "data" && dataSurface}
          {inspectorSurface === "insight" && insightSurface}
        </BuilderPanel>
  );
}
