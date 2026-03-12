import validate from "./validatePublicAnimations.generated.js";
import type {
  PublicAnimationDefinition as GeneratedPublicAnimationDefinition,
  PublicAnimationManifest as GeneratedPublicAnimationManifest,
} from "./publicAnimations.generated";

export type PublicAnimationDefinition = GeneratedPublicAnimationDefinition;
export type PublicAnimationManifest = GeneratedPublicAnimationManifest;

export function isPublicAnimationManifest(
  value: unknown,
): value is PublicAnimationManifest {
  return validate(value);
}

function assertPublicAnimationManifest(
  value: unknown,
): asserts value is PublicAnimationManifest {
  if (validate(value)) {
    return;
  }

  throw new Error(formatValidationErrors(validate.errors));
}

export function parsePublicAnimationManifest(
  value: unknown,
): PublicAnimationManifest {
  assertPublicAnimationManifest(value);
  return value;
}

function formatValidationErrors(
  errors: { instancePath: string; message?: string }[] | null | undefined,
): string {
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
