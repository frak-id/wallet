/**
 * Noop stub aliased over rrweb in the IIFE/CDN bundles, which inline every
 * dependency and would otherwise pull it in through @openpanel/web's dynamic
 * `replay` chunk — rolldown's DCE keeps that `await import(...)` even behind a
 * build-time define, so the alias is the only lever. Session replay is never
 * enabled, and the NPM builds keep the real dynamic import for consumers.
 */
export function record() {
    return () => {};
}
