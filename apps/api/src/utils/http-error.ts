/**
 * Error with an HTTP status and a machine-readable code. The central
 * error handler turns it into `{ success: false, error: { code, message } }`
 * with the right status instead of a generic 500.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST") => new HttpError(400, code, message);
export const forbidden  = (message: string, code = "FORBIDDEN")   => new HttpError(403, code, message);
export const notFound   = (message: string, code = "NOT_FOUND")   => new HttpError(404, code, message);
export const conflict   = (message: string, code = "CONFLICT")    => new HttpError(409, code, message);
export const badGateway = (message: string, code = "PAYMENT_PROVIDER_ERROR") => new HttpError(502, code, message);
