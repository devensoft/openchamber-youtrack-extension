// Bumps the package version and nothing else. The manual Release workflow
// tags v{version} and publishes it after the bump is on main.
//
//   bun run bump patch|minor|major
import { readFile, writeFile } from "node:fs/promises";

const kind = process.argv[2];

if (kind !== "patch" && kind !== "minor" && kind !== "major") {
  console.error("usage: bun run bump patch|minor|major");
  process.exit(1);
}

const raw = await readFile("package.json", "utf8");
const pkg = JSON.parse(raw) as { version?: string };
const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(pkg.version ?? "");

if (!match) {
  console.error(`package.json version is not semver: ${pkg.version}`);
  process.exit(1);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);

if (kind === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (kind === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const previous = pkg.version;
const next = `${major}.${minor}.${patch}`;

pkg.version = next;
await writeFile("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`version ${previous} -> ${next}`);
