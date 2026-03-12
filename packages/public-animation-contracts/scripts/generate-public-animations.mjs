import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const srcDir = path.join(packageRoot, "src");
const outputPath = path.join(srcDir, "publicAnimations.generated.ts");
const validatorJsPath = path.join(srcDir, "validatePublicAnimations.generated.js");
const validatorDtsPath = path.join(srcDir, "validatePublicAnimations.generated.d.ts");
const publicAssetsPackageJsonPath = require.resolve("@towncord/public-assets/package.json");
const publicAssetsRoot = path.dirname(publicAssetsPackageJsonPath);
const schemaPath = path.join(publicAssetsRoot, "schema", "public-animations.schema.json");
const isCheckMode = process.argv.includes("--check");

const GENERATED_BANNER =
  "// This file is generated from @towncord/public-assets/schema/public-animations.schema.json.\n"
  + "// Do not edit manually.\n";

function buildTypesOutput(compiledTypes) {
  const normalized = compiledTypes.replace(/\r\n/g, "\n").trimEnd();
  return `${normalized}

export type PublicAnimationManifest = TowncordPublicAnimationsManifest;
export type PublicAnimationDefinition = Animation;
export type PublicAnimationFrameSize = FrameSize;
`;
}

function assertBrowserSafeStandalone(code) {
  if (code.includes("ajv/dist/runtime")) {
    throw new Error(
      "Generated public animation validator still references AJV runtime helpers. "
      + "Keep the standalone validator browser-safe so AJV is not bundled into the frontend.",
    );
  }
}

async function buildValidatorJs(schema) {
  const { Ajv2020 } = await import("ajv/dist/2020.js");
  const { default: standaloneCode } = await import("ajv/dist/standalone/index.js");
  const ajv = new Ajv2020({
    allErrors: true,
    code: { source: true, esm: true },
  });
  // Force a fully self-contained validator. AJV's unicode string-length helper
  // pulls in ajv/dist/runtime/ucs2length, which leaks AJV into the frontend bundle.
  ajv.opts.unicode = false;
  const validate = ajv.compile(schema);
  const code = standaloneCode(ajv, validate);
  const normalized = code.replace(/\r\n/g, "\n").trimEnd();
  assertBrowserSafeStandalone(normalized);
  return `${GENERATED_BANNER}\n${normalized}\n`;
}

function buildValidatorDts() {
  return `${GENERATED_BANNER}
import type { PublicAnimationManifest } from "./publicAnimations.generated";

declare function validate(data: unknown): data is PublicAnimationManifest;
declare namespace validate {
  let errors: {
    keyword: string;
    instancePath: string;
    schemaPath: string;
    params: Record<string, unknown>;
    message?: string;
  }[] | null;
}

export default validate;
export { validate };
`;
}

async function writeIfChanged(filePath, nextContent) {
  let currentContent = null;
  try {
    currentContent = await readFile(filePath, "utf8");
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  if (currentContent === nextContent) {
    return;
  }

  if (isCheckMode) {
    throw new Error(
      `Generated file "${path.basename(filePath)}" is out of date. Run \`npm run -w @towncord/public-animation-contracts generate\`.`,
    );
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, nextContent);
}

async function main() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));

  const compiledTypes = await compile(schema, "PublicAnimationManifest", {
    bannerComment: GENERATED_BANNER,
    unreachableDefinitions: true,
  });

  await Promise.all([
    writeIfChanged(outputPath, buildTypesOutput(compiledTypes)),
    writeIfChanged(validatorJsPath, await buildValidatorJs(schema)),
    writeIfChanged(validatorDtsPath, buildValidatorDts()),
  ]);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
