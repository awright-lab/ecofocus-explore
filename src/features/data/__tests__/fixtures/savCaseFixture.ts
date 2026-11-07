export function concat(...parts: Uint8Array[]) { const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; } return bytes; }
function integer(value: number) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setInt32(0, value, true); return bytes; }
export function numeric(value: number) { const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, value, true); return bytes; }
function variable(name: string) { const label = new Uint8Array(8); label.set(new TextEncoder().encode(name)); return concat(integer(2), integer(0), integer(0), integer(0), integer(5), integer(5), label); }
export function sav(compression = 0, count = 3, data?: Uint8Array) {
  const header = new Uint8Array(176), view = new DataView(header.buffer);
  header.set(new TextEncoder().encode("$FL2")); view.setInt32(64, 2, true); view.setInt32(68, 2, true); view.setInt32(72, compression, true); view.setInt32(80, count, true); view.setFloat64(84, 100, true);
  const rows = data ?? (compression === 1 ? new Uint8Array([101, 110, 102, 120, 103, 130, 252, 0]) : concat(...[1, 10, 2, 20, 3, 30].map(numeric)));
  return concat(header, variable("ID"), variable("AMOUNT"), integer(999), integer(0), rows).buffer;
}
export const expected = [{ ID: "1", AMOUNT: "10" }, { ID: "2", AMOUNT: "20" }, { ID: "3", AMOUNT: "30" }];
