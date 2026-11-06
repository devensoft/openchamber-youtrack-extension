import { describe, expect, test } from "bun:test";

import { compareVersions } from "./version-gt";

describe("compareVersions", () => {
  test("orders core versions", () => {
    expect(compareVersions("0.2.0", "0.1.0")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.0", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "0.9.9")).toBeGreaterThan(0);
  });

  test("handles prereleases", () => {
    expect(compareVersions("0.2.0", "0.2.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0-beta.2", "0.2.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0-beta.1", "0.2.0-beta")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0-alpha", "0.2.0-beta")).toBeLessThan(0);
    expect(compareVersions("0.2.0-1", "0.2.0-alpha")).toBeLessThan(0);
  });

  test("ignores a leading v and build metadata", () => {
    expect(compareVersions("v1.0.0+build.2", "1.0.0")).toBe(0);
  });

  test("rejects invalid versions", () => {
    expect(compareVersions("one", "1.0.0")).toBeNull();
    expect(compareVersions("1.0.0", "1.0")).toBeNull();
  });
});
