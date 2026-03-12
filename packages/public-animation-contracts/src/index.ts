import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import publicAnimationsSchema from "@towncord/public-assets/schema/public-animations.schema.json";
import type {
  PublicAnimationDefinition as GeneratedPublicAnimationDefinition,
  PublicAnimationFrameSize as GeneratedPublicAnimationFrameSize,
  PublicAnimationManifest as GeneratedPublicAnimationManifest,
} from "./publicAnimations.generated";

export type PublicAnimationDefinition = GeneratedPublicAnimationDefinition;
export type PublicAnimationFrameSize = GeneratedPublicAnimationFrameSize;
export type PublicAnimationManifest = GeneratedPublicAnimationManifest;

export { publicAnimationsSchema };

const ajv = new Ajv2020({ allErrors: true });
const validatePublicAnimationManifest = ajv.compile(publicAnimationsSchema);

export function isPublicAnimationManifest(
  value: unknown,
): value is PublicAnimationManifest {
  return validatePublicAnimationManifest(value) as boolean;
}

export function assertPublicAnimationManifest(
  value: unknown,
): asserts value is PublicAnimationManifest {
  if (validatePublicAnimationManifest(value)) {
    return;
  }

  throw new Error(formatValidationErrors(validatePublicAnimationManifest.errors));
}

export function parsePublicAnimationManifest(
  value: unknown,
): PublicAnimationManifest {
  assertPublicAnimationManifest(value);
  return value;
}

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "Invalid public animation manifest.";
  }

  const details = errors
    .map((error) => {
      const location = error.instancePath || "/";
      return `${location} ${error.message ?? "is invalid"}`.trim();
    })
    .join("; ");

  return `Invalid public animation manifest: ${details}`;
}
