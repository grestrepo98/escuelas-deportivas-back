import type {Request} from "express";
import {describe, expect, it} from "vitest";
import {deviceOf} from "./device.js";

const requestWith = (userAgent?: string) =>
  ({
    get: (name: string) =>
      name.toLowerCase() === "user-agent" ? userAgent : undefined,
  }) as Pick<Request, "get"> as Request;

describe("deviceOf", () => {
  it("returns the user agent when the request has one", () => {
    expect(deviceOf(requestWith("Mozilla/5.0"))).toEqual({
      userAgent: "Mozilla/5.0",
    });
  });

  it("returns an empty device when there is no user agent", () => {
    expect(deviceOf(requestWith(undefined))).toEqual({});
  });
});
