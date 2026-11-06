import { parseManifestJson } from "@openchamber/sdk/schemas";

const json = await Bun.file("package.json").text();
const result = parseManifestJson(json);

if (!result.ok) {
  console.error(`Invalid OpenChamber manifest (${result.code}): ${result.message}`);
  process.exit(1);
}

console.log(
  `Manifest OK — ${result.manifest.contributes.panel.name} v${result.version ?? "unknown"}`,
);
