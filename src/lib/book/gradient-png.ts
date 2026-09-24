/**
 * A tiny PNG encoder for one thing: a vertical alpha ramp in a single colour.
 *
 * PDF has no gradient primitive pdf-lib exposes, and the cover scrim used to
 * be faked with stacked translucent bands. Each band overlapped the next by
 * half a point so no light seam showed, but overlapping translucency doubles
 * up, so every seam printed as a darker stripe instead. One embedded image,
 * stretched over the scrim, is a real ramp with nothing to line up.
 *
 * Hand-encoded rather than pulled from a library because it has to run in the
 * browser (where the PDF is built) and in node (where it is tested), and the
 * image is small enough that uncompressed ("stored") deflate blocks are fine.
 */

export type AlphaStop = { at: number; alpha: number };

/** Opacity at `t` (0 = bottom, 1 = top) along piecewise-linear stops. */
export function alphaAt(stops: AlphaStop[], t: number): number {
  if (t <= stops[0]!.at) return stops[0]!.alpha;
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const next = stops[index]!;
    if (t <= next.at) {
      const span = next.at - previous.at || 1;
      return previous.alpha + ((t - previous.at) / span) * (next.alpha - previous.alpha);
    }
  }
  return stops.at(-1)!.alpha;
}

/**
 * A 1-pixel-wide RGBA PNG, `height` rows tall, top row first. `color` is
 * 0..1 RGB; alpha follows `stops`, where 0 is the bottom row.
 */
export function verticalAlphaRampPng(
  color: { r: number; g: number; b: number },
  stops: AlphaStop[],
  height = 256,
): Uint8Array {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  // Each scanline: filter byte 0, then one RGBA pixel.
  const raw = new Uint8Array(height * 5);
  for (let row = 0; row < height; row += 1) {
    const t = 1 - row / (height - 1);
    const offset = row * 5;
    raw[offset] = 0;
    raw[offset + 1] = r;
    raw[offset + 2] = g;
    raw[offset + 3] = b;
    raw[offset + 4] = Math.round(Math.min(1, Math.max(0, alphaAt(stops, t))) * 255);
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 1); // width
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

function zlibStored(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 65535;
  for (let start = 0; start < data.length || start === 0; start += MAX) {
    const end = Math.min(start + MAX, data.length);
    const length = end - start;
    const final = end >= data.length ? 1 : 0;
    parts.push(
      new Uint8Array([final, length & 0xff, length >> 8, ~length & 0xff, (~length >> 8) & 0xff]),
      data.subarray(start, end),
    );
    if (final) break;
  }
  const adler = adler32(data);
  parts.push(
    new Uint8Array([(adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff]),
  );
  return concat(parts);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
