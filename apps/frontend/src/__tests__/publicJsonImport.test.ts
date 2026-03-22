import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  createPublicJsonImportModuleId,
  resolvePublicJsonImportRelativeAssetPath,
} from "../../publicJsonImport";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const PUBLIC_ASSETS_ROOT = path.join(FRONTEND_ROOT, "public", "assets");
const DONARG_OFFICE_ASSETS_ROOT = path.resolve(
  FRONTEND_ROOT,
  "../../packages/donarg-office-assets/assets",
);

describe("public json import helpers", () => {
  test("resolve the canonical and public layout paths to the same virtual module", () => {
    const relativeAssetPath = "donarg-office/default-layout.json";

    expect(
      resolvePublicJsonImportRelativeAssetPath(
        path.join(PUBLIC_ASSETS_ROOT, relativeAssetPath),
        {
          publicAssetsRoot: PUBLIC_ASSETS_ROOT,
          fallbackEntries: [
            [relativeAssetPath, path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json")],
          ],
        },
      ),
    ).toBe(relativeAssetPath);

    expect(
      resolvePublicJsonImportRelativeAssetPath(
        path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json"),
        {
          publicAssetsRoot: PUBLIC_ASSETS_ROOT,
          fallbackEntries: [
            [relativeAssetPath, path.join(DONARG_OFFICE_ASSETS_ROOT, "default-layout.json")],
          ],
        },
      ),
    ).toBe(relativeAssetPath);

    expect(createPublicJsonImportModuleId(relativeAssetPath)).toBe(
      `\0public-assets-json:${Buffer.from(relativeAssetPath).toString("base64url")}`,
    );
  });
});
