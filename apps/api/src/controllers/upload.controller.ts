import type { Request, Response, NextFunction } from "express";
import { UploadService, type UploadItem } from "../services/upload.service.js";

export class UploadController {
  /**
   * Upload single or multiple media/evidence files (authenticated)
   * Expects JSON: { filename: string, base64Data: string }
   * or { files: Array<{ filename: string, base64Data: string }> }
   */
  static async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = (req.body ?? {}) as { files?: unknown } & UploadItem;
      if (Array.isArray(body.files)) {
        const results = await UploadService.storeMedia(req.userId!, body.files as UploadItem[]);
        res.status(201).json({ success: true, data: results });
        return;
      }
      if (body.base64Data) {
        const [result] = await UploadService.storeMedia(req.userId!, [body]);
        res.status(201).json({ success: true, data: result });
        return;
      }
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "No files found in upload payload" },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload the GST certificate during registration (no account yet).
   * PDF only; stored outside the public uploads folder.
   */
  static async uploadKycDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UploadService.storeKycDocument((req.body ?? {}) as UploadItem);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
