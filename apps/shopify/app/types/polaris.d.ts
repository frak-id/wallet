/**
 * Local type definitions for Polaris Web Components migration.
 * Replaces deep internal imports from @shopify/polaris.
 */

/**
 * Badge tone type — replaces:
 * `import type { Tone } from "@shopify/polaris/build/ts/src/components/Badge"`
 */
export type BadgeTone =
    | "auto"
    | "neutral"
    | "info"
    | "success"
    | "caution"
    | "warning"
    | "critical";
