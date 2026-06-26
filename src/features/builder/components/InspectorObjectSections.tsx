import type React from "react";
import { ColorField, rangeFill } from "../../design-system/DesignControls";
import { fontFamilies } from "../builderConstants";
import { effectShadow, gradientCss } from "../builderHelpers";
import {
  TileAnalysisDesignSection,
  TileAnalysisDisplaySection,
  TileAnalysisQuerySection,
  TileAnalysisResultSection
} from "./InspectorTileAnalysisSections";
import type { DashboardCanvasElement } from "../../../../shared/types/dashboard";
import type { BuilderInspectorProps } from "./BuilderInspector";
import { buildCompositionStarterProvenanceHelper, editorialTextStyleRole } from "./compositionBlockModel";
import { buildReportTreeSelectionCueView, type ReportTreeSelectionCueView } from "./reportTreeSelectionCueModel";

export function ElementInspector(props: BuilderInspectorProps) {
  const {
    selectedElement,
    textStylePresets,
    setDesignModal,
    updateSelectedElement,
    applyTextStylePresetToSelection,
    deleteSelectedItem,
    reportTreeSelectionCue
  } = props;

  if (!selectedElement) {
    return null;
  }
  const reportTreeCue = buildReportTreeSelectionCueView(reportTreeSelectionCue, selectedElement, "element");

  return (
            <>
              {reportTreeCue && <ReportTreeSelectionCueCard view={reportTreeCue} />}
              {selectedElement.compositionBlock && (
                <CompositionProvenanceCard
                  label={selectedElement.compositionBlock.label}
                  helper={buildCompositionStarterProvenanceHelper(selectedElement.compositionBlock, "element")}
                />
              )}
              {selectedElement.assetSource && (
                <CompositionProvenanceCard
                  label={selectedElement.assetSource.label}
                  helper="Inserted from the local image asset library. This image element can be edited independently."
                />
              )}
              <label>
                Layer name
                <input value={selectedElement.name} onChange={(event) => updateSelectedElement({ name: event.target.value })} />
              </label>
              {selectedElement.type !== "rectangle" && selectedElement.type !== "circle" && (
                <>
                  <label>
                    {selectedElement.type === "image" ? "Image URL" : "Text"}
                    <input value={selectedElement.content} onChange={(event) => updateSelectedElement({ content: event.target.value })} />
                  </label>
                </>
              )}
              {selectedElement.type === "image" && (
                <label>
                  Image fit
                  <select
                    value={selectedElement.style.objectFit}
                    onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, objectFit: event.target.value as DashboardCanvasElement["style"]["objectFit"] } })}
                  >
                    <option value="cover">Crop to fill</option>
                    <option value="contain">Fit inside</option>
                    <option value="fill">Stretch</option>
                  </select>
                </label>
              )}
              {selectedElement.type === "text" && (
                <>
                  <div className="panel-title subtle">
                    <h2>Typography</h2>
                  </div>
                  <div className="settings-menu">
                    {textStylePresets.map((preset) => (
                      <button type="button" key={preset.id} className="menu-card" onClick={() => applyTextStylePresetToSelection(preset)}>
                        <strong>{editorialTextStyleRole(preset.id)} · {preset.label}</strong>
                        <span>{preset.description}</span>
                      </button>
                    ))}
                  </div>
                  <label>
                    Font
                    <select
                      value={selectedElement.style.fontFamily}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontFamily: event.target.value } })}
                    >
                      {fontFamilies.map((font) => (
                        <option key={font.label} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Text color
                    <input
                      type="color"
                      value={selectedElement.style.textColor}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, textColor: event.target.value } })}
                    />
                  </label>
                  <label>
                    Font size
                    <input
                      type="number"
                      min="10"
                      max="72"
                      value={selectedElement.style.fontSize}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontSize: Number(event.target.value) } })}
                    />
                  </label>
                  <label>
                    Weight
                    <select
                      value={selectedElement.style.fontWeight}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontWeight: event.target.value } })}
                    >
                      <option value="400">Regular</option>
                      <option value="600">Semibold</option>
                      <option value="700">Bold</option>
                      <option value="800">Heavy</option>
                    </select>
                  </label>
                  <div className="segmented three" aria-label="Text alignment">
                    {(["left", "center", "right"] as const).map((alignment) => (
                      <button
                        type="button"
                        key={alignment}
                        className={selectedElement.style.textAlign === alignment ? "active" : ""}
                        onClick={() => updateSelectedElement({ style: { ...selectedElement.style, textAlign: alignment } })}
                      >
                        {alignment}
                      </button>
                    ))}
                  </div>
                  <label>
                    Line height
                    <input
                      type="range"
                      min="0.8"
                      max="2"
                      step="0.05"
                      value={selectedElement.style.lineHeight}
                      style={{ "--range-fill": rangeFill(selectedElement.style.lineHeight, 0.8, 2) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, lineHeight: Number(event.target.value) } })}
                    />
                  </label>
                  <label>
                    Padding
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={selectedElement.style.padding}
                      style={{ "--range-fill": rangeFill(selectedElement.style.padding, 0, 40) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, padding: Number(event.target.value) } })}
                    />
                  </label>
                  <div className="toggle-list">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedElement.style.fontStyle === "italic"}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontStyle: event.target.checked ? "italic" : "normal" } })}
                      /> Italic
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedElement.style.textDecoration === "underline"}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, textDecoration: event.target.checked ? "underline" : "none" } })}
                      /> Underline
                    </label>
                  </div>
                </>
              )}
              {selectedElement.type !== "image" && (
                <label>
                  Fill style
                  <select
                    value={selectedElement.style.fillMode}
                    onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fillMode: event.target.value as "solid" | "gradient" } })}
                  >
                    <option value="solid">Solid</option>
                    <option value="gradient">Gradient</option>
                  </select>
                </label>
              )}
              {selectedElement.type !== "image" && selectedElement.style.fillMode === "solid" && (
                <label>
                  Fill
                  <input
                    type="color"
                    value={selectedElement.style.fill === "transparent" ? "#ffffff" : selectedElement.style.fill}
                    onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fill: event.target.value } })}
                  />
                </label>
              )}
              {selectedElement.type !== "image" && selectedElement.style.fillMode === "gradient" && (
                <button type="button" className="design-popover-button" onClick={() => setDesignModal("elementGradient")}>
                  <span className="gradient-button-preview" style={{ background: gradientCss(selectedElement.style.gradientFrom, selectedElement.style.gradientTo, selectedElement.style.gradientStops, selectedElement.style.gradientType) }} />
                  <span>Edit fill gradient</span>
                </button>
              )}
              {(selectedElement.type === "rectangle" || selectedElement.type === "circle" || selectedElement.type === "image" || selectedElement.type === "text") && (
                <>
                  <label>
                    Border
                    <input
                      type="color"
                      value={selectedElement.style.borderColor}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderColor: event.target.value } })}
                    />
                  </label>
                  <label>
                    Border width
                    <input
                      type="range"
                      min="0"
                      max="16"
                      value={selectedElement.style.borderWidth}
                      style={{ "--range-fill": rangeFill(selectedElement.style.borderWidth, 0, 16) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderWidth: Number(event.target.value), borderStyle: Number(event.target.value) === 0 ? "none" : selectedElement.style.borderStyle === "none" ? "solid" : selectedElement.style.borderStyle } })}
                    />
                  </label>
                  <label>
                    Border style
                    <select
                      value={selectedElement.style.borderStyle}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderStyle: event.target.value as DashboardCanvasElement["style"]["borderStyle"] } })}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  {selectedElement.type !== "circle" && (
                    <label>
                      Rounded corners
                      <input
                        type="range"
                        min="0"
                        max="48"
                        value={selectedElement.style.borderRadius}
                        style={{ "--range-fill": rangeFill(selectedElement.style.borderRadius, 0, 48) } as React.CSSProperties}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderRadius: Number(event.target.value) } })}
                      />
                    </label>
                  )}
                  <label>
                    Transparency
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={selectedElement.style.opacity}
                      style={{ "--range-fill": rangeFill(selectedElement.style.opacity, 10, 100) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, opacity: Number(event.target.value) } })}
                    />
                  </label>
                  <button type="button" className="design-popover-button" onClick={() => setDesignModal("elementEffects")}>
                    <span className="effect-button-preview" style={{ boxShadow: effectShadow({ ...selectedElement.style, shadow: selectedElement.style.shadow || selectedElement.style.glow }) }} />
                    <span>Effects</span>
                    <small>{selectedElement.style.shadow || selectedElement.style.glow ? "On" : "None"}</small>
                  </button>
                </>
              )}
              <button
                type="button"
                className="secondary"
                onClick={deleteSelectedItem}
              >
                Remove element
              </button>
            </>
  );
}

function ReportTreeSelectionCueCard({ view }: { view: ReportTreeSelectionCueView }) {
  return (
    <div className="report-tree-selection-cue" role="status">
      <strong>{view.label}</strong>
      <span>{view.message}</span>
      <small>{view.helper}</small>
    </div>
  );
}

function CompositionProvenanceCard({ label, helper }: { label: string; helper: string }) {
  return (
    <div className="composition-provenance-card">
      <span>Reusable content</span>
      <strong>{label}</strong>
      <small>{helper}</small>
    </div>
  );
}

export function TileContainerInspector(props: BuilderInspectorProps) {
  const {
    selectedTile,
    setDesignModal,
    updateSelectedAppearance,
    deleteSelectedItem
  } = props;

  if (!selectedTile) {
    return null;
  }

  return (
            <>
              <div className="panel-title subtle">
                <h2>Tile container</h2>
              </div>
              <label>
                Tile background
                <select
                  value={selectedTile.appearance.backgroundMode}
                  onChange={(event) => updateSelectedAppearance({ backgroundMode: event.target.value as "solid" | "gradient" })}
                >
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                </select>
              </label>
              {selectedTile.appearance.backgroundMode === "solid" ? (
                <ColorField label="Fill color" value={selectedTile.appearance.background} onChange={(value) => updateSelectedAppearance({ background: value })} />
              ) : (
                <button type="button" className="design-popover-button" onClick={() => setDesignModal("tileGradient")}>
                  <span className="gradient-button-preview" style={{ background: gradientCss(selectedTile.appearance.gradientFrom, selectedTile.appearance.gradientTo, selectedTile.appearance.gradientStops, selectedTile.appearance.gradientType) }} />
                  <span>Edit tile gradient</span>
                </button>
              )}
              <ColorField label="Tile border" value={selectedTile.appearance.borderColor} onChange={(value) => updateSelectedAppearance({ borderColor: value })} />
              <label>
                Tile corners
                <input type="range" min="0" max="36" value={selectedTile.appearance.borderRadius} style={{ "--range-fill": rangeFill(selectedTile.appearance.borderRadius, 0, 36) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ borderRadius: Number(event.target.value) })} />
              </label>
              <label>
                Tile transparency
                <input type="range" min="20" max="100" value={selectedTile.appearance.opacity} style={{ "--range-fill": rangeFill(selectedTile.appearance.opacity, 20, 100) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ opacity: Number(event.target.value) })} />
              </label>
              <button type="button" className="design-popover-button" onClick={() => setDesignModal("tileEffects")}>
                <span className="effect-button-preview" style={{ boxShadow: effectShadow({ ...selectedTile.appearance, shadow: selectedTile.appearance.shadow || selectedTile.appearance.glow }) }} />
                <span>Effects</span>
                <small>{selectedTile.appearance.shadow || selectedTile.appearance.glow ? "On" : "None"}</small>
              </button>
              <button
                type="button"
                className="secondary"
                onClick={deleteSelectedItem}
              >
                Remove tile
              </button>
            </>
  );
}

export function TileAnalysisInspector(props: BuilderInspectorProps) {
  const { selectedTile } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
      <TileAnalysisResultSection {...props} />
      <TileAnalysisQuerySection {...props} />
      <TileAnalysisDisplaySection {...props} />
      <TileAnalysisDesignSection {...props} />
    </>
  );
}
