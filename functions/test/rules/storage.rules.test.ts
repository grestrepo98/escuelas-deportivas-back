import {getBytes, ref, uploadString, deleteObject} from "firebase/storage";
import {
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {afterAll, beforeAll, describe, it} from "vitest";
import {CALLERS, contextFor, initRulesEnv} from "./helpers";

// Every Storage path must be denied: tenant-shaped and arbitrary ones.
const PATHS = [
  "tenants/tenant-a/players/p1/document.pdf",
  "tenants/tenant-b/players/p2/document.pdf",
  "any/other/path.txt",
  "root.txt",
];

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initRulesEnv();
});

afterAll(async () => {
  await env.cleanup();
});

describe.each(CALLERS)("storage rules — %s", (caller) => {
  const storage = () => contextFor(env, caller).storage();

  it.each(PATHS)("cannot read %s", async (path) => {
    await assertFails(getBytes(ref(storage(), path)));
  });

  it.each(PATHS)("cannot write %s", async (path) => {
    await assertFails(uploadString(ref(storage(), path), "hacked"));
  });

  it.each(PATHS)("cannot delete %s", async (path) => {
    await assertFails(deleteObject(ref(storage(), path)));
  });
});
