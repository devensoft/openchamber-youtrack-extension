// Prints "true" when <left> is semver-greater than <right>, "false" otherwise.
// Exit code 2 means one of the inputs is not a valid version.
//
// This is the release gate the CI uses: package.json's version only cuts a
// v{version} tag when it is greater than the newest existing v* tag.

export type ParsedVersion = {
  core: [number, number, number];
  prerelease: string[];
};

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export const parseVersion = (value: string): ParsedVersion | null => {
  const match = VERSION.exec(value.trim().replace(/^v/i, ""));
  if (!match) return null;

  const [, major, minor, patch, prerelease] = match;
  return {
    core: [Number(major), Number(minor), Number(patch)],
    prerelease: prerelease ? prerelease.split(".") : [],
  };
};

const compareIdentifiers = (left: string, right: string): number => {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;

  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export const compareVersions = (left: string, right: string): number | null => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;

  const [aMajor, aMinor, aPatch] = a.core;
  const [bMajor, bMinor, bPatch] = b.core;
  const coreDiff = aMajor - bMajor || aMinor - bMinor || aPatch - bPatch;
  if (coreDiff !== 0) return coreDiff;

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftId = a.prerelease[index];
    const rightId = b.prerelease[index];

    if (leftId === undefined) return -1;
    if (rightId === undefined) return 1;

    const diff = compareIdentifiers(leftId, rightId);
    if (diff !== 0) return diff;
  }

  return 0;
};

if (import.meta.main) {
  const [left, right] = process.argv.slice(2);

  if (!left || !right) {
    console.error("usage: bun run scripts/version-gt.ts <version> <other>");
    process.exit(2);
  }

  const result = compareVersions(left, right);
  if (result === null) {
    console.error(`invalid version comparison: ${left} vs ${right}`);
    process.exit(2);
  }

  console.log(result > 0 ? "true" : "false");
}
