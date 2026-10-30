export interface ErrorResponsePayload {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Base class for all application errors across BU StudyMate.
 * Ensures consistent HTTP status codes, machine-readable error codes,
 * operational flags, and standardized API response formatting.
 */
export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, isOperational = true, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    this.details = details;

    // Restore prototype chain in TypeScript / V8 transpilation
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toResponse(): ErrorResponsePayload {
    return {
      success: false,
      error: this.message,
      code: this.code,
      ...(this.details !== undefined ? { details: this.details } : {})
    };
  }
}
