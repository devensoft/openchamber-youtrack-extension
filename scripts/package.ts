// Stages the runtime files into dist/<name>/ and zips them for the GitHub
// release. Only what OpenChamber reads at runtime is included.
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const pkg = (await Bun.file("package.json").json()) as { name: string; version: string };
const dist = resolve("dist");
const stage = join(dist, pkg.name);
const archive = join(dist, `${pkg.name}-v${pkg.version}.zip`);

await rm(dist, { recursive: true, force: true });
await mkdir(join(stage, "service"), { recursive: true });

for (const path of ["package.json", "README.md", "LICENSE", "icon.svg"]) {
  await cp(path, join(stage, basename(path)), { recursive: true });
}
await cp("service/main.js", join(stage, "service/main.js"));

const zip = Bun.spawnSync(["zip", "-qr", archive, pkg.name], { cwd: dist });
if (zip.exitCode !== 0) {
  console.error(zip.stderr.toString() || "zip failed");
  process.exit(1);
}

const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
await Bun.write(`${archive}.sha256`, `${digest}  ${basename(archive)}\n`);

console.log(`${basename(archive)}  ${(await readFile(archive)).byteLength} bytes`);
