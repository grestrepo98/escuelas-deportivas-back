// The domain is pure business logic: it must not know about Firebase (D-01, D-02).
module.exports = {
  root: true,
  extends: ["../../.eslintrc.base.js"],
  parserOptions: {
    project: ["tsconfig.json"],
  },
  ignorePatterns: ["/dist/**/*", "/.eslintrc.js"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        {
          group: ["firebase-admin", "firebase-admin/*"],
          message: "The domain must not import firebase-admin.",
        },
        {
          group: ["firebase-functions", "firebase-functions/*"],
          message: "The domain must not import firebase-functions.",
        },
        {
          group: ["@google-cloud/*"],
          message: "The domain must not import @google-cloud/* modules.",
        },
      ],
    }],
  },
};
