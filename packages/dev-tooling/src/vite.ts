import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { HtmlTagDescriptor, Plugin, Rollup } from "vite";

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

/**
 * Build-time plugin that inlines font-face CSS into `<style>` tags inside
 * `index.html` and emits `<link rel="preload">` hints for hand-picked font
 * files.
 *
 * Why: shipping `<link rel="stylesheet" href="/fonts/foo.css">` makes the CSS
 * a render-blocking dependency AND chains the woff2 fetch behind it (HTML →
 * css → woff2). Inlining the CSS removes the round-trip; preloading the
 * critical subset removes the chain. Net: ~150–450 ms saved on FCP/LCP
 * depending on network.
 *
 * Files are read at HTML transform time (works in dev and build). Paths are
 * resolved against the Vite project root so the plugin is portable across
 * apps in the monorepo.
 */
export type InlineFontFacesOptions = {
    /** Project-root-relative paths to CSS files to inline, in order. */
    cssFiles: string[];
    /**
     * Public URLs to add as `<link rel="preload" as="font" type="font/woff2"
     * crossorigin>`. Targets the LCP-critical subset — don't preload more than
     * 1–2 fonts or the budget gets eaten and other resources get delayed.
     */
    preload?: string[];
};

export function inlineFontFaces(options: InlineFontFacesOptions): Plugin {
    let projectRoot = process.cwd();
    return {
        name: "frak:inline-font-faces",
        configResolved(config) {
            projectRoot = config.root;
        },
        async transformIndexHtml() {
            const cssParts = await Promise.all(
                options.cssFiles.map((file) =>
                    fs.readFile(path.resolve(projectRoot, file), "utf-8")
                )
            );
            const css = cssParts.join("\n");

            const tags: HtmlTagDescriptor[] = [];
            for (const href of options.preload ?? []) {
                tags.push({
                    tag: "link",
                    attrs: {
                        rel: "preload",
                        as: "font",
                        type: "font/woff2",
                        crossorigin: "",
                        href,
                    },
                    injectTo: "head",
                });
            }
            tags.push({
                tag: "style",
                children: css,
                injectTo: "head",
            });
            return tags;
        },
    };
}
