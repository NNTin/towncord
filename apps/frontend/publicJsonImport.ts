import fs from "node:fs/promises";
import path from "node:path";

export const PUBLIC_ASSETS_JSON_PREFIX = "public-assets-json:";

export function createPublicJsonImportModuleId(relativeAssetPath: string): string {
  return `\0${PUBLIC_ASSETS_JSON_PREFIX}${Buffer.from(relativeAssetPath).toString("base64url")}`;
}

export async function resolvePublicJsonImportFilePath(
  relativeAssetPath: string,
  options: {
    publicAssetsRoot: string;
    fallbackEntries: ReadonlyArray<[string, string]>;
  },
): Promise<string> {
  const publicPath = path.resolve(options.publicAssetsRoot, relativeAssetPath);

  try {
    await fs.access(publicPath);
    return publicPath;
  } catch {
    const fallbackPath = options.fallbackEntries.find(
      ([candidateRelativeAssetPath]) =>
        candidateRelativeAssetPath === relativeAssetPath,
    )?.[1];

    if (fallbackPath) {
      return path.resolve(fallbackPath);
    }

    throw new Error(
      `Missing public JSON asset "${relativeAssetPath}" under ${options.publicAssetsRoot}.`,
    );
  }
}

export function resolvePublicJsonImportRelativeAssetPath(
  filePath: string,
  options: {
    publicAssetsRoot: string;
    fallbackEntries: ReadonlyArray<[string, string]>;
  },
): string | null {
  const normalizedFilePath = path.resolve(filePath);

  for (const [relativeAssetPath, fallbackPath] of options.fallbackEntries) {
    if (normalizedFilePath === path.resolve(options.publicAssetsRoot, relativeAssetPath)) {
      return relativeAssetPath;
    }

    if (normalizedFilePath === path.resolve(fallbackPath)) {
      return relativeAssetPath;
    }
  }

  return null;
}
