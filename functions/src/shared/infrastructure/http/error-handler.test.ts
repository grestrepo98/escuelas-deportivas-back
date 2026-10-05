import express from "express";
import {afterEach, describe, expect, it} from "vitest";
import {DomainError} from "../../domain/errors.js";
import {serveApp, type ServedApp} from "../testing/serve-app.js";
import {errorHandler} from "./error-handler.js";

let served: ServedApp | undefined;

afterEach(async () => {
  await served?.close();
  served = undefined;
});

async function call(thrown: unknown, init?: RequestInit) {
  const app = express();
  app.post("/boom", express.json(), () => {
    throw thrown;
  });
  app.use(errorHandler);
  served = await serveApp(app);
  const response = await fetch(`${served.url}/boom`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: "{}",
    ...init,
  });
  return {status: response.status, body: await response.json()};
}

describe("errorHandler", () => {
  it.each([
    ["unauthenticated", 401],
    ["invalid_argument", 400],
    ["permission_denied", 403],
    ["not_found", 404],
    ["failed_precondition", 409],
  ] as const)("maps domain %s to HTTP %i", async (code, status) => {
    const result = await call(new DomainError(code, "msg"));
    expect(result.status).toBe(status);
    expect(result.body).toEqual({error: {code, message: "msg"}});
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const result = await call(new Error("secret db detail"));
    expect(result.status).toBe(500);
    expect(result.body).toEqual(
      {error: {code: "internal", message: "Internal error"}});
    expect(JSON.stringify(result.body)).not.toContain("secret");
  });

  it("answers 400 to a malformed JSON body without echoing it", async () => {
    const result = await call(new Error("unused"), {body: "{\"secret\": "});
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("invalid_argument");
    expect(JSON.stringify(result.body)).not.toContain("secret");
  });

  it("answers 400 to a body over the 100kb limit", async () => {
    const big = JSON.stringify({text: "x".repeat(200 * 1024)});
    const result = await call(new Error("unused"), {body: big});
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("invalid_argument");
  });
});
