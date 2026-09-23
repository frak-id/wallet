/**
 * Build-time guard checking the emitted bundle actually registers every
 * custom element. `"sideEffects": false` can let a bundler drop the
 * `registerWebComponent()` side-effect silently — elements stay
 * `:not(:defined)`, hidden by the loader's FOUCE rule, so components go
 * missing rather than visibly broken. Expected tags are read from the
 * component sources rather than hardcoded, so new components are covered
 * automatically.
 */

/**
 * Tags that `registerWebComponent()` is called with in a source file, e.g.
 * `registerWebComponent(ButtonShare, "frak-button-share", [...])`.
 */
export function extractExpectedTags(source: string): string[] {
    const re = /registerWebComponent\s*\(\s*[\w$]+\s*,\s*["'`]([\w-]+)["'`]/g;
    return Array.from(source.matchAll(re), (m) => m[1]);
}

/**
 * Whether `tag` is registered anywhere in a bundled chunk.
 *
 * Matches the observed-attributes argument, not the tag literal, which
 * `useLightDomStyles(tag, ...)` also carries and so outlives a tree-shaken
 * registration. The minifier emits that argument as a literal array or as
 * ``\`a.b\`.split(\`.\`)``.
 */
export function hasRegistration(chunk: string, tag: string): boolean {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const attributes = `\\[|["'\`][^"'\`]*["'\`]\\s*\\.\\s*split\\s*\\(`;

    return new RegExp(`["'\`]${escaped}["'\`]\\s*,\\s*(?:${attributes})`).test(
        chunk
    );
}

/**
 * Expected tags that no chunk registers.
 */
export function findMissingRegistrations(
    expectedTags: readonly string[],
    chunks: readonly string[]
): string[] {
    return expectedTags.filter(
        (tag) => !chunks.some((chunk) => hasRegistration(chunk, tag))
    );
}
