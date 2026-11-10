import { sav, concat, numeric } from "./savCaseFixture";
function integer(value: number) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setInt32(0, value, true); return bytes; }
export function savNumbers(values: number[], options: { compression?: number; missing?: number; labels?: Array<[number, string]>; infoSize?: number; infoCount?: number } = {}) {
  const compression = options.compression ?? 0;
  const plain = sav(0, values.length, concat(...values.flatMap((value, index) => [numeric(index + 1), numeric(value)])));
  // Two 32-byte numeric variable records follow the 176-byte header.
  const prefix = new Uint8Array(plain).slice(0, 240);
  new DataView(prefix.buffer).setInt32(72, compression, true);
  const labels = options.labels?.length ? concat(integer(3), integer(options.labels.length), ...options.labels.flatMap(([value, label]) => {
    const text = new TextEncoder().encode(label), padded = new Uint8Array(Math.ceil((text.length + 1) / 8) * 8); padded[0] = text.length; padded.set(text, 1); return [numeric(value), padded];
  }), integer(4), integer(1), integer(2)) : new Uint8Array();
  const info = options.missing === undefined ? new Uint8Array() : concat(integer(7), integer(4), integer(options.infoSize ?? 8), integer(options.infoCount ?? 3), numeric(options.missing), numeric(Number.MAX_VALUE), numeric(-Number.MAX_VALUE));
  let data = new Uint8Array(plain).slice(248);
  if (compression === 1) {
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < values.length; offset += 4) {
      const controls = new Uint8Array(8), raw: Uint8Array[] = [];
      values.slice(offset, offset + 4).forEach((value, index) => { controls[index * 2] = controls[index * 2 + 1] = 253; raw.push(numeric(offset + index + 1), numeric(value)); });
      chunks.push(controls, ...raw);
    }
    data = concat(...chunks);
  }
  return concat(prefix, labels, info, integer(999), integer(0), data).buffer;
}
