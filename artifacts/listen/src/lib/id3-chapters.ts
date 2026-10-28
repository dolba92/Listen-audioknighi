import type { AudioChapter } from './m4b-chapters';

// ID3v2.3/v2.4 CHAP frames (used by Book Voice's MP3 export).
// Read only the tag at the beginning, never the large audio payload.
const textDecoder = new TextDecoder('utf-8');
const synchsafe = (bytes: Uint8Array, pos: number) =>
  (bytes[pos] * 0x200000 + bytes[pos + 1] * 0x4000 + bytes[pos + 2] * 0x80 + bytes[pos + 3]);
const uint32 = (bytes: Uint8Array, pos: number) =>
  bytes[pos] * 0x1000000 + bytes[pos + 1] * 0x10000 + bytes[pos + 2] * 0x100 + bytes[pos + 3];
const latin = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

function decodeText(bytes: Uint8Array): string {
  if (!bytes.length) return '';
  const enc = bytes[0];
  const data = bytes.subarray(1);
  try {
    if (enc === 0) return latin(data).replace(/\0+$/, '').trim();
    if (enc === 3) return textDecoder.decode(data).replace(/\0+$/, '').trim();
    if (enc === 1 || enc === 2) {
      let little = enc === 1;
      let start = 0;
      if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) { little = false; start = 2; }
      else if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) { little = true; start = 2; }
      const content = data.subarray(start);
      const even = content.subarray(0, content.length - (content.length % 2));
      return new TextDecoder(little ? 'utf-16le' : 'utf-16be').decode(even).replace(/\0+$/, '').trim();
    }
  } catch { /* unsupported encoding */ }
  return '';
}

export async function readMp3Chapters(file: Blob): Promise<AudioChapter[]> {
  try {
    const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (header.length !== 10 || latin(header.subarray(0, 3)) !== 'ID3') return [];
    const version = header[3];
    if (version !== 3 && version !== 4) return [];
    const tagSize = synchsafe(header, 6);
    if (!tagSize || tagSize > file.size - 10 || tagSize > 64 * 1024 * 1024) return [];
    const tag = new Uint8Array(await file.slice(10, tagSize + 10).arrayBuffer());
    const flags = header[5];
    let cursor = 0;
    if (flags & 0x40) {
      if (tag.length < 4) return [];
      cursor = version === 4 ? synchsafe(tag, 0) : uint32(tag, 0) + 4;
    }
    const chapters: AudioChapter[] = [];
    while (cursor + 10 <= tag.length) {
      const id = latin(tag.subarray(cursor, cursor + 4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = version === 4 ? synchsafe(tag, cursor + 4) : uint32(tag, cursor + 4);
      const frameFlags = (tag[cursor + 8] << 8) | tag[cursor + 9];
      cursor += 10;
      if (!size || cursor + size > tag.length) break;
      if (id === 'CHAP' && !(frameFlags & (version === 3 ? 0x00c0 : 0x000c))) {
        const frame = tag.subarray(cursor, cursor + size);
        const nullAt = frame.indexOf(0);
        if (nullAt >= 0 && nullAt + 17 <= frame.length) {
          const start = uint32(frame, nullAt + 1) / 1000;
          let title = '';
          let nested = nullAt + 17; // element ID + start/end ms + start/end offsets
          while (nested + 10 <= frame.length) {
            const nestedId = latin(frame.subarray(nested, nested + 4));
            const nestedSize = version === 4 ? synchsafe(frame, nested + 4) : uint32(frame, nested + 4);
            nested += 10;
            if (!nestedSize || nested + nestedSize > frame.length) break;
            if (nestedId === 'TIT2') { title = decodeText(frame.subarray(nested, nested + nestedSize)); break; }
            nested += nestedSize;
          }
          if (Number.isFinite(start) && start >= 0) chapters.push({ start, title: title || `Глава ${chapters.length + 1}` });
        }
      }
      cursor += size;
    }
    return chapters.sort((a, b) => a.start - b.start).filter((chapter, index, sorted) => index === 0 || chapter.start !== sorted[index - 1].start);
  } catch (error) {
    console.warn('Не удалось прочитать главы MP3:', error);
    return [];
  }
}
