import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const root = resolve(__dirname, "../../..");

export const PROJECT_ID = "demo-escuelas-rules";

export function initRulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: readFileSync(resolve(root, "firestore.rules"), "utf8")},
    storage: {rules: readFileSync(resolve(root, "storage.rules"), "utf8")},
  });
}

// The three callers D-07 requires: no session, a member of the tenant that
// owns the data, and a member of a different tenant.
export const CALLERS = [
  "unauthenticated",
  "own-tenant",
  "other-tenant",
] as const;
export type Caller = (typeof CALLERS)[number];

export function contextFor(env: RulesTestEnvironment, caller: Caller) {
  if (caller === "unauthenticated") return env.unauthenticatedContext();
  const uid = caller === "own-tenant" ? "user-a" : "user-b";
  return env.authenticatedContext(uid);
}
