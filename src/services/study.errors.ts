import { AppError } from "@/src/errors";

export class FileTooLargeError extends AppError {
  readonly statusCode = 400;
  readonly code = "FILE_TOO_LARGE";

  constructor(maxBytes: number, actualBytes?: number) {
    const maxMb = Math.floor(maxBytes / 1024 / 1024);
    super(`File is too large. Maximum size is ${maxMb} MB.`, true, {
      maxBytes,
      actualBytes
    });
  }
}

export class UnsupportedFileTypeError extends AppError {
  readonly statusCode = 400;
  readonly code = "UNSUPPORTED_FILE_TYPE";

  constructor(message = "Unsupported study material file type. Please upload a PDF or DOCX file.", details?: unknown) {
    super(message, true, details);
  }
}

export class TextExtractionError extends AppError {
  readonly statusCode = 400;
  readonly code = "TEXT_EXTRACTION_FAILED";

  constructor(message = "Could not extract readable text from this file.", details?: unknown) {
    super(message, true, details);
  }
}
