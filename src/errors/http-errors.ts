import { AppError } from "./app-error";

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = "BAD_REQUEST";

  constructor(message = "Bad request", details?: unknown) {
    super(message, true, details);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(message = "Invalid request data", details?: unknown) {
    super(message, true, details);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";

  constructor(message = "Authentication required", details?: unknown) {
    super(message, true, details);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";

  constructor(message = "Access denied", details?: unknown) {
    super(message, true, details);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";

  constructor(message = "Resource not found", details?: unknown) {
    super(message, true, details);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";

  constructor(message = "Resource conflict", details?: unknown) {
    super(message, true, details);
  }
}

export class RateLimitExceededError extends AppError {
  readonly statusCode = 429;
  readonly code = "RATE_LIMIT_EXCEEDED";

  constructor(message = "Too many requests", public readonly retryAfterSeconds?: number) {
    super(message, true, retryAfterSeconds !== undefined ? { retryAfterSeconds } : undefined);
  }
}

export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_SERVER_ERROR";

  constructor(message = "Internal server error", details?: unknown) {
    super(message, false, details);
  }
}
