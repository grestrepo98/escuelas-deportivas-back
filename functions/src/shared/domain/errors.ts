// Business-rule violations. The HTTP layer maps `code` to a status.
export type DomainErrorCode =
  | "unauthenticated"
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
