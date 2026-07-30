/**
 * Build-time guard for the custom-element registrations.
 *
 * Every `src/components/*​/index.ts` exists for exactly one reason: its
 * `registerWebComponent()` call, which is what runs `customElements.define`.
 * Nothing imports a binding from those modules — `loader.ts` imports them
 * purely for that side effect — so a bundler told the package is
 * side-effect-free is free to drop the call entirely.
 *
 * That is not hypothetical: `"sideEffects": false` in the manifest did exactly
 * this, and the failure is silent in the worst way. The elements stay
 * `:not(:defined)`, which the loader's own FOUCE rule hides with
 * `display: none !important`, so components go *missing* rather than visibly
 * broken. No unit test catches it either, since the suite runs against `src`
 * where the side effect is intact — only the build artifact is affected.
 *
 * Hence a check on the emitted output. Expected tags are read from the
 * component sources rather than hardcoded, so a new component is covered the
 * moment it is added.
 */

/**
 * Tags that `registerWebComponent()` is called with in a source file.
 *
 * Matches the call in the component `index.ts` files, which pass the tag as
 * the second argument: `registerWebComponent(ButtonShare, "frak-button-share", [...])`.
 */
export function extractExpectedTags(source: string): string[] {
    const re = /registerWebComponent\s*\(\s*[\w$]+\s*,\s*["'`]([\w-]+)["'`]/g;
    return Array.from(source.matchAll(re), (m) => m[1]);
}

/**
 * Whether `tag` is registered anywhere in a bundled chunk.
 *
 * Deliberately not a bare search for the tag literal: components pass their own
 * tag to `useLightDomStyles(tag, ...)`, so the string survives in the chunk even
 * when the registration has been shaken out — a bare check passes on precisely
 * the broken build it is meant to catch.
 *
 * The registration is identified by its third argument instead: the observed
 * attributes array. `registerWebComponent(C, "frak-x", ["text", ...])` minifies
 * to ``r(h,`frak-x`,[`text`,...])``, so a tag literal followed by `,` then `[`
 * is the call, and the `useLightDomStyles` site (followed by `,` then an
 * identifier) is not.
 */
export function hasRegistration(chunk: string, tag: string): boolean {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`["'\`]${escaped}["'\`]\\s*,\\s*\\[`).test(chunk);
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
