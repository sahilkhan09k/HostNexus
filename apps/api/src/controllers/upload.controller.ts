import type { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    // Ignore if already exists
  }
}

export class UploadController {
  /**
   * Upload single or multiple media/evidence files
   * Expects JSON: { filename: string, base64Data: string, contentType?: string }
   * or { files: Array<{ filename: string, base64Data: string, contentType?: string }> }
   */
  static async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await ensureUploadDir();

      const processFile = async (item: { filename: string; base64Data: string; contentType?: string }) => {
        if (!item.base64Data || !item.filename) {
          throw new Error("Invalid upload payload: filename and base64Data are required");
        }

        // Strip data:image/...;base64, prefix if present
        let cleanBase64 = item.base64Data;
        let mimeType = item.contentType || "image/jpeg";

        if (cleanBase64.includes(";base64,")) {
          const parts = cleanBase64.split(";base64,");
          const mimeMatch = parts[0].match(/data:(.*?)$/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          cleanBase64 = parts[1];
        }

        const buffer = Buffer.from(cleanBase64, "base64");
        const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

        const ext = path.extname(item.filename) || (mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg");
        const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
        const filePath = path.join(UPLOADS_DIR, safeName);

        await fs.writeFile(filePath, buffer);

        // Relative URL served by static middleware
        const fileUrl = `/uploads/${safeName}`;

        return {
          filename: safeName,
          originalName: item.filename,
          mimeType,
          sizeBytes: buffer.length,
          fileHash,
          fileUrl,
        };
      };

      if (Array.isArray(req.body.files)) {
        const results = await Promise.all(req.body.files.map(processFile));
        res.status(201).json({
          success: true,
          data: results,
        });
        return;
      }

      if (req.body.base64Data) {
        const result = await processFile(req.body);
        res.status(201).json({
          success: true,
          data: result,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "No files found in upload payload",
        },
      });
    } catch (err: any) {
      next(err);
    }
  }
}
