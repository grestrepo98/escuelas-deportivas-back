import {describe, expect, it} from "vitest";
import {z} from "zod";
import {DomainError} from "../../domain/errors.js";
import {parseInput} from "./parse.js";

const schema = z.object({
  name: z.string().min(1),
  nested: z.object({email: z.email()}).optional(),
}).strict();

function failure(data: unknown): DomainError {
  try {
    parseInput(schema, data);
  } catch (error) {
    return error as DomainError;
  }
  throw new Error("expected parseInput to throw");
}

describe("parseInput", () => {
  it("returns the parsed data when the input is valid", () => {
    expect(parseInput(schema, {name: "Sede"})).toEqual({name: "Sede"});
  });

  it("throws invalid_argument naming the offending fields", () => {
    const error = failure({name: ""});
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("invalid_argument");
    expect(error.message).toBe("Invalid input: name");
  });

  it("names nested fields with a dotted path", () => {
    expect(failure({name: "a", nested: {email: "nope"}}).message)
      .toBe("Invalid input: nested.email");
  });

  it("rejects extra fields", () => {
    expect(failure({name: "a", role: "owner"}).message)
      .toContain("(payload)");
  });

  it("never echoes the submitted values", () => {
    const error = failure({name: "a", nested: {email: "leaky-value"}});
    expect(error.message).not.toContain("leaky-value");
  });

  it("names the payload when it is not an object", () => {
    expect(failure(undefined).message).toBe("Invalid input: (payload)");
  });
});
