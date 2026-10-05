// Business-rule violations. The HTTP layer maps `code` to a status.
export type DomainErrorCode =
  | "unauthenticated"
  | "permission_denied"
  | "not_found"
  | "failed_precondition"
  | "invalid_argument";

export class DomainError extends Error {
  // `details` carries data the client needs to resolve the error, such as the
  // id of the record that already exists.
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
