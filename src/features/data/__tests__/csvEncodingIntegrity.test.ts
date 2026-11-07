import { describe, expect, it } from 'vitest';
import { importDatasetBuffer } from '../datasetImportModel';
function utf16(text: string, bigEndian = false) {
  const bytes = new Uint8Array(2 + text.length * 2), view = new DataView(bytes.buffer);
  view.setUint16(0, 0xfeff, !bigEndian);
  for (let index = 0; index < text.length; index += 1) view.setUint16(2 + index * 2, text.charCodeAt(index), !bigEndian);
  return bytes;
}
const parse = (bytes: Uint8Array) => importDatasetBuffer(bytes.buffer as ArrayBuffer, 'synthetic_encoding.csv');
describe('CSV encoding integrity', () => {
  it.each([false, true])('reads BOM-marked UTF-16 with exact Unicode text (bigEndian=%s)', async bigEndian => {
    const result = await parse(utf16('Region,Value\r\nCaf\u00e9 \u96ea \ud83c\udf0d,10\r\n', bigEndian));
    expect(result.error).toBeUndefined(); expect(result.dataset?.rows).toEqual([{ Region: 'Caf\u00e9 \u96ea \ud83c\udf0d', Value: '10' }]);
    expect(result.dataset?.importMetadata?.parserNotes.join(' ')).toContain(bigEndian ? 'UTF-16BE' : 'UTF-16LE');
  });
  it.each([false, true])('retains valid UTF-8 with or without BOM (%s)', async bom => {
    const bytes = new TextEncoder().encode(`${bom ? '\ufeff' : ''}Region,Value\nCaf\u00e9 \u96ea,10\n`);
    const result = await parse(bytes); expect(result.error).toBeUndefined(); expect(result.dataset?.rows).toEqual([{ Region: 'Caf\u00e9 \u96ea', Value: '10' }]);
  });
  it('keeps a genuinely encoded replacement character as source text', async () => {
    const result = await parse(new TextEncoder().encode('Region,Value\n\ufffd,10\n'));
    expect(result.error).toBeUndefined(); expect(result.dataset?.rows[0].Region).toBe('\ufffd');
  });
  it.each([
    new Uint8Array([65, 10, 0xe9, 10]), // Windows-1252 byte cannot be inferred as UTF-8.
    new Uint8Array([65, 10, 0xc3]), // Truncated UTF-8.
    new Uint8Array([0xff, 0xfe, 65]), // Truncated UTF-16 unit.
    new Uint8Array([0xfe, 0xff, 0, 65, 0, 10, 0xd8, 0]), // Unpaired surrogate.
    new Uint8Array([0xff, 0xfe, 0, 0, 65, 0, 0, 0]), // UTF-32LE BOM.
    new Uint8Array([0, 0, 0xfe, 0xff, 0, 0, 0, 65]), // UTF-32BE BOM.
    new TextEncoder().encode('Region,Value\nA\0B,10\n'),
  ])('rejects undecodable or unsupported text rather than replacing bytes', async bytes => {
    const result = await parse(bytes); expect(result.dataset).toBeUndefined(); expect(result.error).toContain('UTF-8');
  });
});
