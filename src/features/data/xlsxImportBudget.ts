export interface XlsxImportLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxPartBytes: number;
  maxDecodedBytes: number;
}

export const defaultXlsxImportLimits: Readonly<XlsxImportLimits> = Object.freeze({
  maxArchiveBytes: 32 * 1024 * 1024,
  maxEntries: 4096,
  maxPartBytes: 32 * 1024 * 1024,
  maxDecodedBytes: 64 * 1024 * 1024,
});

export function validateXlsxImportLimits(limits: XlsxImportLimits) {
  for (const key of Object.keys(defaultXlsxImportLimits) as Array<keyof XlsxImportLimits>) {
    if (!limits || !Object.hasOwn(limits,key) || !Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > defaultXlsxImportLimits[key]) {
      throw new Error("Invalid XLSX safety limits. No study was imported.");
    }
  }
}

export function xlsxLimitError(scope: string) {
  return new Error(`This workbook exceeds the XLSX ${scope} limit. Split the workbook or export the required sheet as CSV; the original file was not changed and no study was imported.`);
}

/** Bounds the application-owned decoded buffer, not opaque decoder/DOM memory. */
export async function readBoundedXlsxPart(stream: ReadableStream<Uint8Array>, expectedSize: number, maxBytes: number) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < 0 || expectedSize > maxBytes) throw xlsxLimitError("decoded part");
  const reader = stream.getReader();
  try {
    const output = new Uint8Array(expectedSize);
    let offset = 0;
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      if (!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT !== 1 || value.byteLength > expectedSize - offset) {
        throw new Error("XLSX ZIP integrity check failed: decoded output exceeds its declared size or is not a byte stream. No study was imported.");
      }
      output.set(value,offset);
      offset += value.byteLength;
    }
    if (offset !== expectedSize) throw new Error("XLSX ZIP integrity check failed: the decoded part is incomplete. No study was imported.");
    return output;
  } catch (error) {
    // Cancellation is requested immediately. A rejected or never-settling source
    // cancellation must not replace the original error or strand the import UI.
    try { void reader.cancel(error).catch(()=>{}); } catch { /* Keep original failure. */ }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
