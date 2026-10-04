module.exports = {
  root: true,
  extends: ["../.eslintrc.base.js"],
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
    "/build.mjs",
  ],
};
