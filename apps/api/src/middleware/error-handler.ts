import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.errors,
      },
    });
    return;
  }

  // Handle custom API errors
  const statusCode = (err as ApiError).statusCode || 500;
  const code = (err as ApiError).code || "INTERNAL_SERVER_ERROR";
  const message = err.message || "An unexpected error occurred";

  // Log error for debugging (avoid logging sensitive data)
  if (statusCode >= 500) {
    console.error("Server error:", {
      code,
      message,
      stack: err.stack,
      path: _req.path,
      method: _req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
