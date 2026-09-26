/**
 * Identify a file by its leading bytes ("magic numbers"). The client-supplied
 * filename and Content-Type are never trusted: an ".jpg" that is really HTML
 * is rejected, and the stored extension always comes from the detected type.
 */

export interface SniffedType {
  mime: string;
  ext: string;
  kind: "image" | "video" | "pdf";
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "mmp4", "MSNV"]);

export function sniffFileType(buf: Buffer): SniffedType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: ".jpg", kind: "image" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: ".png", kind: "image" };
  if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a") return { mime: "image/gif", ext: ".gif", kind: "image" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { mime: "image/webp", ext: ".webp", kind: "image" };
  if (ascii(buf, 4, 8) === "ftyp" && MP4_BRANDS.has(ascii(buf, 8, 12))) return { mime: "video/mp4", ext: ".mp4", kind: "video" };
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: ".webm", kind: "video" };
  if (ascii(buf, 0, 5) === "%PDF-") return { mime: "application/pdf", ext: ".pdf", kind: "pdf" };
  return null;
}

/** Extensions that may be served inline from /uploads */
export const INLINE_MEDIA_EXT = /\.(jpg|png|gif|webp|mp4|webm)$/i;
