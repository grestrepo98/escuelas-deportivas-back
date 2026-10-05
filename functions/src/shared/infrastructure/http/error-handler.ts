import type {ErrorRequestHandler} from "express";
import {DomainError, type DomainErrorCode} from "../../domain/errors.js";

const STATUSES: Record<DomainErrorCode, number> = {
  unauthenticated: 401,
  invalid_argument: 400,
  permission_denied: 403,
  not_found: 404,
  failed_precondition: 409,
};

// express.json() reports a malformed or oversized body as an error carrying a
// 4xx `status` and a `type` such as "entity.parse.failed".
function isBodyError(error: unknown): boolean {
  const {status, type} = (error ?? {}) as {status?: unknown; type?: unknown};
  return typeof type === "string" && typeof status === "number" &&
    status >= 400 && status < 500;
}

// Business-rule violations keep their message; anything unexpected is hidden
// behind a generic error so internals never reach the client (ADR 0009).
export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof DomainError) {
    res.status(STATUSES[error.code]).json(
      {error: {code: error.code, message: error.message}});
    return;
  }
  if (isBodyError(error)) {
    res.status(400).json({
      error: {code: "invalid_argument", message: "Invalid request body"},
    });
    return;
  }
  res.status(500).json(
    {error: {code: "internal", message: "Internal error"}});
};
