import {resolve} from "node:path";
import {ESLint} from "eslint";
import {describe, expect, it} from "vitest";

// Proves the layer boundaries of .eslintrc.js: a broken rule would let
// forbidden imports through without anyone noticing (spec 03, ADR 0008).
const functionsRoot = resolve(__dirname, "../../..");

const eslint = new ESLint({
  cwd: functionsRoot,
  // Fictitious files are not part of any tsconfig project.
  overrideConfig: {parserOptions: {project: null}},
});

/**
 * Lints `code` as if it lived at `file` (relative to functions/) and returns
 * the messages of the boundary rule only.
 * @param {string} file Fictitious path of the file, relative to functions/.
 * @param {string} code Source to lint.
 * @return {Promise<string[]>} Messages reported by no-restricted-imports.
 */
async function boundaryViolations(file: string, code: string) {
  const [result] = await eslint.lintText(code, {
    filePath: resolve(functionsRoot, file),
  });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message);
}

const domainFile = "src/membership/domain/example.ts";
const applicationFile = "src/membership/application/example.ts";
const infrastructureFile = "src/membership/infrastructure/example.ts";
const scriptFile = "src/scripts/example.ts";

describe("domain layer boundary", () => {
  it.each([
    ["firebase-admin", "firebase-admin"],
    ["a firebase-admin subpath", "firebase-admin/firestore"],
    ["firebase-functions", "firebase-functions"],
    ["a firebase-functions subpath", "firebase-functions/v2/https"],
    ["@google-cloud/*", "@google-cloud/firestore"],
    ["zod", "zod"],
    ["its own infrastructure", "../infrastructure/firestore/repository"],
    ["shared infrastructure", "../../shared/infrastructure/admin"],
    ["its own application", "../application/membership-repository"],
    ["shared application", "../../shared/application/unit-of-work"],
  ])("rejects importing %s", async (_name, source) => {
    const violations = await boundaryViolations(
      domainFile,
      `import {x} from "${source}";\nexport const y = x;\n`,
    );
    expect(violations).toHaveLength(1);
  });

  it.each([
    ["its own domain", "./role"],
    ["shared domain", "../../shared/domain/errors"],
    ["the domain of another module", "../../tenant/domain/tenant"],
  ])("allows importing %s", async (_name, source) => {
    const violations = await boundaryViolations(
      domainFile,
      `import {x} from "${source}";\nexport const y = x;\n`,
    );
    expect(violations).toEqual([]);
  });

  it("applies to shared/domain too", async () => {
    const violations = await boundaryViolations(
      "src/shared/domain/example.ts",
      "import {x} from \"firebase-admin\";\nexport const y = x;\n",
    );
    expect(violations).toHaveLength(1);
  });
});

describe("application layer boundary", () => {
  it.each([
    ["firebase-admin", "firebase-admin"],
    ["a firebase-admin subpath", "firebase-admin/firestore"],
    ["firebase-functions", "firebase-functions"],
    ["@google-cloud/*", "@google-cloud/firestore"],
    ["zod", "zod"],
    ["its own infrastructure", "../infrastructure/firestore/repository"],
    ["shared infrastructure", "../../shared/infrastructure/admin"],
  ])("rejects importing %s", async (_name, source) => {
    const violations = await boundaryViolations(
      applicationFile,
      `import {x} from "${source}";\nexport const y = x;\n`,
    );
    expect(violations).toHaveLength(1);
  });

  it.each([
    ["its own domain", "../domain/role"],
    ["its own application", "./require-owner"],
    ["shared domain", "../../shared/domain/errors"],
    ["shared application", "../../shared/application/unit-of-work"],
    ["the application of another module", "../../tenant/application/x"],
  ])("allows importing %s", async (_name, source) => {
    const violations = await boundaryViolations(
      applicationFile,
      `import {x} from "${source}";\nexport const y = x;\n`,
    );
    expect(violations).toEqual([]);
  });

  it("applies to shared/application too", async () => {
    const violations = await boundaryViolations(
      "src/shared/application/example.ts",
      "import {x} from \"../infrastructure/admin\";\nexport const y = x;\n",
    );
    expect(violations).toHaveLength(1);
  });
});

describe("infrastructure layer and scripts", () => {
  it.each([
    ["the domain", "../domain/role"],
    ["the application", "../application/membership-repository"],
    ["firebase-admin", "firebase-admin/firestore"],
    ["firebase-functions", "firebase-functions/v2/https"],
    ["zod", "zod"],
    ["shared infrastructure", "../../shared/infrastructure/admin"],
  ])("infrastructure may import %s", async (_name, source) => {
    const violations = await boundaryViolations(
      infrastructureFile,
      `import {x} from "${source}";\nexport const y = x;\n`,
    );
    expect(violations).toEqual([]);
  });

  it("scripts may import anything", async () => {
    const violations = await boundaryViolations(
      scriptFile,
      "import {x} from \"firebase-admin\";\n" +
        "import {z} from \"../membership/infrastructure/authorize\";\n" +
        "export const y = [x, z];\n",
    );
    expect(violations).toEqual([]);
  });
});
