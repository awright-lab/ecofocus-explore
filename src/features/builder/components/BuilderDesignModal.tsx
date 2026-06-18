import type React from "react";
import { axisRotationPresets, effectPresets, palettes, type EffectPreset } from "../builderConstants";
import { BarColorField, ColorField, GradientEditor, PageBackgroundField, rangeFill } from "../../design-system/DesignControls";
import { applyGradientStylePreset, effectShadow, gradientCss } from "../builderHelpers";
import { getAxisLabel, getBarStyle, getPaletteId } from "./CanvasRenderers";
import type { DesignModal } from "../builderTypes";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, TileAppearance } from "../../../../shared/types/dashboard";

type BuilderDesignModalProps = {
  designModal: NonNullable<DesignModal>;
  designModalRef: React.RefObject<HTMLDivElement | null>;
  activePage: DashboardPage;
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  selectedChartPart: { id: string; label: string } | null;
  selectedChartPartId: string;
  setDesignModal: (modal: DesignModal | null) => void;
  setSelectedChartPartId: (id: string) => void;
  updateActivePage: (updates: Partial<DashboardPage>) => void;
  updateSelectedElement: (updates: Partial<DashboardCanvasElement>) => void;
  updateSelectedAppearance: (updates: Partial<TileAppearance>) => void;
  updateSelectedBarStyle: (updates: Partial<TileAppearance["barStyles"][string]>) => void;
  updateSelectedAxisLabel: (value: string) => void;
  applyPalettePresetToBars: (colors: string[]) => void;
  applyPaletteColorToSelectedBar: (color: string) => void;
  applySolidColorToBars: (color: string) => void;
  clearBarColorOverrides: (nextShared?: Partial<TileAppearance>) => void;
  applySelectedElementEffectPreset: (preset: EffectPreset) => void;
  applySelectedTileEffectPreset: (preset: EffectPreset) => void;
};

export function BuilderDesignModal(props: BuilderDesignModalProps) {
  const {
    designModal,
    designModalRef,
    activePage,
    selectedTile,
    selectedElement,
    selectedChartPart,
    selectedChartPartId,
    setDesignModal,
    setSelectedChartPartId,
    updateActivePage,
    updateSelectedElement,
    updateSelectedAppearance,
    updateSelectedBarStyle,
    updateSelectedAxisLabel,
    applyPalettePresetToBars,
    applyPaletteColorToSelectedBar,
    applySolidColorToBars,
    clearBarColorOverrides,
    applySelectedElementEffectPreset,
    applySelectedTileEffectPreset
  } = props;

  return (
        <div className="design-modal-backdrop" role="presentation" onMouseDown={() => setDesignModal(null)}>
          <div ref={designModalRef} className="design-modal" role="dialog" aria-modal="true" aria-label="Design settings" onMouseDown={(event) => event.stopPropagation()}>
            <div className="design-modal-header">
              <div>
                <span>Design</span>
                <h2>
                  {designModal === "pageBackground"
                    ? "Page background"
                    : designModal === "chartColors"
                    ? "Chart colors"
                    : designModal === "labelSettings"
                      ? "Label settings"
                      : designModal === "barLayout"
                        ? "Bar settings"
                    : designModal === "axisSettings"
                      ? "Axis settings"
                      : designModal.includes("Gradient")
                        ? "Gradient settings"
                        : "Effects"}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setDesignModal(null)} aria-label="Close design settings">
                x
              </button>
            </div>

            {designModal === "chartColors" && selectedTile && (
              <div className="modal-control-stack">
                <div className="color-summary-card">
                  <div>
                    <span>Style target</span>
                    <strong title={selectedChartPart ? selectedChartPart.label : "All bars"}>
                      {selectedChartPart ? selectedChartPart.label : "All bars"}
                    </strong>
                  </div>
                  <div className="style-target-chips">
                    <button
                      type="button"
                      className={selectedChartPart ? "style-target-chip all" : "style-target-chip all active"}
                      onClick={() => setSelectedChartPartId("all")}
                      aria-label="Select all bars"
                    >
                      <span>All</span>
                    </button>
                    {selectedTile.result.table.slice(0, 5).map((row, index) => {
                      const id = row.optionId;
                      const fallback = selectedTile.appearance.palette[index % selectedTile.appearance.palette.length] ?? selectedTile.appearance.primaryColor;
                      const style = getBarStyle(selectedTile.appearance, id, fallback);
                      return (
                        <button
                          type="button"
                          key={id}
                          className={selectedChartPartId === id ? "style-target-chip active" : "style-target-chip"}
                          onClick={() => setSelectedChartPartId(id)}
                          aria-label={`Select ${row.label}`}
                        >
                          <span style={{ background: style.fillMode === "gradient" ? gradientCss(style.color, style.gradientTo, style.gradientStops, style.gradientType, `${style.gradientAngle}deg`) : style.color }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="palette-chip-groups">
                  <span>Bar palette presets</span>
                  <div className="palette-chip-group-list">
                    {palettes.map((palette) => {
                      const isActive = !selectedChartPart && getPaletteId(selectedTile.appearance.palette) === palette.id;
                      return (
                        <button
                          type="button"
                          key={palette.id}
                          className={isActive ? "palette-chip-group active" : "palette-chip-group"}
                          onClick={() => applyPalettePresetToBars(palette.colors)}
                        >
                          <div className="palette-chip-group-header">
                            <strong>{palette.label}</strong>
                            <small>Use set</small>
                          </div>
                          <div className="palette-chip-row">
                            {palette.colors.map((color, index) => (
                              <span
                                key={`${palette.id}-${color}-${index}`}
                                className="palette-chip"
                                style={{ background: color }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Use ${color} from ${palette.label}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectedChartPart
                                    ? applyPaletteColorToSelectedBar(color)
                                    : applyPalettePresetToBars([color, ...palette.colors.filter((entry) => entry !== color)]);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  selectedChartPart
                                    ? applyPaletteColorToSelectedBar(color)
                                    : applyPalettePresetToBars([color, ...palette.colors.filter((entry) => entry !== color)]);
                                }}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <BarColorField
                  style={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor) : getBarStyle(selectedTile.appearance, "__default__", selectedTile.appearance.primaryColor)}
                  onColorChange={(value) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({ color: value })
                      : applySolidColorToBars(value)
                  }
                  onFillModeChange={(mode) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({ fillMode: mode })
                      : clearBarColorOverrides({ barFillMode: mode })
                  }
                  onPresetApply={(preset) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({
                          gradientType: preset.type,
                          gradientAngle: preset.angle,
                          gradientStops: applyGradientStylePreset(
                            getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).color,
                            getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientTo,
                            getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientStops,
                            preset.positions
                          )
                        })
                      : clearBarColorOverrides({
                          barGradientType: preset.type,
                          barGradientAngle: preset.angle,
                          barGradientStops: applyGradientStylePreset(
                            selectedTile.appearance.primaryColor,
                            selectedTile.appearance.barGradientTo,
                            selectedTile.appearance.barGradientStops,
                            preset.positions
                          )
                        })
                  }
                  onGradientChange={(updates) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({ color: updates.color, gradientTo: updates.gradientTo, gradientStops: updates.gradientStops })
                      : clearBarColorOverrides({
                          primaryColor: updates.color,
                          palette: [updates.color, ...selectedTile.appearance.palette.slice(1)],
                          barGradientTo: updates.gradientTo,
                          barGradientStops: updates.gradientStops
                        })
                  }
                />
                <ColorField label="Value label color" value={selectedTile.appearance.labelColor} onChange={(value) => updateSelectedAppearance({ labelColor: value })} />
                <ColorField label="X axis text color" value={selectedTile.appearance.xAxisTextColor} onChange={(value) => updateSelectedAppearance({ xAxisTextColor: value })} />
                <ColorField label="Y axis text color" value={selectedTile.appearance.yAxisTextColor} onChange={(value) => updateSelectedAppearance({ yAxisTextColor: value })} />
                <ColorField label="Chart background" value={selectedTile.appearance.chartBackground} onChange={(value) => updateSelectedAppearance({ chartBackground: value })} />
                <ColorField label="Grid color" value={selectedTile.appearance.gridColor} onChange={(value) => updateSelectedAppearance({ gridColor: value })} />
              </div>
            )}

            {designModal === "pageBackground" && (
              <div className="modal-control-stack">
                <div className="color-summary-card">
                  <div>
                    <span>Page surface</span>
                    <strong>
                      {activePage.backgroundMode === "image"
                        ? "Image"
                        : activePage.backgroundMode[0].toUpperCase() + activePage.backgroundMode.slice(1)}
                    </strong>
                  </div>
                  <div
                    className="page-background-preview"
                    style={{
                      background:
                        activePage.backgroundMode === "image" && activePage.backgroundImage
                          ? undefined
                          : activePage.backgroundMode === "gradient"
                            ? gradientCss(activePage.gradientFrom, activePage.gradientTo, activePage.gradientStops, activePage.gradientType, `${activePage.gradientAngle}deg`)
                            : activePage.background,
                      backgroundImage:
                        activePage.backgroundMode === "image" && activePage.backgroundImage
                          ? `url("${activePage.backgroundImage.replace(/"/g, '\\"')}")`
                          : undefined,
                      backgroundSize:
                        activePage.backgroundMode === "image"
                          ? activePage.backgroundImageFit === "fill"
                            ? "100% 100%"
                            : activePage.backgroundImageFit
                          : undefined
                    }}
                  />
                </div>
                <div className="color-summary-card">
                  <div>
                    <span>Background</span>
                    <strong>Edit page surface</strong>
                  </div>
                  <PageBackgroundField
                    page={activePage}
                    onModeChange={(mode) => updateActivePage({ backgroundMode: mode })}
                    onSolidChange={(value) => updateActivePage({ background: value })}
                    onGradientChange={(updates) =>
                      updateActivePage({
                        gradientFrom: updates.from,
                        gradientTo: updates.to,
                        gradientType: updates.type,
                        gradientAngle: updates.angle,
                        gradientStops: updates.stops
                      })
                    }
                    onImageChange={(updates) => updateActivePage(updates)}
                  />
                </div>
              </div>
            )}

            {designModal === "pageGradient" && (
              <GradientEditor
                label="Page gradient"
                from={activePage.gradientFrom}
                to={activePage.gradientTo}
                type={activePage.gradientType}
                stops={activePage.gradientStops}
                onChange={(updates) => updateActivePage({ gradientFrom: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientAngle: 135, gradientStops: updates.stops })}
              />
            )}

            {designModal === "elementGradient" && selectedElement && (
              <GradientEditor
                label="Fill gradient"
                from={selectedElement.style.gradientFrom}
                to={selectedElement.style.gradientTo}
                type={selectedElement.style.gradientType}
                stops={selectedElement.style.gradientStops}
                onChange={(updates) => updateSelectedElement({ style: { ...selectedElement.style, gradientFrom: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientStops: updates.stops } })}
              />
            )}

            {designModal === "tileGradient" && selectedTile && (
              <GradientEditor
                label="Tile gradient"
                from={selectedTile.appearance.gradientFrom}
                to={selectedTile.appearance.gradientTo}
                type={selectedTile.appearance.gradientType}
                stops={selectedTile.appearance.gradientStops}
                onChange={(updates) => updateSelectedAppearance({ gradientFrom: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientStops: updates.stops })}
              />
            )}

            {designModal === "barGradient" && selectedTile && (
              <GradientEditor
                label={selectedChartPart ? "Selected bar gradient" : "Bar gradient"}
                from={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).color : selectedTile.appearance.primaryColor}
                to={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientTo : selectedTile.appearance.barGradientTo}
                type={(selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientType : selectedTile.appearance.barGradientType) === "conic" ? "linear" : selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientType : selectedTile.appearance.barGradientType}
                stops={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientStops : selectedTile.appearance.barGradientStops}
                allowedTypes={["linear", "radial"]}
                onChange={(updates) =>
                  selectedChartPart
                    ? updateSelectedBarStyle({ color: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientStops: updates.stops })
                    : updateSelectedAppearance({ primaryColor: updates.from, palette: [updates.from, ...selectedTile.appearance.palette.slice(1)], barGradientTo: updates.to, barGradientType: updates.type, barGradientStops: updates.stops })
                }
              />
            )}

            {designModal === "axisSettings" && selectedTile && (
              <div className="modal-control-stack">
                <ColorField label="X axis text color" value={selectedTile.appearance.xAxisTextColor} onChange={(value) => updateSelectedAppearance({ xAxisTextColor: value })} />
                <ColorField label="Y axis text color" value={selectedTile.appearance.yAxisTextColor} onChange={(value) => updateSelectedAppearance({ yAxisTextColor: value })} />
                <label>
                  Axis text size
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="6"
                    max="72"
                    value={selectedTile.appearance.axisFontSize}
                    onChange={(event) => updateSelectedAppearance({ axisFontSize: Math.min(72, Math.max(6, Number(event.target.value) || 12)) })}
                  />
                </label>
                {selectedChartPart && (
                  <label>
                    Axis label text
                    <textarea
                      value={getAxisLabel(selectedTile.appearance, selectedChartPart.id, selectedChartPart.label)}
                      onChange={(event) => updateSelectedAxisLabel(event.target.value)}
                    />
                    <span>Use line breaks here to force label wrapping for the selected bar.</span>
                  </label>
                )}
                <label>
                  Axis label position
                  <select value={selectedTile.appearance.axisLabelPlacement} onChange={(event) => updateSelectedAppearance({ axisLabelPlacement: event.target.value as TileAppearance["axisLabelPlacement"] })}>
                    <option value="outside">Outside</option>
                    <option value="insideStart">Inside start</option>
                    <option value="insideCenter">Inside center</option>
                  </select>
                </label>
                <label>
                  Axis label width
                  <input type="number" min="8" max="72" value={selectedTile.appearance.axisLabelWidth} onChange={(event) => updateSelectedAppearance({ axisLabelWidth: Math.min(72, Math.max(8, Number(event.target.value) || 16)) })} />
                </label>
                <label>
                  Axis max lines
                  <input type="number" min="1" max="12" value={selectedTile.appearance.axisLabelMaxLines} onChange={(event) => updateSelectedAppearance({ axisLabelMaxLines: Math.min(12, Math.max(1, Number(event.target.value) || 3)) })} />
                </label>
                <label>
                  Axis label height
                  <input type="number" min="24" max="320" value={selectedTile.appearance.axisHeight} onChange={(event) => updateSelectedAppearance({ axisHeight: Math.min(320, Math.max(24, Number(event.target.value) || 112)) })} />
                </label>
                <label>
                  Axis label X
                  <input type="number" min="-240" max="240" value={selectedTile.appearance.axisLabelDx} onChange={(event) => updateSelectedAppearance({ axisLabelDx: Math.min(240, Math.max(-240, Number(event.target.value) || 0)) })} />
                </label>
                <label>
                  Axis label Y
                  <input type="number" min="-240" max="240" value={selectedTile.appearance.axisLabelDy} onChange={(event) => updateSelectedAppearance({ axisLabelDy: Math.min(240, Math.max(-240, Number(event.target.value) || 0)) })} />
                </label>
                <label>
                  Axis rotation
                  <input
                    type="number"
                    list="axis-rotation-presets"
                    min="-180"
                    max="180"
                    value={selectedTile.appearance.axisLabelRotation}
                    onChange={(event) => updateSelectedAppearance({ axisLabelRotation: Math.min(180, Math.max(-180, Number(event.target.value) || 0)) })}
                  />
                  <datalist id="axis-rotation-presets">
                    {axisRotationPresets.map((rotation) => (
                      <option value={rotation} key={rotation} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Axis alignment
                  <select value={selectedTile.appearance.axisLabelAlign} onChange={(event) => updateSelectedAppearance({ axisLabelAlign: event.target.value as TileAppearance["axisLabelAlign"] })}>
                    <option value="start">Left</option>
                    <option value="middle">Center</option>
                    <option value="end">Right</option>
                  </select>
                </label>
                <div className="toggle-list">
                  <label><input type="checkbox" checked={selectedTile.appearance.axisLabelWrap} onChange={(event) => updateSelectedAppearance({ axisLabelWrap: event.target.checked })} /> Wrap axis labels</label>
                </div>
                <ColorField label="Grid color" value={selectedTile.appearance.gridColor} onChange={(value) => updateSelectedAppearance({ gridColor: value })} />
              </div>
            )}

            {designModal === "labelSettings" && selectedTile && (
              <div className="modal-control-stack">
                <label>
                  Label position
                  <select value={selectedTile.appearance.labelPosition} onChange={(event) => updateSelectedAppearance({ labelPosition: event.target.value as TileAppearance["labelPosition"] })}>
                    <option value="top">Top</option>
                    <option value="insideTop">Inside top</option>
                    <option value="insideBottom">Inside bottom</option>
                    <option value="center">Center</option>
                  </select>
                </label>
                <label>
                  Label size
                  <input type="range" min="9" max="28" value={selectedTile.appearance.labelFontSize} style={{ "--range-fill": rangeFill(selectedTile.appearance.labelFontSize, 9, 28) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ labelFontSize: Number(event.target.value) })} />
                </label>
                <label>
                  Label offset
                  <input type="range" min="0" max="32" value={selectedTile.appearance.labelOffset} style={{ "--range-fill": rangeFill(selectedTile.appearance.labelOffset, 0, 32) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ labelOffset: Number(event.target.value) })} />
                </label>
              </div>
            )}

            {designModal === "barLayout" && selectedTile && (
              <div className="modal-control-stack">
                <div className="color-summary-card">
                  <div>
                    <span>Style target</span>
                    <strong title={selectedChartPart ? selectedChartPart.label : "All bars"}>
                      {selectedChartPart ? selectedChartPart.label : "All bars"}
                    </strong>
                  </div>
                  <div className="style-target-chips">
                    <button
                      type="button"
                      className={selectedChartPart ? "style-target-chip all" : "style-target-chip all active"}
                      onClick={() => setSelectedChartPartId("all")}
                      aria-label="Select all bars"
                    >
                      <span>All</span>
                    </button>
                    {selectedTile.result.table.slice(0, 5).map((row, index) => {
                      const id = row.optionId;
                      const fallback = selectedTile.appearance.palette[index % selectedTile.appearance.palette.length] ?? selectedTile.appearance.primaryColor;
                      const style = getBarStyle(selectedTile.appearance, id, fallback);
                      return (
                        <button
                          type="button"
                          key={id}
                          className={selectedChartPartId === id ? "style-target-chip active" : "style-target-chip"}
                          onClick={() => setSelectedChartPartId(id)}
                          aria-label={`Select ${row.label}`}
                        >
                          <span style={{ background: style.fillMode === "gradient" ? gradientCss(style.color, style.gradientTo, style.gradientStops, style.gradientType, `${style.gradientAngle}deg`) : style.color }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label>
                  Bar roundness
                  <input
                    type="range"
                    min="0"
                    max="36"
                    value={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).radius : selectedTile.appearance.barRadius}
                    style={{ "--range-fill": rangeFill(selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).radius : selectedTile.appearance.barRadius, 0, 36) } as React.CSSProperties}
                    onChange={(event) =>
                      selectedChartPart ? updateSelectedBarStyle({ radius: Number(event.target.value) }) : updateSelectedAppearance({ barRadius: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Bar width
                  <input type="range" min="16" max="140" value={selectedTile.appearance.barSize} style={{ "--range-fill": rangeFill(selectedTile.appearance.barSize, 16, 140) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ barSize: Number(event.target.value) })} />
                </label>
                <label>
                  Bar spacing
                  <input type="range" min="0" max="48" value={selectedTile.appearance.barGap} style={{ "--range-fill": rangeFill(selectedTile.appearance.barGap, 0, 48) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ barGap: Number(event.target.value) })} />
                </label>
                <label>
                  Group spacing
                  <input type="range" min="0" max="64" value={selectedTile.appearance.barCategoryGap} style={{ "--range-fill": rangeFill(selectedTile.appearance.barCategoryGap, 0, 64) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ barCategoryGap: Number(event.target.value) })} />
                </label>
              </div>
            )}

            {designModal === "elementEffects" && selectedElement && (
              <div className="modal-control-stack">
                <div className="effect-preview-card" style={{ boxShadow: effectShadow({ ...selectedElement.style, shadow: selectedElement.style.shadow || selectedElement.style.glow }) }}>
                  {selectedElement.name}
                </div>
                <div className="preset-grid">
                  {(Object.keys(effectPresets) as EffectPreset[]).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      className={selectedElement.style.shadowPreset === preset ? "active" : ""}
                      onClick={() => applySelectedElementEffectPreset(preset)}
                    >
                      {effectPresets[preset].label}
                    </button>
                  ))}
                </div>
                <div className="toggle-list">
                  <label><input type="checkbox" checked={selectedElement.style.shadow} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadow: event.target.checked } })} /> Drop shadow</label>
                  <label><input type="checkbox" checked={selectedElement.style.glow} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, glow: event.target.checked } })} /> Glow</label>
                </div>
                <label>Shadow color<input type="color" value={selectedElement.style.shadowColor} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowColor: event.target.value } })} /></label>
                <label>Shadow opacity<input type="range" min="0" max="70" value={selectedElement.style.shadowOpacity} style={{ "--range-fill": rangeFill(selectedElement.style.shadowOpacity, 0, 70) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowOpacity: Number(event.target.value) } })} /></label>
                <label>Blur<input type="range" min="0" max="80" value={selectedElement.style.shadowBlur} style={{ "--range-fill": rangeFill(selectedElement.style.shadowBlur, 0, 80) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowBlur: Number(event.target.value) } })} /></label>
                <label>Offset X<input type="range" min="-40" max="40" value={selectedElement.style.shadowOffsetX} style={{ "--range-fill": rangeFill(selectedElement.style.shadowOffsetX, -40, 40) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowOffsetX: Number(event.target.value) } })} /></label>
                <label>Offset Y<input type="range" min="-40" max="60" value={selectedElement.style.shadowOffsetY} style={{ "--range-fill": rangeFill(selectedElement.style.shadowOffsetY, -40, 60) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowOffsetY: Number(event.target.value) } })} /></label>
                <label>Glow color<input type="color" value={selectedElement.style.glowColor} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, glowColor: event.target.value } })} /></label>
                <label>Glow size<input type="range" min="0" max="90" value={selectedElement.style.glowSize} style={{ "--range-fill": rangeFill(selectedElement.style.glowSize, 0, 90) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, glowSize: Number(event.target.value) } })} /></label>
              </div>
            )}

            {designModal === "tileEffects" && selectedTile && (
              <div className="modal-control-stack">
                <div className="effect-preview-card" style={{ boxShadow: effectShadow({ ...selectedTile.appearance, shadow: selectedTile.appearance.shadow || selectedTile.appearance.glow }) }}>
                  {selectedTile.name}
                </div>
                <div className="preset-grid">
                  {(Object.keys(effectPresets) as EffectPreset[]).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      className={selectedTile.appearance.shadowPreset === preset ? "active" : ""}
                      onClick={() => applySelectedTileEffectPreset(preset)}
                    >
                      {effectPresets[preset].label}
                    </button>
                  ))}
                </div>
                <div className="toggle-list">
                  <label><input type="checkbox" checked={selectedTile.appearance.shadow} onChange={(event) => updateSelectedAppearance({ shadow: event.target.checked })} /> Drop shadow</label>
                  <label><input type="checkbox" checked={selectedTile.appearance.glow} onChange={(event) => updateSelectedAppearance({ glow: event.target.checked })} /> Glow</label>
                </div>
                <label>Shadow color<input type="color" value={selectedTile.appearance.shadowColor} onChange={(event) => updateSelectedAppearance({ shadowColor: event.target.value })} /></label>
                <label>Shadow opacity<input type="range" min="0" max="70" value={selectedTile.appearance.shadowOpacity} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowOpacity, 0, 70) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowOpacity: Number(event.target.value) })} /></label>
                <label>Blur<input type="range" min="0" max="80" value={selectedTile.appearance.shadowBlur} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowBlur, 0, 80) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowBlur: Number(event.target.value) })} /></label>
                <label>Offset X<input type="range" min="-40" max="40" value={selectedTile.appearance.shadowOffsetX} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowOffsetX, -40, 40) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowOffsetX: Number(event.target.value) })} /></label>
                <label>Offset Y<input type="range" min="-40" max="60" value={selectedTile.appearance.shadowOffsetY} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowOffsetY, -40, 60) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowOffsetY: Number(event.target.value) })} /></label>
                <label>Glow color<input type="color" value={selectedTile.appearance.glowColor} onChange={(event) => updateSelectedAppearance({ glowColor: event.target.value })} /></label>
                <label>Glow size<input type="range" min="0" max="90" value={selectedTile.appearance.glowSize} style={{ "--range-fill": rangeFill(selectedTile.appearance.glowSize, 0, 90) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ glowSize: Number(event.target.value) })} /></label>
              </div>
            )}
          </div>
        </div>
  );
}
