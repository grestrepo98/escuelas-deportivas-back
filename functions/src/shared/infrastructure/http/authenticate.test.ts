import express from "express";
import {afterEach, describe, expect, it, vi} from "vitest";
import {serveApp, type ServedApp} from "../testing/serve-app.js";
import {authenticate} from "./authenticate.js";
import {errorHandler} from "./error-handler.js";

let served: ServedApp | undefined;

afterEach(async () => {
  await served?.close();
  served = undefined;
});

async function get(
  verifyIdToken: (token: string) => Promise<{uid: string}>,
  headers: Record<string, string> = {},
) {
  const app = express();
  app.use(authenticate(verifyIdToken));
  app.get("/who", (_req, res) => {
    res.json({uid: res.locals.uid});
  });
  app.use(errorHandler);
  served = await serveApp(app);
  const response = await fetch(`${served.url}/who`, {headers});
  return {status: response.status, body: await response.json()};
}

describe("authenticate", () => {
  it("exposes the verified uid to the handlers", async () => {
    const verify = vi.fn().mockResolvedValue({uid: "u1"});
    const result = await get(verify, {Authorization: "Bearer good-token"});
    expect(result).toEqual({status: 200, body: {uid: "u1"}});
    expect(verify).toHaveBeenCalledWith("good-token");
  });

  it.each([
    ["no Authorization header", {}],
    ["a non-Bearer scheme", {Authorization: "Basic abc"}],
    ["an empty Bearer token", {Authorization: "Bearer "}],
  ])("answers 401 with %s, without verifying", async (_name, headers) => {
    const verify = vi.fn();
    const result = await get(verify, headers);
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("unauthenticated");
    expect(verify).not.toHaveBeenCalled();
  });

  it("answers 401 when the token does not verify", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("token detail"));
    const result = await get(verify, {Authorization: "Bearer bad"});
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("unauthenticated");
    expect(JSON.stringify(result.body)).not.toContain("token detail");
  });
});
