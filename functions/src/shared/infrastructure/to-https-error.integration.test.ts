import {DomainError} from "../domain/errors.js";
import {HttpsError} from "firebase-functions/v2/https";
import {describe, expect, it} from "vitest";
import {toHttpsError} from "./to-https-error.js";

describe("toHttpsError", () => {
  it.each([
    ["permission_denied", "permission-denied"],
    ["not_found", "not-found"],
    ["failed_precondition", "failed-precondition"],
    ["invalid_argument", "invalid-argument"],
  ] as const)("maps domain %s to %s", (domainCode, httpsCode) => {
    const mapped = toHttpsError(new DomainError(domainCode, "msg"));
    expect(mapped).toBeInstanceOf(HttpsError);
    expect((mapped as HttpsError).code).toBe(httpsCode);
    expect((mapped as HttpsError).message).toBe("msg");
  });

  it("passes an HttpsError through unchanged", () => {
    const original = new HttpsError("unauthenticated", "no session");
    expect(toHttpsError(original)).toBe(original);
  });

  it("hides unexpected errors behind a generic internal error", () => {
    const mapped = toHttpsError(new Error("secret db detail"));
    expect(mapped).toBeInstanceOf(HttpsError);
    expect((mapped as HttpsError).code).toBe("internal");
    expect((mapped as HttpsError).message).not.toContain("secret");
  });
});
