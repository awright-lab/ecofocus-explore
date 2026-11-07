/** A bounded viewport, independent of the logical number of remote fields. */
export function fieldTreeWindow(total: number, scrollTop: number, rowHeight: number, viewportHeight: number, overscan: number) {
  const start = Math.min(Math.max(0, total - 1), Math.max(0, Math.floor((Number.isFinite(scrollTop) ? scrollTop : 0) / rowHeight) - overscan));
  const end = Math.min(total, start + Math.ceil(viewportHeight / rowHeight) + overscan * 2);
  return { start, end };
}
