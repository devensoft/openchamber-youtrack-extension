// Builds the committed bundles. OpenChamber installs extensions from Git
// without building them, so service/main.js and panel/main.js are checked in.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const targets = [
  {
    entry: "service/main.ts",
    out: "service/main.js",
    format: "esm" as const,
    target: "node" as const,
  },
  {
    entry: "src/panel/main.ts",
    out: "panel/main.js",
    format: "iife" as const,
    target: "browser" as const,
  },
];

for (const target of targets) {
  const result = await Bun.build({
    entrypoints: [resolve(target.entry)],
    format: target.format,
    target: target.target,
    minify: true,
  });

  const artifact = result.outputs[0];

  if (!result.success || !artifact) {
    console.error(result.logs.map((log) => log.message).join("\n") || `Build failed: ${target.entry}`);
    process.exit(1);
  }

  await writeFile(resolve(target.out), await artifact.text());
  console.log(`${target.out}  ${(artifact.size / 1024).toFixed(1)} KB`);
}
