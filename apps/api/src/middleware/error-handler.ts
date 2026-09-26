import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  type?: string;
}

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors — expose field paths and messages only
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.errors.map((e) => ({ path: e.path, message: e.message })),
      },
    });
    return;
  }

  // Expected errors thrown on purpose by services/controllers
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }

  // Legacy pattern: plain Error decorated with statusCode/code (e.g. GstinService kycError)
  const legacy = err as ApiError;
  if (typeof legacy.statusCode === "number" && legacy.statusCode < 500) {
    res.status(legacy.statusCode).json({
      success: false,
      error: { code: legacy.code || "REQUEST_ERROR", message: legacy.message },
    });
    return;
  }

  // body-parser errors
  if (legacy.type === "entity.too.large") {
    res.status(413).json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } });
    return;
  }
  if (legacy.type === "entity.parse.failed") {
    res.status(400).json({ success: false, error: { code: "INVALID_JSON", message: "Malformed JSON body" } });
    return;
  }

  // Everything else is unexpected: log the details server-side, return a generic message
  const statusCode = typeof legacy.statusCode === "number" ? legacy.statusCode : 500;
  logger.error("Unhandled server error", {
    code: legacy.code,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode === 503 ? legacy.code || "SERVICE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR",
      message: statusCode === 503 ? err.message : "An unexpected error occurred",
    },
  });
}
