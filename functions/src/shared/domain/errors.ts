// Business-rule violations. The functions layer maps `code` to HttpsError.
export type DomainErrorCode =
  | "permission_denied"
  | "not_found"
  | "failed_precondition"
  | "invalid_argument";

export class DomainError extends Error {
  constructor(readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
  }
}
