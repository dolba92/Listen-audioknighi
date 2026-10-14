/** Reads Nero/QuickTime `chpl` chapter atoms without loading the whole audiobook into memory. */
export type AudioChapter = { title: string; start: number };

const decoder = new TextDecoder('utf-8');
const ascii = (bytes: Uint8Array, offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
const integer = (view: DataView, offset: number, length: number) => {
  let value = 0;
  for (let i = 0; i < length; i++) value = value * 256 + view.getUint8(offset + i);
  return value;
};

export async function readM4bChapters(file: Blob): Promise<AudioChapter[]> {
  if (!file.size) return [];
  async function boxes(from: number, until: number, depth = 0): Promise<AudioChapter[]> {
    let offset = from;
    while (offset + 8 <= until && depth < 5) {
      const header = new Uint8Array(await file.slice(offset, offset + 16).arrayBuffer());
      if (header.length < 8) break;
      const view = new DataView(header.buffer);
      let size = view.getUint32(0);
      const kind = ascii(header, 4, 4);
      let headerSize = 8;
      if (size === 1) { if (header.length < 16) break; size = integer(view, 8, 8); headerSize = 16; }
      if (size === 0) size = until - offset;
      if (!Number.isSafeInteger(size) || size < headerSize || offset + size > until) break;
      if (kind === 'chpl') {
        const data = new Uint8Array(await file.slice(offset + headerSize, offset + size).arrayBuffer());
        if (data.length < 5) return [];
        // FullBox: 4-byte version/flags, optionally 4-byte reserved, then 1-byte count.
        const parse = (countAt: number): AudioChapter[] | null => {
          if (countAt >= data.length) return null;
          const count = data[countAt];
          let cursor = countAt + 1;
          const result: AudioChapter[] = [];
          const dv = new DataView(data.buffer);
          for (let i = 0; i < count; i++) {
            if (cursor + 9 > data.length) return null;
            const start = integer(dv, cursor, 8) / 10000000;
            cursor += 8;
            const length = data[cursor++];
            if (cursor + length > data.length) return null;
            result.push({ start, title: decoder.decode(data.subarray(cursor, cursor + length)) || `Глава ${i + 1}` });
            cursor += length;
          }
          return result;
        };
        return parse(8) ?? parse(4) ?? [];
      }
      if (['moov', 'udta', 'trak', 'mdia', 'minf', 'stbl'].includes(kind)) {
        const nested = await boxes(offset + headerSize, offset + size, depth + 1);
        if (nested.length) return nested;
      }
      offset += size;
    }
    return [];
  }
  try {
    return (await boxes(0, file.size)).filter(c => Number.isFinite(c.start) && c.start >= 0)
      .sort((a, b) => a.start - b.start);
  } catch (error) {
    console.warn('Не удалось прочитать встроенные главы:', error);
    return [];
  }
}
