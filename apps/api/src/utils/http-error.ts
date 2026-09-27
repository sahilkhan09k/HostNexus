/**
 * Error with an HTTP status and a stable machine-readable code.
 * Only HttpError messages are shown to clients; anything else becomes a generic 500.
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const httpError = (statusCode: number, code: string, message: string): HttpError =>
  new HttpError(statusCode, code, message);

export const badRequest   = (message: string, code = "BAD_REQUEST")  => httpError(400, code, message);
export const unauthorized = (message: string, code = "UNAUTHORIZED") => httpError(401, code, message);
export const forbidden    = (message: string, code = "FORBIDDEN")    => httpError(403, code, message);
export const notFound     = (message: string, code = "NOT_FOUND")    => httpError(404, code, message);
export const conflict     = (message: string, code = "CONFLICT")     => httpError(409, code, message);
export const unprocessable = (message: string, code = "UNPROCESSABLE") => httpError(422, code, message);
