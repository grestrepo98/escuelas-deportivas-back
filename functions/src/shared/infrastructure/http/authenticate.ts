import type {RequestHandler} from "express";
import {DomainError} from "../../domain/errors.js";

export type VerifyIdToken = (idToken: string) => Promise<{uid: string}>;

const BEARER = /^Bearer (.+)$/;

// The uid always comes from the verified token, never from the request. It is
// left in `res.locals.uid` for the handlers. Verification failures answer the
// same generic 401 so the reason never reaches the client.
export function authenticate(verifyIdToken: VerifyIdToken): RequestHandler {
  return async (req, res, next) => {
    const token = BEARER.exec(req.get("authorization") ?? "")?.[1]?.trim();
    if (!token) {
      throw new DomainError("unauthenticated", "Authentication is required");
    }
    try {
      res.locals.uid = (await verifyIdToken(token)).uid;
    } catch {
      throw new DomainError("unauthenticated", "Invalid credentials");
    }
    next();
  };
}
