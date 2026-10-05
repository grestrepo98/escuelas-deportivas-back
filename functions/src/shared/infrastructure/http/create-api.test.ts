import {Router} from "express";
import {afterEach, describe, expect, it} from "vitest";
import {DomainError} from "../../domain/errors.js";
import {serveApp, type ServedApp} from "../testing/serve-app.js";
import {createApi} from "./create-api.js";

let served: ServedApp | undefined;

afterEach(async () => {
  await served?.close();
  served = undefined;
});

const verifyIdToken = async (token: string) => {
  if (token !== "good") throw new Error("invalid");
  return {uid: "u1"};
};

async function start() {
  const router = Router();
  router.get("/ping", (_req, res) => {
    res.json({uid: res.locals.uid});
  });
  router.post("/echo", (req, res) => {
    res.json(req.body);
  });
  router.get("/denied", async () => {
    throw new DomainError("permission_denied", "no");
  });
  router.get("/crash", async () => {
    throw new Error("secret detail");
  });
  served = await serveApp(createApi(router, verifyIdToken));
  return served.url;
}

const authed = {Authorization: "Bearer good"};

describe("createApi", () => {
  it("routes an authenticated request to the router", async () => {
    const url = await start();
    const response = await fetch(`${url}/ping`, {headers: authed});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({uid: "u1"});
  });

  it("answers 401 without a token, even on unknown routes", async () => {
    const url = await start();
    for (const path of ["/ping", "/nowhere"]) {
      const response = await fetch(`${url}${path}`);
      expect(response.status).toBe(401);
    }
  });

  it("answers 401 before looking at a malformed body", async () => {
    const url = await start();
    const response = await fetch(`${url}/echo`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: "{",
    });
    expect(response.status).toBe(401);
  });

  it("parses JSON bodies", async () => {
    const url = await start();
    const response = await fetch(`${url}/echo`, {
      method: "POST",
      headers: {...authed, "Content-Type": "application/json"},
      body: JSON.stringify({a: 1}),
    });
    expect(await response.json()).toEqual({a: 1});
  });

  it("answers 400 to a malformed JSON body", async () => {
    const url = await start();
    const response = await fetch(`${url}/echo`, {
      method: "POST",
      headers: {...authed, "Content-Type": "application/json"},
      body: "{",
    });
    expect(response.status).toBe(400);
  });

  it("answers 404 with the error envelope on an unknown route", async () => {
    const url = await start();
    const response = await fetch(`${url}/nowhere`, {headers: authed});
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it("translates async domain errors thrown by handlers", async () => {
    const url = await start();
    const response = await fetch(`${url}/denied`, {headers: authed});
    expect(response.status).toBe(403);
  });

  it("hides unexpected handler errors behind a generic 500", async () => {
    const url = await start();
    const response = await fetch(`${url}/crash`, {headers: authed});
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
