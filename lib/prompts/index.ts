import {
  KARTLY_SYSTEM_PROMPT_V1,
  KARTLY_SYSTEM_PROMPT_V2,
  KARTLY_SYSTEM_PROMPT_V3,
  KARTLY_SYSTEM_PROMPT_V4,
  KARTLY_SYSTEM_PROMPT_V5,
  KARTLY_SYSTEM_PROMPT_V6,
  PROMPT_VERSION,
} from "./kartly-system";

export {
  KARTLY_SYSTEM_PROMPT_V1,
  KARTLY_SYSTEM_PROMPT_V2,
  KARTLY_SYSTEM_PROMPT_V3,
  KARTLY_SYSTEM_PROMPT_V4,
  KARTLY_SYSTEM_PROMPT_V5,
  KARTLY_SYSTEM_PROMPT_V6,
  PROMPT_VERSION,
};

export const PROMPT_VERSIONS = ["v1", "v2", "v3", "v4", "v5", "v6"] as const;
export type PromptVersion = (typeof PROMPT_VERSIONS)[number];

/**
 * Returns the exact system prompt string for the requested version.
 * If version is omitted or unknown, returns the latest production version (v6).
 */
export function getSystemPrompt(version: string = PROMPT_VERSION): string {
  const normalized = version.trim().toLowerCase();
  switch (normalized) {
    case "v1":
      return KARTLY_SYSTEM_PROMPT_V1;
    case "v2":
      return KARTLY_SYSTEM_PROMPT_V2;
    case "v3":
      return KARTLY_SYSTEM_PROMPT_V3;
    case "v4":
      return KARTLY_SYSTEM_PROMPT_V4;
    case "v5":
      return KARTLY_SYSTEM_PROMPT_V5;
    case "v6":
    case "latest":
      return KARTLY_SYSTEM_PROMPT_V6;
    default:
      console.warn(
        `[getSystemPrompt] Unknown version "${version}", defaulting to latest (${PROMPT_VERSION})`
      );
      return KARTLY_SYSTEM_PROMPT_V6;
  }
}
