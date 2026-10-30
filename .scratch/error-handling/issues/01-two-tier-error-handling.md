# 01: Two-Tier Error Handling Architecture

Type: refactor
Status: resolved
Updated: 2026-10-30
Blocked by: none

## Scope

- Implement Global Base Error class `AppError` and standard HTTP errors (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`, `ValidationError`, `RateLimitExceededError`, `InternalServerError`) in `src/errors/`.
- Implement `handleApiError` utility in `src/errors/` that safely handles both `AppError` and unexpected exceptions, formatting them into structured `NextResponse.json` while maintaining backward compatibility with legacy `{ error: string }`.
- Implement domain-specific errors in respective service domains:
  - `src/services/study/study.errors.ts` (`FileTooLargeError`, `UnsupportedFileTypeError`, `TextExtractionError`)
  - `src/services/ticket/ticket.errors.ts` (`InvalidTicketStatusError`, `TicketNotFoundError`)
- Integrate domain-specific errors in `src/lib/study-file.ts`, `src/lib/study-material-ingest.ts`, and `src/services/ticket.service.ts`.
- Integrate `handleApiError` in controllers (e.g. `src/controllers/chat.controller.ts`, `src/controllers/ticket.controller.ts`).
- Add comprehensive unit tests in `src/errors/app-error.test.ts`.
- Verify with `pnpm typecheck`, `pnpm lint`, unit test suites, and `graphify update .`.

## Acceptance Criteria

- `src/errors/` contains `AppError`, standard HTTP errors, and `handleApiError`.
- Specific errors extend `AppError` with custom `statusCode` and machine-readable `code`.
- `handleApiError` responds with `{ success: false, error: string, code: string, details?: unknown }`.
- Legacy callers checking `data.error` remain functional without breaking changes.
- All test suites pass.
- `pnpm typecheck` and `pnpm lint` pass with 0 errors.

## Comments

### 2026-10-30 - Resolved
- Created `src/errors/app-error.ts` with `AppError` abstract base class preserving prototypes and standardizing `{ success: false, error, code, details? }`.
- Created `src/errors/http-errors.ts` providing standard HTTP errors (`BadRequestError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitExceededError`, `InternalServerError`).
- Created `src/errors/error-handler.ts` with `handleApiError` that safely formats responses, handles `Retry-After` headers, and masks unexpected/programmer errors against sensitive leaks.
- Created `src/errors/index.ts` for clean exports.
- Implemented domain-specific errors in `src/services/study.errors.ts` and `src/services/ticket.errors.ts`.
- Integrated domain errors into `src/lib/study-file.ts`, `src/lib/study-material-ingest.ts`, `src/services/ticket.service.ts`, and `src/controllers/chat.controller.ts`.
- Added unit tests in `src/errors/app-error.test.ts` (9 tests pass) and added `test:errors` script to `package.json`.
- Verified `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), all 8 test suites pass, `next build` (22/22 routes compile successfully), and `graphify update .` completed.
