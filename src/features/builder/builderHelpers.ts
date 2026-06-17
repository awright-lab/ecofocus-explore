import type { DashboardPage, GradientStop, GradientType, PageThemePreset } from "../../../shared/types/dashboard";

export function makeGradientStop(color: string, position: number): GradientStop {
  return {
    id: `stop_${position}_${color.replace("#", "")}`,
    color,
    position,
    opacity: 100
  };
}

export function normalizeHexColor(value: string | null | undefined, fallback = "#000000") {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((item) => item + item).join("")}`;
  }
  if (/^#[0-9a-f]{4}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((item) => item + item).join("")}`;
  }
  return fallback;
}

export function hexToRgbObject(value: string) {
  const hex = normalizeHexColor(value);
  const normalized = hex.slice(1);
  const rgb = normalized.slice(0, 6);
  const alpha = normalized.length === 8 ? normalized.slice(6, 8) : "ff";
  const parsed = Number.parseInt(rgb, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
    a: Math.round((Number.parseInt(alpha, 16) / 255) * 100)
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function setHexAlpha(value: string, alpha: number) {
  const base = normalizeHexColor(value).slice(1, 7);
  const normalizedAlpha = Math.max(0, Math.min(100, Math.round(alpha)));
  if (normalizedAlpha >= 100) return `#${base}`;
  const alphaHex = Math.round((normalizedAlpha / 100) * 255).toString(16).padStart(2, "0");
  return `#${base}${alphaHex}`;
}

export function colorAlpha(value: string) {
  return hexToRgbObject(value).a;
}

export function stripHexAlpha(value: string) {
  return `#${normalizeHexColor(value).slice(1, 7)}`;
}

export function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  return {
    h: Math.round((hue * 60 + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

export function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) [red, green, blue] = [chroma, x, 0];
  else if (sector < 2) [red, green, blue] = [x, chroma, 0];
  else if (sector < 3) [red, green, blue] = [0, chroma, x];
  else if (sector < 4) [red, green, blue] = [0, x, chroma];
  else if (sector < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  const match = lightness - chroma / 2;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

export function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }

  return {
    h: Math.round((hue * 60 + 360) % 360),
    s: max === 0 ? 0 : Math.round((delta / max) * 100),
    v: Math.round(max * 100)
  };
}

export function hsvToRgb(h: number, s: number, v: number) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const chroma = value * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) [red, green, blue] = [chroma, x, 0];
  else if (sector < 2) [red, green, blue] = [x, chroma, 0];
  else if (sector < 3) [red, green, blue] = [0, chroma, x];
  else if (sector < 4) [red, green, blue] = [0, x, chroma];
  else if (sector < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  const match = value - chroma;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

export function normalizeGradientStops(from: string, to: string, stops?: GradientStop[]) {
  const normalizedStops = (stops ?? [])
    .map((stop) => ({
      ...stop,
      position: Math.min(100, Math.max(0, Number(stop.position) || 0)),
      opacity: Math.min(100, Math.max(0, Number(stop.opacity ?? 100)))
    }))
    .sort((first, second) => first.position - second.position);

  const hasStart = normalizedStops.some((stop) => stop.position === 0);
  const hasEnd = normalizedStops.some((stop) => stop.position === 100);

  return [
    ...(hasStart ? [] : [makeGradientStop(from, 0)]),
    ...normalizedStops,
    ...(hasEnd ? [] : [makeGradientStop(to, 100)])
  ].sort((first, second) => first.position - second.position);
}

export function protectedGradientEndpointIds(stops: GradientStop[]) {
  const startId = stops.find((stop) => stop.position === 0)?.id;
  const endId = [...stops].reverse().find((stop) => stop.position === 100)?.id;
  return { startId, endId };
}

export function sampleGradientPositions(template: number[], count: number) {
  if (count <= 1) return [50];
  if (template.length === count) return template;

  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const scaled = t * (template.length - 1);
    const leftIndex = Math.floor(scaled);
    const rightIndex = Math.ceil(scaled);
    const left = template[leftIndex] ?? template[0] ?? 0;
    const right = template[rightIndex] ?? template[template.length - 1] ?? 100;
    const blend = scaled - leftIndex;
    return Math.round(left + (right - left) * blend);
  });
}

export function applyGradientStylePreset(from: string, to: string, stops: GradientStop[] | undefined, positions: number[]) {
  const normalized = normalizeGradientStops(from, to, stops);
  const mappedPositions = sampleGradientPositions(positions, normalized.length);

  return normalized.map((stop, index) => ({
    ...stop,
    position: mappedPositions[index] ?? stop.position
  }));
}

export function stopColorCss(stop: GradientStop) {
  const { r, g, b, a } = hexToRgbObject(stop.color);
  return `rgba(${r}, ${g}, ${b}, ${(a / 100) * (stop.opacity / 100)})`;
}

export function gradientCss(from: string, to: string, stops?: GradientStop[], type: GradientType = "linear", angle = "90deg") {
  const stopList = normalizeGradientStops(from, to, stops).map((stop) => `${stopColorCss(stop)} ${stop.position}%`).join(", ");
  if (type === "radial") return `radial-gradient(circle at center, ${stopList})`;
  if (type === "conic") return `conic-gradient(from 90deg, ${stopList})`;
  return `linear-gradient(${angle}, ${stopList})`;
}

export function svgLinearGradientVector(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  return {
    x1: `${50 - x * 50}%`,
    y1: `${50 - y * 50}%`,
    x2: `${50 + x * 50}%`,
    y2: `${50 + y * 50}%`
  };
}

export function backgroundStyle(mode: "solid" | "gradient", solid: string, gradientFrom: string, gradientTo: string, gradientStops?: GradientStop[], gradientType: GradientType = "linear") {
  return mode === "gradient" ? gradientCss(gradientFrom, gradientTo, gradientStops, gradientType, "135deg") : solid;
}

export function themePreviewBackground(theme?: PageThemePreset) {
  if (!theme) return "#ffffff";
  return theme.backgroundMode === "gradient"
    ? gradientCss(theme.gradientFrom, theme.gradientTo, theme.gradientStops, theme.gradientType, `${theme.gradientAngle}deg`)
    : theme.background;
}

export function hexToRgb(color: string) {
  const normalized = color.replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized;
  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return "20, 32, 25";
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function effectShadow(style: {
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  glow: boolean;
  glowColor: string;
  glowSize: number;
}) {
  const effects: string[] = [];

  if (style.shadow) {
    effects.push(`${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px rgba(${hexToRgb(style.shadowColor)}, ${style.shadowOpacity / 100})`);
  }

  if (style.glow) {
    effects.push(`0 0 ${style.glowSize}px rgba(${hexToRgb(style.glowColor)}, 0.42)`);
  }

  return effects.length ? effects.join(", ") : undefined;
}

export function pageBackgroundLayer(page: DashboardPage) {
  if (page.backgroundMode === "gradient") {
    return gradientCss(page.gradientFrom, page.gradientTo, page.gradientStops, page.gradientType, `${page.gradientAngle}deg`);
  }

  if (page.backgroundMode === "image" && page.backgroundImage) {
    return `url("${page.backgroundImage.replace(/"/g, '\\"')}")`;
  }

  return page.background;
}

export function canvasBackground(page: DashboardPage) {
  const pageBackground = pageBackgroundLayer(page);

  if (!page.showCanvasGrid) return pageBackground;

  return `linear-gradient(#eef3eb 1px, transparent 1px), linear-gradient(90deg, #eef3eb 1px, transparent 1px), ${pageBackground}`;
}

export function canvasBackgroundSize(page: DashboardPage) {
  const finalSize =
    page.backgroundMode === "image"
      ? page.backgroundImageFit === "fill"
        ? "100% 100%"
        : page.backgroundImageFit
      : "100% 100%";

  if (!page.showCanvasGrid) return finalSize;

  return `${page.gridSize}px ${page.gridSize}px, ${page.gridSize}px ${page.gridSize}px, ${finalSize}`;
}

export function canvasBackgroundRepeat(page: DashboardPage) {
  const finalRepeat = page.backgroundMode === "image" ? "no-repeat" : "no-repeat";

  if (!page.showCanvasGrid) return finalRepeat;

  return `repeat, repeat, ${finalRepeat}`;
}

export function canvasBackgroundPosition(page: DashboardPage) {
  const finalPosition = page.backgroundMode === "image" ? "center center" : "0 0";

  if (!page.showCanvasGrid) return finalPosition;

  return `0 0, 0 0, ${finalPosition}`;
}
