import express, {type Express, type Router} from "express";
import {adminAuth} from "../admin.js";
import {authenticate, type VerifyIdToken} from "./authenticate.js";
import {errorHandler} from "./error-handler.js";
import {DomainError} from "../../domain/errors.js";

const verifyWithFirebase: VerifyIdToken = (idToken) =>
  adminAuth().verifyIdToken(idToken);

// Builds the Express app of one module API (ADR 0009). Every route is
// authenticated: `authenticate` runs before anything else, so a handler can
// never be reached without a verified uid. Body size keeps Express's 100kb
// default because files never pass through functions (D-08).
export function createApi(
  router: Router,
  verifyIdToken: VerifyIdToken = verifyWithFirebase,
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(authenticate(verifyIdToken));
  app.use(express.json());
  app.use(router);
  app.use(() => {
    throw new DomainError("not_found", "Route not found");
  });
  app.use(errorHandler);
  return app;
}
