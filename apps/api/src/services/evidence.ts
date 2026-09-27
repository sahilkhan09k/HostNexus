import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { unprocessable } from "../utils/http-error.js";

type Db = Prisma.TransactionClient | typeof prisma;

const UPLOAD_PATH = /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|gif|webp|mp4|webm))$/;

/**
 * Accepts "/uploads/<id>" or an absolute URL whose path is "/uploads/<id>" (the
 * web app stores absolute API URLs). Returns the upload id, or null.
 * The host of an absolute URL is ignored: we store the canonical relative path,
 * so an attacker-controlled host can never end up in evidence.
 */
export function uploadIdFromUrl(url: string): string | null {
  let pathname = url.trim();
  if (/^https?:\/\//i.test(pathname)) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }
  const m = UPLOAD_PATH.exec(pathname);
  return m ? m[1] : null;
}

export interface ResolvedMedia {
  fileUrl: string;
  fileHash: string | null;
  type: "IMAGE" | "VIDEO";
}

/**
 * Every URL must reference a file that `userId` uploaded through /api/upload.
 * `keep` lists URLs already stored on the record being edited; those are kept
 * verbatim so listings created before this check existed can still be saved.
 */
export async function resolveOwnedMedia(
  userId: string,
  urls: string[],
  opts: { db?: Db; keep?: string[]; field?: string } = {}
): Promise<ResolvedMedia[]> {
  const db = opts.db ?? prisma;
  const keep = new Set(opts.keep ?? []);
  const field = opts.field ?? "file";

  const ids = new Map<string, string>(); // url -> upload id
  for (const url of urls) {
    if (keep.has(url)) continue;
    const id = uploadIdFromUrl(url);
    if (!id) throw unprocessable(`Invalid ${field}: files must be uploaded through HostNexus`, "INVALID_MEDIA_REFERENCE");
    ids.set(url, id);
  }

  const uploads = ids.size
    ? await db.upload.findMany({ where: { id: { in: [...new Set(ids.values())] } } })
    : [];
  const byId = new Map(uploads.map((u) => [u.id, u]));

  return urls.map((url) => {
    if (keep.has(url)) return { fileUrl: url, fileHash: null, type: /\.(mp4|webm)(\?|$)/i.test(url) ? "VIDEO" : "IMAGE" };
    const upload = byId.get(ids.get(url)!);
    if (!upload || upload.ownerId !== userId || upload.purpose !== "MEDIA") {
      throw unprocessable(`Invalid ${field}: you can only attach files you uploaded`, "INVALID_MEDIA_REFERENCE");
    }
    return {
      fileUrl: `/uploads/${upload.id}`,
      fileHash: upload.sha256,
      type: upload.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE",
    };
  });
}
