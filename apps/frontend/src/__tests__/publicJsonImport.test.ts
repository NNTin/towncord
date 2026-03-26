import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  createPublicJsonImportModuleId,
  resolvePublicJsonImportFilePath,
  resolvePublicJsonImportRelativeAssetPath,
} from "../../publicJsonImport";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const PUBLIC_ASSETS_ROOT = path.join(FRONTEND_ROOT, "public", "assets");
const DONARG_OFFICE_ASSETS_ROOT = path.resolve(
  FRONTEND_ROOT,
  "../../packages/donarg-office-assets/assets",
);
const TEMP_DIRECTORIES: string[] = [];

afterEach(async () => {
  await Promise.all(
    TEMP_DIRECTORIES.splice(0).map((directoryPath) =>
      fs.rm(directoryPath, { recursive: true, force: true }),
    ),
  );
});

async function createTemporaryPublicAssetsRoot(): Promise<string> {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "towncord-public-json-import-"),
  );
  TEMP_DIRECTORIES.push(tempDirectory);

  const publicAssetsRoot = path.join(tempDirectory, "public", "assets");
  await fs.mkdir(publicAssetsRoot, { recursive: true });
  return publicAssetsRoot;
}

describe("public json import helpers", () => {
  test("resolve the canonical and public layout paths to the same virtual module", () => {
    const relativeAssetPath = "donarg-office/default-layout.json";

    expect(
      resolvePublicJsonImportRelativeAssetPath(
        path.join(PUBLIC_ASSETS_ROOT, relativeAssetPath),
        {
          publicAssetsRoot: PUBLIC_ASSETS_ROOT,
          fallbackEntries: new Map([
            [relativeAssetPath, path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json")],
          ]),
        },
      ),
    ).toBe(relativeAssetPath);

    expect(
      resolvePublicJsonImportRelativeAssetPath(
        path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json"),
        {
          publicAssetsRoot: PUBLIC_ASSETS_ROOT,
          fallbackEntries: new Map([
            [relativeAssetPath, path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json")],
          ]),
        },
      ),
    ).toBe(relativeAssetPath);

    expect(createPublicJsonImportModuleId(relativeAssetPath)).toBe(
      `\0public-assets-json:${Buffer.from(relativeAssetPath).toString("base64url")}`,
    );
  });

  test("falls back to the canonical office layout path when the public copy is absent", async () => {
    const publicAssetsRoot = await createTemporaryPublicAssetsRoot();
    const relativeAssetPath = "donarg-office/default-layout.json";
    const fallbackPath = path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json");

    expect(
      await resolvePublicJsonImportFilePath(relativeAssetPath, {
        publicAssetsRoot,
        fallbackEntries: new Map([[relativeAssetPath, fallbackPath]]),
      }),
    ).toBe(path.resolve(fallbackPath));
  });

  test("terrain paths require the published public asset copy", async () => {
    const publicAssetsRoot = await createTemporaryPublicAssetsRoot();

    await expect(
      resolvePublicJsonImportFilePath("terrain/rulesets/phase1.json", {
        publicAssetsRoot,
        fallbackEntries: new Map(),
      }),
    ).rejects.toThrow(
      `Missing public JSON asset "terrain/rulesets/phase1.json" under ${publicAssetsRoot}.`,
    );
  });
});
