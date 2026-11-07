import { expect, test } from "bun:test";

import { parseManifestJson } from "@openchamber/sdk/schemas";

test("package.json is a valid OpenChamber manifest", async () => {
  const result = parseManifestJson(await Bun.file("package.json").text());

  if (!result.ok) {
    throw new Error(`Invalid manifest (${result.code}): ${result.message}`);
  }

  expect(result.manifest.contributes.panel?.name).toBe("YouTrack");
  // Native projects/mapping only: no rail panel page, no sessions capability.
  expect(result.manifest.contributes.panel?.entry).toBeUndefined();
  expect(result.manifest.contributes.capabilities).toBeUndefined();
  expect(result.manifest.contributes.tracker?.label).toBe("YouTrack");
  expect(result.manifest.contributes.tracker?.capabilities.projectMapping).toBe(true);
});
