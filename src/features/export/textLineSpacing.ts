/** Authored canvas pixel advance; this is not browser/font glyph measurement. */
export function textLineAdvance(fontSize: number, lineHeight: number) {
 const advance = fontSize * lineHeight;
 if (![fontSize, lineHeight, advance].every(Number.isFinite) || fontSize <= 0 || lineHeight <= 0 || advance <= 0)
  throw Error("Text font size and line height must be positive finite values before exporting.");
 return advance;
}
/** DrawingML spcPts uses hundredths of a point; the writer uses75per canvas px. */
export function pptxTextLineSpacing(fontSize: number, lineHeight: number) {
 const points = Math.round(textLineAdvance(fontSize, lineHeight) * 75);
 if (!Number.isSafeInteger(points) || points < 1 || points > 158400)
  throw Error("Text line spacing cannot be represented in PowerPoint. Review its font size and line height before exporting.");
 return points;
}
