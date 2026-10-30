import { NextResponse } from "next/server";
import { AppError } from "./app-error";
import { InternalServerError, RateLimitExceededError } from "./http-errors";

/**
 * Global API Error Handler that transforms any caught exception
 * into a standardized Next.js JSON response.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    if (!error.isOperational) {
      console.error(`[CRITICAL] ${error.name} (${error.code}):`, error);
    }

    const headers: Record<string, string> = {};
    if (error instanceof RateLimitExceededError && error.retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(error.retryAfterSeconds);
      headers["Cache-Control"] = "private, no-store";
    }

    return NextResponse.json(error.toResponse(), {
      status: error.statusCode,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    });
  }

  // Programmer Error or Unhandled Exception
  console.error("[UnhandledException]", error);

  const fallback = new InternalServerError("เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง");
  return NextResponse.json(fallback.toResponse(), { status: fallback.statusCode });
}

/**
 * Normalizes any error object into an instance of AppError.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new InternalServerError(error.message, { originalName: error.name });
  }
  return new InternalServerError("An unknown error occurred", { raw: error });
}
