// Layer boundaries (spec 03, ADR 0008): domain and application stay free of
// Firebase and zod; only infrastructure may import them. The rules are proven
// by src/shared/infrastructure/lint-boundaries.test.ts.
const frameworkPatterns = [
  {
    group: ["firebase-admin", "firebase-admin/*"],
    message: "Only infrastructure may import firebase-admin.",
  },
  {
    group: ["firebase-functions", "firebase-functions/*"],
    message: "Only infrastructure may import firebase-functions.",
  },
  {
    group: ["@google-cloud/*"],
    message: "Only infrastructure may import @google-cloud/* modules.",
  },
  {
    group: ["zod", "zod/*"],
    message: "Only infrastructure may import zod.",
  },
];

const infrastructurePattern = {
  group: ["**/infrastructure", "**/infrastructure/**"],
  message: "domain and application must not import infrastructure.",
};

const applicationPattern = {
  group: ["**/application", "**/application/**"],
  message: "domain must not import application.",
};

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
    "/build.mjs",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    // A module path cannot be wrapped, and layered paths are long.
    "max-len": ["error", {
      "code": 80,
      "tabWidth": 2,
      "ignoreUrls": true,
      "ignorePattern": "^\\} from \"|^import .* from \"",
    }],
    // TypeScript types already document signatures.
    "require-jsdoc": 0,
    "valid-jsdoc": 0,
  },
  overrides: [
    {
      files: ["src/*/domain/**/*.ts"],
      rules: {
        "no-restricted-imports": ["error", {
          patterns: [
            ...frameworkPatterns,
            infrastructurePattern,
            applicationPattern,
          ],
        }],
      },
    },
    {
      files: ["src/*/application/**/*.ts"],
      rules: {
        "no-restricted-imports": ["error", {
          patterns: [...frameworkPatterns, infrastructurePattern],
        }],
      },
    },
  ],
};
