/**
 * DPR mapping for the element's rendered size.
 *  - "small" (default): elements up to ~64px → sm 1x, md 2x, lg 3x
 *  - "large": elements up to ~256px (e.g. the embedded wallet) → md 1x, lg 2x
 */
export type MediaSrcSetMode = "small" | "large";

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
 * - Uses DPR (`x`) descriptors so no `sizes` attribute is needed — this matters
 *   because most logos are height-constrained with `width: auto`.
 *
 * @example
 * <img {...mediaSrcSet(logoUrl)} alt="" />
 */
export function mediaSrcSet(
    url: string,
    mode: MediaSrcSetMode = "small"
): { src: string; srcSet?: string } {
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
