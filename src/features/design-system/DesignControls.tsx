import { useRef, useState } from "react";
import { getBarStyle, gradientStylePresets } from "../builder/components/CanvasRenderers";
import {
  applyGradientStylePreset,
  colorAlpha,
  gradientCss,
  hexToRgbObject,
  hslToRgb,
  hsvToRgb,
  normalizeGradientStops,
  normalizeHexColor,
  protectedGradientEndpointIds,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  setHexAlpha,
  stripHexAlpha
} from "../builder/builderHelpers";
import type { DashboardPage, GradientStop, GradientType } from "../../../shared/types/dashboard";

let lastSolidPickerHue = 150;

export function GradientEditor({
  label,
  from,
  to,
  type,
  stops,
  allowedTypes = ["linear", "radial", "conic"],
  onChange
}: {
  label: string;
  from: string;
  to: string;
  type: GradientType;
  stops?: GradientStop[];
  allowedTypes?: GradientType[];
  onChange: (updates: { from: string; to: string; type: GradientType; stops: GradientStop[] }) => void;
}) {
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null);
  const allStops = normalizeGradientStops(from, to, stops);
  const { startId, endId } = protectedGradientEndpointIds(allStops);
  const stylePresets = gradientStylePresets.filter(
    (preset, index, presets) =>
      allowedTypes.includes(preset.type) && presets.findIndex((entry) => entry.type === preset.type) === index
  );

  function updateStop(id: string, updates: Partial<GradientStop>) {
    const nextStops = allStops.map((stop) => (stop.id === id ? { ...stop, ...updates } : stop));
    const nextStartId = protectedGradientEndpointIds(nextStops).startId;
    const nextEndId = protectedGradientEndpointIds(nextStops).endId;
    const start = nextStops.find((stop) => stop.id === nextStartId)?.color ?? from;
    const end = nextStops.find((stop) => stop.id === nextEndId)?.color ?? to;
    onChange({ from: start, to: end, type, stops: nextStops });
  }

  function addStop() {
    const innerStops = allStops.filter((stop) => stop.position > 0 && stop.position < 100);
    const nextPosition = innerStops.length
      ? Math.min(90, Math.max(10, Math.round(innerStops.reduce((sum, stop) => sum + stop.position, 0) / innerStops.length) + 15))
      : 50;
    const stop = { id: `stop_${Date.now()}`, color: "#ffffff", position: nextPosition, opacity: 100 };
    onChange({ from, to, type, stops: [...allStops, stop].sort((first, second) => first.position - second.position) });
  }

  function removeStop(id: string) {
    onChange({ from, to, type, stops: allStops.filter((stop) => stop.id !== id) });
  }

  function reorderStops(targetId: string) {
    if (!draggedStopId || draggedStopId === targetId) return;
    const fromIndex = allStops.findIndex((stop) => stop.id === draggedStopId);
    const toIndex = allStops.findIndex((stop) => stop.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...allStops];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const ordered = next.map((stop, index) => ({
      ...stop,
      position: next.length === 1 ? 50 : Math.round((index / (next.length - 1)) * 100)
    }));
    const nextStartId = protectedGradientEndpointIds(ordered).startId;
    const nextEndId = protectedGradientEndpointIds(ordered).endId;
    const start = ordered.find((stop) => stop.id === nextStartId)?.color ?? from;
    const end = ordered.find((stop) => stop.id === nextEndId)?.color ?? to;
    onChange({ from: start, to: end, type, stops: ordered.slice(1, -1) });
  }

  return (
    <div className="gradient-editor">
      <div className="gradient-editor-header">
        <span>{label}</span>
        <button type="button" className="mini-button" onClick={addStop}>Add color</button>
      </div>
      {stylePresets.length > 0 && (
        <div className="color-field">
          <span>Style</span>
          <div className="gradient-style-grid">
            {stylePresets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={type === preset.type ? "active" : ""}
                onClick={() =>
                  onChange({
                    from,
                    to,
                    type: preset.type,
                    stops: applyGradientStylePreset(from, to, stops, preset.positions)
                  })
                }
                aria-label={preset.label}
              >
                <span
                  style={{
                    background: gradientCss(
                      from,
                      to,
                      applyGradientStylePreset(from, to, stops, preset.positions),
                      preset.type,
                      `${preset.angle}deg`
                    )
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="gradient-preview" style={{ background: gradientCss(from, to, stops, type) }}>
        {allStops.map((stop) => (
          <span
            key={stop.id}
            className={stop.id === activeStopId ? "gradient-stop-marker active" : "gradient-stop-marker"}
            style={{ left: `${stop.position}%` }}
          />
        ))}
      </div>
      <div className="gradient-chip-region">
        <div className="gradient-chip-row">
          {allStops.map((stop) => (
            <button
              type="button"
              key={stop.id}
              draggable
              className={stop.id === activeStopId ? "color-swatch active" : "color-swatch"}
              style={{ background: stop.color }}
              onClick={() => setActiveStopId((current) => (current === stop.id ? null : stop.id))}
              onDragStart={() => setDraggedStopId(stop.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderStops(stop.id)}
              onDragEnd={() => setDraggedStopId(null)}
              aria-label={`Edit gradient color ${stop.color}`}
            />
          ))}
          <button type="button" className="color-swatch add" onClick={addStop} aria-label="Add gradient color">
            +
          </button>
        </div>
        {activeStopId && (
          <div className="gradient-chip-popover" role="dialog" aria-label="Gradient color">
            <div className="gradient-chip-popover__header">
              <strong>Gradient color</strong>
              <button type="button" className="mini-button" onClick={() => setActiveStopId(null)} aria-label="Close gradient color editor">
                x
              </button>
            </div>
            <SolidColorEditor
              value={allStops.find((stop) => stop.id === activeStopId)?.color ?? from}
              onChange={(value) => updateStop(activeStopId, { color: value })}
            />
            <div className="gradient-stop-inline-grid">
              <label>
                Position
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={allStops.find((stop) => stop.id === activeStopId)?.position ?? 0}
                  disabled={activeStopId === startId || activeStopId === endId}
                  onChange={(event) => updateStop(activeStopId, { position: Number(event.target.value) })}
                />
              </label>
              <label>
                Opacity
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={allStops.find((stop) => stop.id === activeStopId)?.opacity ?? 100}
                  onChange={(event) => updateStop(activeStopId, { opacity: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="gradient-stop-inline-actions">
              <button
                type="button"
                className="secondary compact"
                onClick={() => removeStop(activeStopId)}
                disabled={activeStopId === startId || activeStopId === endId}
              >
                Remove color
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const safeValue = normalizeHexColor(value);

  return (
    <div className="color-field">
      <span>{label}</span>
      <div className="color-field-stack">
        <button
          type="button"
          className="color-chip-button"
          onClick={() => setOpen((current) => !current)}
          aria-label={`Choose ${label}`}
        >
          <span className="color-chip" style={{ background: safeValue }} />
        </button>
        {open && (
          <div className="bar-color-popover simple-color-popover" role="dialog" aria-label={`${label} colors`}>
            <div className="simple-color-popover__header">
              <strong>{label}</strong>
              <button type="button" className="mini-button" onClick={() => setOpen(false)} aria-label={`Close ${label} picker`}>
                x
              </button>
            </div>
            <SolidColorEditor value={safeValue} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

export function SolidColorEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [inputMode, setInputMode] = useState<"hex" | "rgb" | "hsl">("hex");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const safeColor = normalizeHexColor(value);
  const rgb = hexToRgbObject(safeColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const rawHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const hue = rawHsv.s === 0 ? lastSolidPickerHue : rawHsv.h;
  const hsv = { ...rawHsv, h: hue };
  const alpha = colorAlpha(safeColor);

  function updateFromHsv(nextHue: number, nextSaturation: number, nextValue: number) {
    lastSolidPickerHue = nextHue;
    const next = hsvToRgb(nextHue, nextSaturation, nextValue);
    onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
  }

  function updateFromSurface(clientX: number, clientY: number) {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const saturation = ((clientX - bounds.left) / bounds.width) * 100;
    const valueLevel = 100 - ((clientY - bounds.top) / bounds.height) * 100;
    updateFromHsv(hsv.h, Math.max(0, Math.min(100, saturation)), Math.max(0, Math.min(100, valueLevel)));
  }

  async function pickScreenColor() {
    const EyeDropperApi = (globalThis as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropperApi) {
      inputRef.current?.click();
      return;
    }

    try {
      const eyeDropper = new EyeDropperApi();
      const result = await eyeDropper.open();
      onChange(setHexAlpha(normalizeHexColor(result.sRGBHex, safeColor), alpha));
    } catch {
      // Ignore cancel and unsupported cases.
    }
  }

  return (
    <div className="solid-color-editor">
      <div
        ref={surfaceRef}
        className="color-surface"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromSurface(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          updateFromSurface(event.clientX, event.clientY);
        }}
      >
        <span
          className="color-surface__cursor"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`
          }}
        />
      </div>
      <input
        className="hue-slider"
        type="range"
        min="0"
        max="360"
        value={hsv.h}
        style={{ "--range-fill": `${(hsv.h / 360) * 100}%` } as React.CSSProperties}
      onChange={(event) => updateFromHsv(Number(event.target.value), hsv.s, hsv.v)}
      />
      <div className="opacity-control">
        <span>Opacity</span>
        <div className="opacity-control__row">
          <input
            type="range"
            min="0"
            max="100"
            value={alpha}
            style={{ "--range-fill": rangeFill(alpha, 0, 100) } as React.CSSProperties}
            onChange={(event) => onChange(setHexAlpha(safeColor, Number(event.target.value) || 0))}
          />
          <input
            type="number"
            min="0"
            max="100"
            value={alpha}
            onChange={(event) => onChange(setHexAlpha(safeColor, Number(event.target.value) || 0))}
          />
        </div>
      </div>
      <div className="fill-mode-tabs picker input-mode-tabs">
        <button type="button" className={inputMode === "hex" ? "active" : ""} onClick={() => setInputMode("hex")}>HEX</button>
        <button type="button" className={inputMode === "rgb" ? "active" : ""} onClick={() => setInputMode("rgb")}>RGB</button>
        <button type="button" className={inputMode === "hsl" ? "active" : ""} onClick={() => setInputMode("hsl")}>HSL</button>
      </div>
      {inputMode === "hex" && (
        <div className="color-value-row">
          <button type="button" className="color-chip-button static" aria-hidden="true">
            <span className="color-chip" style={{ background: safeColor }} />
          </button>
          <input value={safeColor.toUpperCase()} onChange={(event) => onChange(normalizeHexColor(event.target.value, safeColor))} />
          <button type="button" className="mini-button eyedropper-button" onClick={() => void pickScreenColor()} aria-label="Pick color from screen">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4l6 6m-9.5 9.5L4 20l.5-6.5L14 4l6 6-9.5 9.5ZM12 6l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
      {inputMode === "rgb" && (
        <div className="numeric-triplet">
          <input type="number" min="0" max="255" value={rgb.r} onChange={(event) => onChange(setHexAlpha(rgbToHex(Number(event.target.value) || 0, rgb.g, rgb.b), alpha))} />
          <input type="number" min="0" max="255" value={rgb.g} onChange={(event) => onChange(setHexAlpha(rgbToHex(rgb.r, Number(event.target.value) || 0, rgb.b), alpha))} />
          <input type="number" min="0" max="255" value={rgb.b} onChange={(event) => onChange(setHexAlpha(rgbToHex(rgb.r, rgb.g, Number(event.target.value) || 0), alpha))} />
        </div>
      )}
      {inputMode === "hsl" && (
        <div className="numeric-triplet">
          <input type="number" min="0" max="360" value={hsl.h} onChange={(event) => {
            const nextHue = Number(event.target.value) || 0;
            lastSolidPickerHue = nextHue;
            const next = hslToRgb(nextHue, hsl.s, hsl.l);
            onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
          }} />
          <input type="number" min="0" max="100" value={hsl.s} onChange={(event) => {
            const next = hslToRgb(hsl.h, Number(event.target.value) || 0, hsl.l);
            onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
          }} />
          <input type="number" min="0" max="100" value={hsl.l} onChange={(event) => {
            const next = hslToRgb(hsl.h, hsl.s, Number(event.target.value) || 0);
            onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
          }} />
        </div>
      )}
      <input ref={inputRef} className="sr-only-color-input" type="color" value={stripHexAlpha(safeColor)} onChange={(event) => onChange(setHexAlpha(event.target.value, alpha))} tabIndex={-1} />
    </div>
  );
}

export function BarColorField({
  style,
  onColorChange,
  onFillModeChange,
  onPresetApply,
  onGradientChange
}: {
  style: ReturnType<typeof getBarStyle>;
  onColorChange: (value: string) => void;
  onFillModeChange: (mode: "solid" | "gradient") => void;
  onPresetApply: (preset: (typeof gradientStylePresets)[number]) => void;
  onGradientChange: (updates: { color: string; gradientTo: string; gradientStops: GradientStop[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGradientStopId, setActiveGradientStopId] = useState<string | null>(null);
  const [draggedGradientStopId, setDraggedGradientStopId] = useState<string | null>(null);
  const safeColor = normalizeHexColor(style.color);
  const gradientChips = normalizeGradientStops(style.color, style.gradientTo, style.gradientStops);

  function commitGradientChips(nextChips: GradientStop[]) {
    if (nextChips.length < 2) return;
    const ordered = nextChips.map((chip, index) => ({
      ...chip,
      position: nextChips.length === 1 ? 50 : Math.round((index / (nextChips.length - 1)) * 100)
    }));
    onGradientChange({
      color: ordered[0]?.color ?? style.color,
      gradientTo: ordered[ordered.length - 1]?.color ?? style.gradientTo,
      gradientStops: ordered.slice(1, -1)
    });
  }

  function updateGradientChipColor(id: string, color: string) {
    commitGradientChips(gradientChips.map((chip) => (chip.id === id ? { ...chip, color } : chip)));
  }

  function addGradientChip() {
    const newChip: GradientStop = {
      id: `chip_${Date.now()}`,
      color: style.gradientTo,
      position: 50,
      opacity: 100
    };
    const insertAt = Math.max(1, gradientChips.length - 1);
    const nextChips = [...gradientChips.slice(0, insertAt), newChip, ...gradientChips.slice(insertAt)];
    commitGradientChips(nextChips);
    setActiveGradientStopId(newChip.id);
  }

  function reorderGradientChips(targetId: string) {
    if (!draggedGradientStopId || draggedGradientStopId === targetId) return;
    const fromIndex = gradientChips.findIndex((chip) => chip.id === draggedGradientStopId);
    const toIndex = gradientChips.findIndex((chip) => chip.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...gradientChips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitGradientChips(next);
  }

  return (
    <div className="color-field">
      <span>Bar color</span>
      <div className="color-field-stack">
        <button type="button" className="color-chip-button" onClick={() => setOpen((current) => !current)} aria-label="Choose bar color">
          <span
            className="color-chip"
            style={{
              background:
                style.fillMode === "gradient"
                  ? gradientCss(style.color, style.gradientTo, style.gradientStops, style.gradientType, `${style.gradientAngle}deg`)
                  : safeColor
            }}
          />
        </button>
        {open && (
          <div className="bar-color-popover" role="dialog" aria-label="Bar color">
            <div className="fill-mode-tabs picker">
              <button type="button" className={style.fillMode === "solid" ? "active" : ""} onClick={() => onFillModeChange("solid")}>Solid color</button>
              <button type="button" className={style.fillMode === "gradient" ? "active" : ""} onClick={() => onFillModeChange("gradient")}>Gradient</button>
            </div>
            {style.fillMode === "gradient" ? (
              <>
                <div className="color-field">
                  <span>Gradient colors</span>
                  <div className="gradient-chip-region">
                    <div className="gradient-chip-row">
                      {gradientChips.map((chip) => (
                        <button
                          type="button"
                          key={chip.id}
                          draggable
                          className={chip.id === activeGradientStopId ? "color-swatch active" : "color-swatch"}
                          style={{ background: chip.color }}
                          onClick={() => setActiveGradientStopId((current) => (current === chip.id ? null : chip.id))}
                          onDragStart={() => setDraggedGradientStopId(chip.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => reorderGradientChips(chip.id)}
                          onDragEnd={() => setDraggedGradientStopId(null)}
                          aria-label={`Edit gradient color ${chip.color}`}
                        />
                      ))}
                      <button type="button" className="color-swatch add" onClick={addGradientChip} aria-label="Add gradient color">
                        +
                      </button>
                    </div>
                    {activeGradientStopId && (
                      <div className="gradient-chip-popover" role="dialog" aria-label="Gradient color">
                        <div className="gradient-chip-popover__header">
                          <strong>Gradient color</strong>
                          <button type="button" className="mini-button" onClick={() => setActiveGradientStopId(null)} aria-label="Close gradient color editor">
                            x
                          </button>
                        </div>
                        <SolidColorEditor
                          value={gradientChips.find((chip) => chip.id === activeGradientStopId)?.color ?? safeColor}
                          onChange={(value) => updateGradientChipColor(activeGradientStopId, value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="color-field">
                  <span>Style</span>
                  <div className="gradient-style-grid">
                    {gradientStylePresets.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className={style.gradientType === preset.type && style.gradientAngle === preset.angle ? "active" : ""}
                        onClick={() => onPresetApply(preset)}
                        aria-label={preset.label}
                      >
                        <span
                          style={{
                            background: gradientCss(
                              style.color,
                              style.gradientTo,
                              applyGradientStylePreset(style.color, style.gradientTo, style.gradientStops, preset.positions),
                              preset.type,
                              `${preset.angle}deg`
                            )
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <SolidColorEditor value={safeColor} onChange={onColorChange} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageBackgroundField({
  page,
  onModeChange,
  onSolidChange,
  onGradientChange,
  onPatternChange,
  onImageChange
}: {
  page: DashboardPage;
  onModeChange: (mode: DashboardPage["backgroundMode"]) => void;
  onSolidChange: (value: string) => void;
  onGradientChange: (updates: { from: string; to: string; type: GradientType; angle: number; stops: GradientStop[] }) => void;
  onPatternChange: (pattern: DashboardPage["backgroundPattern"]) => void;
  onImageChange: (updates: Partial<Pick<DashboardPage, "backgroundImage" | "backgroundImageFit">>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGradientStopId, setActiveGradientStopId] = useState<string | null>(null);
  const [draggedGradientStopId, setDraggedGradientStopId] = useState<string | null>(null);
  const gradientChips = normalizeGradientStops(page.gradientFrom, page.gradientTo, page.gradientStops);
  const backgroundPreview =
    page.backgroundMode === "image" && page.backgroundImage
      ? undefined
      : page.backgroundMode === "pattern"
        ? "linear-gradient(90deg, rgba(35, 135, 147, 0.34) 50%, transparent 50%), linear-gradient(rgba(35, 135, 147, 0.34) 50%, transparent 50%), linear-gradient(135deg, #103442, #0b2630)"
      : page.backgroundMode === "gradient"
        ? gradientCss(page.gradientFrom, page.gradientTo, page.gradientStops, page.gradientType, `${page.gradientAngle}deg`)
        : normalizeHexColor(page.background);

  function commitGradientChips(nextChips: GradientStop[]) {
    if (nextChips.length < 2) return;
    const ordered = nextChips.map((chip, index) => ({
      ...chip,
      position: nextChips.length === 1 ? 50 : Math.round((index / (nextChips.length - 1)) * 100)
    }));
    onGradientChange({
      from: ordered[0]?.color ?? page.gradientFrom,
      to: ordered[ordered.length - 1]?.color ?? page.gradientTo,
      type: page.gradientType,
      angle: page.gradientAngle,
      stops: ordered.slice(1, -1)
    });
  }

  function updateGradientChipColor(id: string, color: string) {
    commitGradientChips(gradientChips.map((chip) => (chip.id === id ? { ...chip, color } : chip)));
  }

  function addGradientChip() {
    const newChip: GradientStop = {
      id: `page_chip_${Date.now()}`,
      color: page.gradientTo,
      position: 50,
      opacity: 100
    };
    const insertAt = Math.max(1, gradientChips.length - 1);
    const nextChips = [...gradientChips.slice(0, insertAt), newChip, ...gradientChips.slice(insertAt)];
    commitGradientChips(nextChips);
    setActiveGradientStopId(newChip.id);
  }

  function reorderGradientChips(targetId: string) {
    if (!draggedGradientStopId || draggedGradientStopId === targetId) return;
    const fromIndex = gradientChips.findIndex((chip) => chip.id === draggedGradientStopId);
    const toIndex = gradientChips.findIndex((chip) => chip.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...gradientChips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitGradientChips(next);
  }

  return (
    <div className="color-field">
      <span>Background</span>
      <div className="color-field-stack">
        <button type="button" className="color-chip-button" onClick={() => setOpen((current) => !current)} aria-label="Choose page background">
          <span
            className="color-chip"
            style={{
              background: backgroundPreview,
              backgroundImage:
                page.backgroundMode === "image" && page.backgroundImage
                  ? `url("${page.backgroundImage.replace(/"/g, '\\"')}")`
                  : undefined,
              backgroundSize:
                page.backgroundMode === "pattern"
                  ? "10px 10px, 10px 10px, 100% 100%"
                  : page.backgroundMode === "image"
                  ? page.backgroundImageFit === "fill"
                    ? "100% 100%"
                    : page.backgroundImageFit
                  : undefined,
              backgroundPosition: "center"
            }}
          />
        </button>
        {open && (
          <div className="bar-color-popover" role="dialog" aria-label="Page background">
            <div className="fill-mode-tabs picker input-mode-tabs">
              <button type="button" className={page.backgroundMode === "solid" ? "active" : ""} onClick={() => onModeChange("solid")}>Solid</button>
              <button type="button" className={page.backgroundMode === "gradient" ? "active" : ""} onClick={() => onModeChange("gradient")}>Gradient</button>
              <button type="button" className={page.backgroundMode === "pattern" ? "active" : ""} onClick={() => onModeChange("pattern")}>Pattern</button>
              <button type="button" className={page.backgroundMode === "image" ? "active" : ""} onClick={() => onModeChange("image")}>Image</button>
            </div>
            {page.backgroundMode === "gradient" ? (
              <>
                <div className="color-field">
                  <span>Gradient colors</span>
                  <div className="gradient-chip-region">
                    <div className="gradient-chip-row">
                      {gradientChips.map((chip) => (
                        <button
                          type="button"
                          key={chip.id}
                          draggable
                          className={chip.id === activeGradientStopId ? "color-swatch active" : "color-swatch"}
                          style={{ background: chip.color }}
                          onClick={() => setActiveGradientStopId((current) => (current === chip.id ? null : chip.id))}
                          onDragStart={() => setDraggedGradientStopId(chip.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => reorderGradientChips(chip.id)}
                          onDragEnd={() => setDraggedGradientStopId(null)}
                          aria-label={`Edit gradient color ${chip.color}`}
                        />
                      ))}
                      <button type="button" className="color-swatch add" onClick={addGradientChip} aria-label="Add gradient color">
                        +
                      </button>
                    </div>
                    {activeGradientStopId && (
                      <div className="gradient-chip-popover" role="dialog" aria-label="Gradient color">
                        <div className="gradient-chip-popover__header">
                          <strong>Gradient color</strong>
                          <button type="button" className="mini-button" onClick={() => setActiveGradientStopId(null)} aria-label="Close gradient color editor">
                            x
                          </button>
                        </div>
                        <SolidColorEditor
                          value={gradientChips.find((chip) => chip.id === activeGradientStopId)?.color ?? page.gradientFrom}
                          onChange={(value) => updateGradientChipColor(activeGradientStopId, value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="color-field">
                  <span>Style</span>
                  <div className="gradient-style-grid">
                    {gradientStylePresets.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className={page.gradientType === preset.type && page.gradientAngle === preset.angle ? "active" : ""}
                        onClick={() =>
                          onGradientChange({
                            from: page.gradientFrom,
                            to: page.gradientTo,
                            type: preset.type,
                            angle: preset.angle,
                            stops: applyGradientStylePreset(page.gradientFrom, page.gradientTo, page.gradientStops, preset.positions)
                          })
                        }
                        aria-label={preset.label}
                      >
                        <span
                          style={{
                            background: gradientCss(
                              page.gradientFrom,
                              page.gradientTo,
                              applyGradientStylePreset(page.gradientFrom, page.gradientTo, page.gradientStops, preset.positions),
                              preset.type,
                              `${preset.angle}deg`
                            )
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : page.backgroundMode === "pattern" ? (
              <div className="color-field">
                <span>Pattern</span>
                <div className="background-pattern-grid">
                  <button
                    type="button"
                    className={page.backgroundPattern === "teal_grid" ? "active" : ""}
                    onClick={() => onPatternChange("teal_grid")}
                  >
                    <span
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(35, 135, 147, 0.34) 50%, transparent 50%), linear-gradient(rgba(35, 135, 147, 0.34) 50%, transparent 50%), linear-gradient(135deg, #103442, #0b2630)",
                        backgroundSize: "18px 18px, 18px 18px, 100% 100%"
                      }}
                    />
                    Teal grid
                  </button>
                </div>
              </div>
            ) : page.backgroundMode === "image" ? (
              <div className="color-field">
                <span>Background image</span>
                <div className="modal-control-stack compact">
                  <label>
                    Image URL
                    <input
                      type="url"
                      placeholder="https://..."
                      value={page.backgroundImage}
                      onChange={(event) => onImageChange({ backgroundImage: event.target.value })}
                    />
                  </label>
                  <label>
                    Image fit
                    <select
                      value={page.backgroundImageFit}
                      onChange={(event) => onImageChange({ backgroundImageFit: event.target.value as DashboardPage["backgroundImageFit"] })}
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Stretch</option>
                    </select>
                  </label>
                  {page.backgroundImage && (
                    <div
                      className="page-background-preview"
                      style={{
                        backgroundImage: `url("${page.backgroundImage.replace(/"/g, '\\"')}")`,
                        backgroundSize: page.backgroundImageFit === "fill" ? "100% 100%" : page.backgroundImageFit,
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat"
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <SolidColorEditor value={page.background} onChange={onSolidChange} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function rangeFill(value: number | string, min: number, max: number) {
  const numericValue = Number(value);
  const percentage = ((numericValue - min) / (max - min)) * 100;
  return `${Math.min(100, Math.max(0, percentage))}%`;
}
