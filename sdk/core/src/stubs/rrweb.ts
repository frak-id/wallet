/**
 * Stub for rrweb. The IIFE/CDN bundles inline every dependency
 * (alwaysBundle catch-all), which would also pull in rrweb via the dynamic
 * `replay` chunk loaded by @openpanel/web. Session replay is disabled in our
 * SDK, so we alias rrweb to a noop record() to keep the CDN bundle small.
 *
 * The NPM ESM/CJS builds don't need this alias: @openpanel/web 1.4.1+ loads
 * rrweb through a dynamic `import("./replay-…")`, so consumers' bundlers can
 * tree-shake / code-split it on their own.
 */
export function record() {
    return () => {};
}
