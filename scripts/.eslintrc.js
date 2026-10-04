module.exports = {
  root: true,
  extends: ["../.eslintrc.base.js"],
  parserOptions: {
    project: ["tsconfig.json"],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ["/.eslintrc.js"],
};
