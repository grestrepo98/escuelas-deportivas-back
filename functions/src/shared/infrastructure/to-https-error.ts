import {DomainError, type DomainErrorCode} from "../domain/errors.js";
import {HttpsError, type FunctionsErrorCode} from "firebase-functions/v2/https";

const CODES: Record<DomainErrorCode, FunctionsErrorCode> = {
  permission_denied: "permission-denied",
  not_found: "not-found",
  failed_precondition: "failed-precondition",
  invalid_argument: "invalid-argument",
};

// Business-rule violations keep their message; anything unexpected is hidden
// behind a generic error so internals never reach the client.
export function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof DomainError) {
    return new HttpsError(CODES[error.code], error.message);
  }
  return new HttpsError("internal", "Internal error");
}
