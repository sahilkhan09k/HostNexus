import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "../config/database.js";
import { sniffFileType, type SniffedType } from "../utils/file-sniff.js";
import { badRequest, httpError, unprocessable } from "../utils/http-error.js";

/** Public media (listing photos, inspection evidence). Served by express.static with a sandbox CSP. */
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
/** Private KYC documents. Never served statically — admins read them via GET /api/admin/kyc/:file. */
export const KYC_DIR = path.join(process.cwd(), "private-uploads", "kyc");

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const MAX_KYC_BYTES = 5 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

export interface UploadItem {
  filename?: unknown;
  base64Data?: unknown;
  contentType?: unknown;
}

export interface StoredUpload {
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  fileUrl: string;
}

function decodeBase64(item: UploadItem): { buffer: Buffer; originalName: string } {
  if (typeof item.base64Data !== "string" || typeof item.filename !== "string" || !item.filename || !item.base64Data) {
    throw badRequest("Invalid upload payload: filename and base64Data are required", "INVALID_PAYLOAD");
  }
  // Strip an optional "data:<mime>;base64," prefix — the declared mime is ignored
  const comma = item.base64Data.indexOf(";base64,");
  const b64 = comma >= 0 ? item.base64Data.slice(comma + 8) : item.base64Data;
  if (!/^[A-Za-z0-9+/=\s]*$/.test(b64)) throw badRequest("File data is not valid base64", "INVALID_PAYLOAD");
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) throw badRequest("File is empty", "INVALID_PAYLOAD");
  return { buffer, originalName: item.filename.slice(0, 200) };
}

async function persist(dir: string, buffer: Buffer, type: SniffedType, ownerId: string | null, purpose: "MEDIA" | "KYC") {
  await fs.mkdir(dir, { recursive: true });
  const id = `${crypto.randomUUID()}${type.ext}`;
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  // "wx" = fail if the file exists; files are immutable once written
  await fs.writeFile(path.join(dir, id), buffer, { flag: "wx" });
  await prisma.upload.create({
    data: { id, ownerId, purpose, mimeType: type.mime, sizeBytes: buffer.length, sha256 },
  });
  return { id, sha256 };
}

export class UploadService {
  /** Photos / videos for listings and inspection evidence. Requires a signed-in user. */
  static async storeMedia(ownerId: string, items: UploadItem[]): Promise<StoredUpload[]> {
    if (items.length === 0) throw badRequest("No files found in upload payload", "INVALID_PAYLOAD");
    if (items.length > MAX_FILES_PER_REQUEST) {
      throw httpError(413, "TOO_MANY_FILES", `At most ${MAX_FILES_PER_REQUEST} files per request`);
    }

    // Validate everything before writing anything
    const decoded = items.map((item) => {
      const { buffer, originalName } = decodeBase64(item);
      if (buffer.length > MAX_MEDIA_BYTES) throw httpError(413, "FILE_TOO_LARGE", "Each file must be 15MB or smaller");
      const type = sniffFileType(buffer);
      if (!type || (type.kind !== "image" && type.kind !== "video")) {
        throw httpError(415, "UNSUPPORTED_TYPE", "Only JPG, PNG, GIF, WEBP images and MP4/WEBM videos are allowed");
      }
      return { buffer, originalName, type };
    });
    const total = decoded.reduce((s, d) => s + d.buffer.length, 0);
    if (total > MAX_TOTAL_BYTES) throw httpError(413, "PAYLOAD_TOO_LARGE", "Total upload size must be 30MB or smaller");

    const results: StoredUpload[] = [];
    for (const d of decoded) {
      const { id, sha256 } = await persist(UPLOADS_DIR, d.buffer, d.type, ownerId, "MEDIA");
      results.push({
        filename: id,
        originalName: d.originalName,
        mimeType: d.type.mime,
        sizeBytes: d.buffer.length,
        fileHash: sha256,
        fileUrl: `/uploads/${id}`,
      });
    }
    return results;
  }

  /** GST certificate before an account exists. PDF only, stored privately. */
  static async storeKycDocument(item: UploadItem): Promise<StoredUpload> {
    const { buffer, originalName } = decodeBase64(item);
    if (buffer.length > MAX_KYC_BYTES) throw httpError(413, "FILE_TOO_LARGE", "The GST certificate must be 5MB or smaller");
    const type = sniffFileType(buffer);
    if (!type || type.kind !== "pdf") {
      throw unprocessable("Please upload your GST registration certificate as a PDF.", "GSTIN_DOCUMENT_INVALID");
    }
    const { id, sha256 } = await persist(KYC_DIR, buffer, type, null, "KYC");
    return {
      filename: id,
      originalName,
      mimeType: type.mime,
      sizeBytes: buffer.length,
      fileHash: sha256,
      fileUrl: `/kyc/${id}`,
    };
  }
}
