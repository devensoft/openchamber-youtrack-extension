// Prints "true" when <left> is semver-greater than <right>, "false" otherwise.
// Exit code 2 means one of the inputs is not a valid version.
//
// This is the release gate the CI uses: package.json's version only cuts a
// v{version} tag when it is greater than the newest existing v* tag.

/** `null` when either input is not a valid semver version. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const compareVersions = (left: string, right: string): number | null => {
  const a = left.trim().replace(/^v/i, "");
  const b = right.trim().replace(/^v/i, "");

  // Bun.semver.order accepts short forms like "1.0"; the release gate should
  // not, so the shape is checked before comparing.
  if (!SEMVER.test(a) || !SEMVER.test(b)) return null;

  return Bun.semver.order(a, b);
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
