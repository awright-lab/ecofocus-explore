import { textLineAdvance } from "./textLineSpacing";
import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import { narrativeDisplayText } from "../narratives/narrativeEvidence";
import { analysisTileSvg, completeLines } from "./analysisVisualExport";
import type {
  DashboardCanvasElement,
  DashboardPage,
  DashboardTile,
} from "../../../shared/types/dashboard";

export interface PageVisualImage {
  pageId: string;
  title: string;
  dataUrl: string;
}

export interface PageVisualRenderOptions {
  includeElement?: (element: DashboardCanvasElement) => boolean;
  includeTile?: (tile: DashboardTile) => boolean;
  includeTileBody?: (tile: DashboardTile) => boolean;
  rasterizeSvg?: SvgRasterizer;
}

export type SvgRasterizer = (svg: string, width: number, height: number) => Promise<string>;

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatValue(value: number | undefined) {
  if (typeof value !== "number") return "";
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function wrapLines(value: string, maxChars: number, maxLines = 3) {
  return completeLines(value, maxChars, maxLines);
}

function textLines(
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 700,
  anchor: "start" | "middle" | "end" = "start",
  fontFamily = "Inter, Arial, sans-serif",
) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * size * 1.24}" fill="${escapeXml(color)}" font-family="${escapeXml(fontFamily)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function elementSvg(element: DashboardCanvasElement) {
  const { x, y, width, height } = element.layout;
  if (element.type === "text") {
    const linked=element.evidence!==undefined,size=element.style.fontSize,padding=element.style.padding;
    if(linked&&(![x,y,width,height,size,padding].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||x+width>canvasWidth||y+height>canvasHeight||size<7||size>144||padding<0||width-padding*2<size*1.1))throw new Error("Keep linked text and its citations inside the page with a valid readable font size and padding before exporting.");
    // Missing legacy spacing keeps its previous SVG default without rewriting it.
    const spacing=element.style.lineHeight===undefined?(linked?1.45:1.24):element.style.lineHeight;
    const advance=textLineAdvance(size,spacing),lineBox=Math.max(size,advance);
    if(!Number.isFinite(height)||!Number.isFinite(padding)||padding<0||height<=padding*2)throw new Error("Canvas text height cannot fit completely. Enlarge the text object before export.");
    // Cover only floating arithmetic roundoff, not a pixel-sized fit margin.
    const tolerance=Number.EPSILON*Math.max(Math.abs(height),Math.abs(padding*2),lineBox)*8;
    const capacity=Math.floor((height-padding*2+tolerance)/lineBox);
    if(!Number.isSafeInteger(capacity)||capacity<1)throw new Error("Canvas text height cannot fit completely. Enlarge the text object before export.");
    const lines = wrapLines(
      narrativeDisplayText(element),
      linked?Math.max(1,Math.floor((width-padding*2)/(size*1.1))):Math.max(
        12,
        Math.floor(width / Math.max(element.style.fontSize * 0.48, 6)),
      ),
      capacity,
    );
    if (lines.length * lineBox + padding * 2 > height+tolerance) throw new Error("Canvas text height cannot fit completely. Enlarge the text object before export.");
    const anchor =
      element.style.textAlign === "center"
        ? "middle"
        : element.style.textAlign === "right"
          ? "end"
          : "start";
    const textX =
      element.style.textAlign === "center"
        ? x + width / 2
        : element.style.textAlign === "right"
          ? x + width - element.style.padding
          : x + element.style.padding;
    const background =
      element.style.fill === "transparent"
        ? ""
        : `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${element.style.borderRadius}" fill="${escapeXml(element.style.fill)}" opacity="${element.style.opacity / 100}"/>`;
    const border =
      element.style.borderStyle === "none" || element.style.borderWidth <= 0
        ? ""
        : `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${element.style.borderRadius}" fill="none" stroke="${escapeXml(element.style.borderColor)}" stroke-width="${element.style.borderWidth}"/>`;
    const rendered=lines.map((line,index)=>textLines([line],textX,y+padding+size+index*advance,size,element.style.textColor,Number(element.style.fontWeight)||700,anchor,element.style.fontFamily)).join("");
    return `${background}${border}${rendered}`;
  }
  if (element.type === "circle") {
    return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${escapeXml(element.style.fill)}" stroke="${escapeXml(element.style.borderColor)}" stroke-width="${element.style.borderWidth}" opacity="${element.style.opacity / 100}"/>`;
  }
  if (element.type === "image") {
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(element.content)) throw new Error("Embed this image as PNG/JPEG/WebP before exporting; external or unsupported images are not replaced with placeholders.");
    return `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${escapeXml(element.content)}" preserveAspectRatio="${element.style.objectFit === "fill" ? "none" : element.style.objectFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}" opacity="${element.style.opacity / 100}"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${element.style.borderRadius}" fill="${escapeXml(element.style.fill)}" stroke="${escapeXml(element.style.borderColor)}" stroke-width="${element.style.borderWidth}" opacity="${element.style.opacity / 100}"/>`;
}

function gradientDefinition(page: DashboardPage) {
  const stops = page.gradientStops.length
    ? [...page.gradientStops].sort((a, b) => a.position - b.position)
    : [
        { id: "from", color: page.gradientFrom, position: 0, opacity: 100 },
        { id: "to", color: page.gradientTo, position: 100, opacity: 100 },
      ];
  const stopXml = stops
    .map(
      (stop) =>
        `<stop offset="${stop.position}%" stop-color="${escapeXml(stop.color)}" stop-opacity="${Math.max(0, Math.min(100, stop.opacity)) / 100}"/>`,
    )
    .join("");
  if (page.gradientType === "radial") {
    return `<radialGradient id="pageGradient" cx="50%" cy="50%" r="75%">${stopXml}</radialGradient>`;
  }
  return `<linearGradient id="pageGradient" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${page.gradientAngle || 0} 0.5 0.5)">${stopXml}</linearGradient>`;
}

function pageBackgroundSvg(page: DashboardPage) {
  const hasGradient =
    page.backgroundMode === "gradient" || page.backgroundMode === "pattern";
  const baseFill = hasGradient ? "url(#pageGradient)" : page.background;
  const definitions = hasGradient ? gradientDefinition(page) : "";
  const patternDefinition =
    page.backgroundPattern !== "none"
      ? `<pattern id="pagePattern" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="transparent"/><path d="M36 0H0V36" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/></pattern>`
      : "";
  if (page.backgroundMode === "image" && page.backgroundImage && !/^data:image\/(png|jpeg|webp);base64,/i.test(page.backgroundImage)) throw new Error("Embed the page background image before exporting.");
  const backgroundImage = page.backgroundMode === "image" && page.backgroundImage ? `<image width="${canvasWidth}" height="${canvasHeight}" href="${escapeXml(page.backgroundImage)}" preserveAspectRatio="${page.backgroundImageFit === "fill" ? "none" : page.backgroundImageFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}"/>` : "";
  const defs =
    definitions || patternDefinition
      ? `<defs>${definitions}${patternDefinition}</defs>`
      : "";
  if (page.backgroundPattern !== "none") {
    return `${defs}<rect width="${canvasWidth}" height="${canvasHeight}" fill="${escapeXml(baseFill)}"/>${backgroundImage}<rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#pagePattern)"/>`;
  }
  return `${defs}<rect width="${canvasWidth}" height="${canvasHeight}" fill="${escapeXml(baseFill)}"/>${backgroundImage}`;
}

export interface PageVisualFailure { objectId?: string; objectName?: string; message: string }

function pageVisualSvg(
  page: DashboardPage,
  options: PageVisualRenderOptions = {},
  onFailure?: (failure: PageVisualFailure) => void,
) {
  function render<T>(object: DashboardCanvasElement | DashboardTile | undefined, draw: () => T): T | null {
    try { return draw(); }
    catch (error) {
      if (!onFailure) throw error;
      const objectName=object&&"title"in object?object.title||object.name:object?.name;
      onFailure({ objectId:object?.id, objectName, message: error instanceof Error && !(error instanceof TypeError) ? error.message : "This object could not be reconstructed for PDF. Review its properties and recorded analysis." });
      return null;
    }
  }
  const objects = [
    ...page.elements
      .filter(
        (element) =>
          !element.hidden &&
          (options.includeElement ? options.includeElement(element) : true),
      )
      .map((element) => render(element,()=>({z:element.layout.zIndex,svg:elementSvg(element)}))),
    ...page.tiles
      .filter(
        (tile) =>
          !tile.hidden &&
          (options.includeTile ? options.includeTile(tile) : true),
      )
      .map((tile) => render(tile,()=>({z:tile.layout.zIndex,svg:analysisTileSvg(tile,options.includeTileBody?options.includeTileBody(tile):true)}))),
  ].filter((object): object is {z:number;svg:string}=>object!==null).sort((a, b) => a.z - b.z);

  const background=render(undefined,()=>pageBackgroundSvg(page));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">${background??''}${objects.map((object) => object.svg).join("")}</svg>`;
}

export function buildPageVisualSvg(page: DashboardPage, options: PageVisualRenderOptions = {}) {
  return pageVisualSvg(page,options);
}

/** Read-only diagnostic pass using the actual renderers once per object. A page
 * with any rendering failure never exposes its partial drawing as a preview. */
export function inspectPageVisualSvg(page: DashboardPage): { svg: string | null; failures: PageVisualFailure[] } {
  const failures: PageVisualFailure[]=[];
  try { const svg=pageVisualSvg(page,{},failure=>failures.push(failure));return {svg:failures.length?null:svg,failures}; }
  catch (error) { failures.push({message:error instanceof Error&&!(error instanceof TypeError)?error.message:"This page could not be reconstructed for PDF. Review its objects and analysis results."});return {svg:null,failures}; }
}

export async function renderPageVisualImages(
  pages: DashboardPage[],
  options: PageVisualRenderOptions = {},
): Promise<PageVisualImage[]> {
  const sortedPages = [...pages].sort((a, b) => a.order - b.order);
  const images = await Promise.all(
    sortedPages.map(async (page) => {
      const svg = buildPageVisualSvg(page, options);
      if (options.rasterizeSvg) return { pageId: page.id, title: page.title, dataUrl: await options.rasterizeSvg(svg, canvasWidth * 2, canvasHeight * 2) };
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const nextImage = new Image();
          nextImage.onload = () => resolve(nextImage);
          nextImage.onerror = () =>
            reject(new Error(`Unable to render page ${page.title}`));
          nextImage.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth * 2;
        canvas.height = canvasHeight * 2;
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("Canvas rendering is not available for export.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return {
          pageId: page.id,
          title: page.title,
          dataUrl: canvas.toDataURL("image/jpeg", 0.92),
        };
      } finally {
        URL.revokeObjectURL(url);
      }
    }),
  );
  return images;
}

export function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
