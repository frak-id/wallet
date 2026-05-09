import type { Plugin, Rollup } from "vite";

export function onwarn(
    warning: Rollup.RollupLog,
    warn: Rollup.LoggingFunction
) {
    /**
     * Hide warnings about invalid annotations
     * ../../node_modules/ox/_esm/core/Json.js (1:21): A comment
     * "/*#__PURE__/"
     * in "../../node_modules/ox/_esm/core/Json.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
     */
    if (
        warning.code === "INVALID_ANNOTATION" &&
        warning.url?.includes("#pure")
    ) {
        return;
    }

    /**
     * Hide warnings about Node.js modules being externalized for browser compatibility
     * These come from the ws package which has Node.js-specific code paths that won't be used in the browser
     */
    if (
        warning.plugin === "rolldown:vite-resolve" &&
        warning.message?.includes("externalized for browser compatibility") &&
        warning.message?.includes("ws/lib/")
    ) {
        return;
    }

    warn(warning);
}

/**
 * Shared Lightning CSS configuration for all Vite-based apps in the monorepo.
 * Provides consistent CSS processing with optimal performance and modern features.
 *
 * @example
 * ```ts
 * import { lightningCssConfig } from "@frak-labs/dev-tooling";
 *
 * export default defineConfig({
 *   css: lightningCssConfig,
 * });
 * ```
 */
export const lightningCssConfig = {
    transformer: "lightningcss" as const,
    lightningcss: {
        /**
         * CSS Modules configuration
         * - dashedIdents: false -> Use camelCase for class names (e.g., .my-class -> styles.myClass)
         */
        cssModules: {
            dashedIdents: false,
        },
        /**
         * Browser targets aligned with "baseline-widely-available"
         * Ensures broad compatibility while enabling modern CSS features
         */
        targets: {
            chrome: 100,
            edge: 100,
            firefox: 91,
            safari: 14,
        },
        /**
         * Enable modern CSS draft features
         * - nesting: Native CSS nesting support (replaces postcss-preset-env)
         * - customMedia: Custom media queries (@custom-media)
         */
        drafts: {
            nesting: true,
            customMedia: true,
        },
    },
};

/**
 * Build-time plugin that strips `internalType: "..."` annotations from ABI
 * literals across the source tree.
 *
 * Why: `internalType` is foundry/abitype metadata (e.g. `"contract Foo"`,
 * `"struct Bar[]"`) preserved by abigen. Viem and wagmi ignore it at runtime;
 * removing it from the bundled code shaves ~25–30 bytes per ABI input/output.
 * Across `rewarderHubAbi`, `multiWebAuthNValidatorV2Abi`, `campaignBankAbi`,
 * and the kernel ABIs that adds up to several KB of dead bytes.
 *
 * Scope:
 *   - Source files only (`.ts` / `.tsx` outside `node_modules`)
 *   - Production build only (skipped in dev)
 *   - Strips both `, internalType: "x"` and `internalType: "x",` forms
 *
 * Safety: `internalType` is exclusively used inside ABI literals in this
 * codebase (verified by grepping `apps/`, `packages/`, `services/`). The regex
 * matches the property unconditionally, so any new non-ABI use of the same key
 * would also be stripped — keep this in mind if a third-party tool ever
 * standardises on the name.
 */
export function stripAbiInternalType(): Plugin {
    // Match the `internalType` property:
    //   - optional leading whitespace (handles indented multi-line ABI items)
    //   - the key + colon + quoted value (string contains no internal `"`)
    //   - an optional trailing comma
    const internalTypeRe = /\s*internalType\s*:\s*"[^"]*",?/g;

    return {
        name: "frak:strip-abi-internal-type",
        apply: "build",
        enforce: "pre",
        transform(code, id) {
            if (id.includes("/node_modules/")) return null;
            if (!/\.tsx?$/.test(id)) return null;
            if (!code.includes("internalType")) return null;

            return {
                code: code.replace(internalTypeRe, ""),
                // No accurate source map — production-only optimisation, the
                // small offset shifts are not worth the MagicString overhead.
                map: null,
            };
        },
    };
}
