import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import type {z} from "zod";

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
    throw new HttpsError(
      "invalid-argument", `Invalid input: ${fields.join(", ")}`);
  }
  return parsed.data;
}

export function deviceOf(request: CallableRequest): {userAgent?: string} {
  const userAgent = request.rawRequest.get("user-agent");
  return userAgent ? {userAgent} : {};
}
