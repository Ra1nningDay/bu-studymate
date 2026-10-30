import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitExceededError,
  InternalServerError,
  handleApiError,
  toAppError
} from "./index";
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
  TextExtractionError
} from "@/src/services/study.errors";
import {
  InvalidTicketStatusError,
  TicketNotFoundError
} from "@/src/services/ticket.errors";

class CustomDomainError extends AppError {
  readonly statusCode = 422;
  readonly code = "CUSTOM_DOMAIN_ERROR";

  constructor(item: string) {
    super(`Item '${item}' is invalid`, true, { item });
  }
}

test("AppError preserves prototype chain and instanceof checks", () => {
  const err = new CustomDomainError("book");
  assert.ok(err instanceof Error);
  assert.ok(err instanceof AppError);
  assert.ok(err instanceof CustomDomainError);
  assert.equal(err.name, "CustomDomainError");
  assert.equal(err.statusCode, 422);
  assert.equal(err.code, "CUSTOM_DOMAIN_ERROR");
  assert.equal(err.isOperational, true);
  assert.deepEqual(err.details, { item: "book" });
});

test("AppError.toResponse formats standard response with backward-compatible error string", () => {
  const err = new CustomDomainError("notebook");
  const response = err.toResponse();
  assert.deepEqual(response, {
    success: false,
    error: "Item 'notebook' is invalid",
    code: "CUSTOM_DOMAIN_ERROR",
    details: { item: "notebook" }
  });
});

test("Standard HTTP errors instantiate with correct codes and status codes", () => {
  const badReq = new BadRequestError("Bad parameter");
  assert.equal(badReq.statusCode, 400);
  assert.equal(badReq.code, "BAD_REQUEST");

  const valErr = new ValidationError("Missing field", { field: "email" });
  assert.equal(valErr.statusCode, 400);
  assert.equal(valErr.code, "VALIDATION_ERROR");
  assert.deepEqual(valErr.details, { field: "email" });

  const unauth = new UnauthorizedError();
  assert.equal(unauth.statusCode, 401);
  assert.equal(unauth.code, "UNAUTHORIZED");

  const forbidden = new ForbiddenError();
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.code, "FORBIDDEN");

  const notFound = new NotFoundError("User not found");
  assert.equal(notFound.statusCode, 404);
  assert.equal(notFound.code, "NOT_FOUND");

  const conflict = new ConflictError("Email already in use");
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.code, "CONFLICT");

  const rateLimit = new RateLimitExceededError("Rate limit reached", 30);
  assert.equal(rateLimit.statusCode, 429);
  assert.equal(rateLimit.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(rateLimit.retryAfterSeconds, 30);

  const internal = new InternalServerError("DB crash");
  assert.equal(internal.statusCode, 500);
  assert.equal(internal.code, "INTERNAL_SERVER_ERROR");
  assert.equal(internal.isOperational, false);
});

test("handleApiError transforms AppError into NextResponse with correct status and body", async () => {
  const err = new NotFoundError("Course note not found");
  const res = handleApiError(err);
  assert.equal(res.status, 404);

  const body = await res.json();
  assert.deepEqual(body, {
    success: false,
    error: "Course note not found",
    code: "NOT_FOUND"
  });
});

test("handleApiError sets Retry-After header for RateLimitExceededError", async () => {
  const err = new RateLimitExceededError("Slow down", 45);
  const res = handleApiError(err);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "45");
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");

  const body = await res.json();
  assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
});

test("handleApiError masks unhandled non-AppError exceptions to prevent leaks", async () => {
  const sensitiveError = new Error("postgresql://admin:supersecret@10.0.0.1/db connection failed");
  const res = handleApiError(sensitiveError);
  assert.equal(res.status, 500);

  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.code, "INTERNAL_SERVER_ERROR");
  assert.equal(body.error, "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง");
  assert.ok(!JSON.stringify(body).includes("supersecret"));
});

test("toAppError wraps non-AppError into InternalServerError", () => {
  const custom = new CustomDomainError("item");
  assert.equal(toAppError(custom), custom);

  const native = new Error("Disk full");
  const wrapped = toAppError(native);
  assert.ok(wrapped instanceof InternalServerError);
  assert.equal(wrapped.statusCode, 500);
  assert.equal(wrapped.message, "Disk full");

  const primitive = toAppError("string error");
  assert.ok(primitive instanceof InternalServerError);
  assert.equal(primitive.message, "An unknown error occurred");
});

test("Study domain errors inherit AppError and format correctly", () => {
  const tooLarge = new FileTooLargeError(10 * 1024 * 1024, 15 * 1024 * 1024);
  assert.ok(tooLarge instanceof AppError);
  assert.equal(tooLarge.statusCode, 400);
  assert.equal(tooLarge.code, "FILE_TOO_LARGE");
  assert.equal(tooLarge.message, "File is too large. Maximum size is 10 MB.");
  assert.deepEqual(tooLarge.details, { maxBytes: 10485760, actualBytes: 15728640 });

  const unsupported = new UnsupportedFileTypeError();
  assert.ok(unsupported instanceof AppError);
  assert.equal(unsupported.statusCode, 400);
  assert.equal(unsupported.code, "UNSUPPORTED_FILE_TYPE");

  const extraction = new TextExtractionError();
  assert.ok(extraction instanceof AppError);
  assert.equal(extraction.statusCode, 400);
  assert.equal(extraction.code, "TEXT_EXTRACTION_FAILED");
});

test("Ticket domain errors inherit AppError and format correctly", () => {
  const invalidStatus = new InvalidTicketStatusError("ARCHIVED");
  assert.ok(invalidStatus instanceof AppError);
  assert.equal(invalidStatus.statusCode, 400);
  assert.equal(invalidStatus.code, "TICKET_INVALID_STATUS");
  assert.deepEqual(invalidStatus.details, { status: "ARCHIVED" });

  const notFound = new TicketNotFoundError("TCK-999");
  assert.ok(notFound instanceof AppError);
  assert.equal(notFound.statusCode, 404);
  assert.equal(notFound.code, "TICKET_NOT_FOUND");
  assert.deepEqual(notFound.details, { ticketIdOrCode: "TCK-999" });
});

