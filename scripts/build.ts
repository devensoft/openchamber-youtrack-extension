// OpenChamber installs extensions without building them, so panel/main.js is
// committed. Run `bun run build` after changing src/panel/main.ts.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const pkg = (await Bun.file("package.json").json()) as { version: string };
const out = resolve("panel/main.js");

const result = await Bun.build({
  entrypoints: [resolve("src/panel/main.ts")],
  format: "iife",
  target: "browser",
  minify: true,
  define: {
    __EXTENSION_VERSION__: JSON.stringify(pkg.version),
  },
});

const artifact = result.outputs[0];

if (!result.success || !artifact) {
  console.error(result.logs.map((log) => log.message).join("\n") || "Build failed");
  process.exit(1);
}

await writeFile(out, await artifact.text());
console.log(`panel/main.js  ${(artifact.size / 1024).toFixed(1)} KB`);
