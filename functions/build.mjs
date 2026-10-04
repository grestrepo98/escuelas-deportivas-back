import {build} from "esbuild";
import {readFileSync} from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Runtime dependencies stay external (Cloud Build installs them from
// functions/package.json). Anything else is inlined into the bundle.
const external = Object.keys(pkg.dependencies ?? {}).flatMap((name) => [name, `${name}/*`]);

await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  sourcemap: true,
  external,
  logLevel: "info",
});
