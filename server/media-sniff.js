const startsWith = (buffer, bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

export function sniffMedia(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', mime: 'image/png' };
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg' };
  if (buffer.subarray(0, 6).toString('latin1') === 'GIF87a' || buffer.subarray(0, 6).toString('latin1') === 'GIF89a') return { kind: 'image', mime: 'image/gif' };
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') return { kind: 'video', mime: 'video/mp4' };
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', mime: 'video/webm' };
  return null;
}
