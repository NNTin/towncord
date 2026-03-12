import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const outputPath = path.join(packageRoot, "src", "publicAnimations.generated.ts");
const publicAssetsPackageJsonPath = require.resolve("@towncord/public-assets/package.json");
const publicAssetsRoot = path.dirname(publicAssetsPackageJsonPath);
const schemaPath = path.join(publicAssetsRoot, "schema", "public-animations.schema.json");
const isCheckMode = process.argv.includes("--check");

function buildOutput(compiledTypes) {
  const normalized = compiledTypes.replace(/\r\n/g, "\n").trimEnd();
  return `${normalized}

export type PublicAnimationManifest = TowncordPublicAnimationsManifest;
export type PublicAnimationDefinition = Animation;
export type PublicAnimationFrameSize = FrameSize;
`;
}

async function main() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const compiledTypes = await compile(schema, "PublicAnimationManifest", {
    bannerComment:
      "// This file is generated from @towncord/public-assets/schema/public-animations.schema.json.\n"
      + "// Do not edit manually.\n",
    unreachableDefinitions: true,
  });

  const nextOutput = buildOutput(compiledTypes);

  let currentOutput = null;
  try {
    currentOutput = await readFile(outputPath, "utf8");
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  if (currentOutput === nextOutput) {
    return;
  }

  if (isCheckMode) {
    throw new Error(
      "Generated public animation contracts are out of date. Run `npm run -w @towncord/public-animation-contracts generate`.",
    );
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextOutput);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
