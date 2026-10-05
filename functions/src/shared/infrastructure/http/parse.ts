import type {z} from "zod";
import {DomainError} from "../../domain/errors.js";

// Parses the payload, reporting only the offending field names (never the
// values) so a bad request cannot echo data back.
export function parseInput<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(
      (issue) => issue.path.join(".") || "(payload)"))];
    throw new DomainError(
      "invalid_argument", `Invalid input: ${fields.join(", ")}`);
  }
  return parsed.data;
}
