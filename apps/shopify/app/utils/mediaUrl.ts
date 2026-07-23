/**
 * Extract the storage key/type (e.g. "hero-abc12345", "logo", "hero") from a
 * stored media URL by filename. This over-matches: ANY URL ending in
 * `/name.webp|svg` yields `name`, including external/manually-pasted URLs.
 *
 * Safe use is the server-side still-referenced guard only, where a bogus type
 * merely makes the guard over-inclusive (skips a deletion → benign orphan).
 * Do NOT use it to decide which files to DELETE client-side — an external
 * `.../logo.webp` would resolve to a real stored type and delete the wrong
 * file. Client deletion recording resolves the type via the authoritative
 * `mediaFiles` list instead (see ExplorerTab/CustomizationsTab).
 */
export function urlToMediaType(url: string): string | null {
    const match = url.match(/\/([^/]+)\.(?:webp|svg)(?:\?.*)?$/);
    return match?.[1] ?? null;
}
