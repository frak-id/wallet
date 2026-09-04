/**
 * DPR ladder for the element's rendered size.
 *  - "small" (default): sm 1x, md 2x, lg 3x. Correct for anything the app
 *    shell caps at ~430px CSS — merchant logos and Explorer heroes alike.
 *  - "large": md 1x, lg 2x. For elements already near the md box at 1x
 *    (e.g. the ~195px listener modal header logo).
 */
export type MediaSrcSetMode = "small" | "large";

/** Host serving merchant media on every stage (see infra/config.ts). */
const MEDIA_CDN_HOST = "cdn.gcp.frak.id";

/**
 * Derive a responsive `srcSet` from a canonical merchant-media URL.
 *
 * The backend stores size variants alongside the canonical object:
 *   {stem}.webp (lg, canonical) + {stem}-md.webp + {stem}-sm.webp
 * Variant URLs are derived purely by inserting the size suffix before `.webp`,
 * so no extra API field is needed.
 *
 * - Non-webp URLs (SVG or anything unexpected) get no `srcSet`; the canonical
 *   URL is returned as-is so vector logos keep working untouched.
 * - URLs not hosted on the Frak media CDN get no `srcSet` either: merchants can
 *   register arbitrary external URLs, and derived `-sm`/`-md` variants would 404
 *   on foreign hosts. Matching is on the URL hostname (not a substring) so
 *   `https://evil.com/frak.webp` doesn't qualify.
 * - Uses DPR (`x`) descriptors so no `sizes` attribute is needed — this matters
 *   because most logos are height-constrained with `width: auto`, and it keeps
 *   full-bleed images from having to restate the shell's width breakpoints.
 *
 * @example
 * <img {...mediaSrcSet(logoUrl)} alt="" />
 */
export function mediaSrcSet(
    url: string,
    mode: MediaSrcSetMode = "small"
): { src: string; srcSet?: string } {
    // Only Frak-hosted media has derived size variants; merchant-registered
    // external URLs (or relative/malformed ones) are served as-is.
    try {
        if (new URL(url).hostname !== MEDIA_CDN_HOST) return { src: url };
    } catch {
        return { src: url };
    }

    const match = url.match(/^(.*)\.webp(\?.*)?$/);
    if (!match) return { src: url };

    const [, stem, query = ""] = match;
    const variant = (size: "sm" | "md") => `${stem}-${size}.webp${query}`;

    const srcSet =
        mode === "large"
            ? `${variant("md")} 1x, ${url} 2x`
            : `${variant("sm")} 1x, ${variant("md")} 2x, ${url} 3x`;

    return { src: url, srcSet };
}
