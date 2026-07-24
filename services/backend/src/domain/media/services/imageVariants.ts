import sharp from "sharp";

/**
 * Shared, dependency-free (sharp-only) size-variant contract for merchant media.
 *
 * Storage layout (per merchant + base type):
 *   {merchantId}/{type}.webp        → canonical, "lg" (largest, source of truth)
 *   {merchantId}/{type}-md.webp     → medium downscale
 *   {merchantId}/{type}-sm.webp     → small downscale
 *
 * The canonical no-suffix object IS the "lg" size (no `-lg` file is written), so
 * existing consumers that read `{type}.webp` keep getting the full-size asset.
 * SVGs are vector and are never variant-processed (single canonical object).
 *
 * This module must NOT import anything beyond `sharp` so that the one-shot
 * bootstrap service (whose tsconfig cannot resolve `@backend-utils`) can import
 * it directly for the backfill step.
 */

export type ImageType = "logo" | "hero" | "icon";

/** Size variants, ordered small → large. `lg` maps to the canonical object. */
export const SIZE_VARIANTS = ["sm", "md", "lg"] as const;
export type SizeVariant = (typeof SIZE_VARIANTS)[number];

/**
 * Downscale variants that are written under a `-{size}` suffix. `lg` is excluded
 * because it is stored as the canonical, unsuffixed object.
 */
export const DOWNSCALE_VARIANTS = ["sm", "md"] as const;
export type DownscaleVariant = (typeof DOWNSCALE_VARIANTS)[number];

type SizeBox = { width: number; height: number };

export type ImageTypeConfig = {
    /** Minimum accepted input dimensions. */
    minWidth: number;
    minHeight: number;
    /** Allowed width/height aspect-ratio range. */
    minRatio: number;
    maxRatio: number;
    /**
     * Bounding box per size (aspect ratio preserved, never enlarged).
     * `lg` is the legacy maximum box and defines the canonical object.
     */
    sizes: Record<SizeVariant, SizeBox>;
};

export const imageTypeConfigs: Record<ImageType, ImageTypeConfig> = {
    logo: {
        minWidth: 128,
        minHeight: 128,
        minRatio: 0.5, // 1:2 (tall)
        maxRatio: 2, // 2:1 (wide)
        sizes: {
            sm: { width: 128, height: 128 },
            md: { width: 256, height: 256 },
            lg: { width: 512, height: 512 },
        },
    },
    hero: {
        minWidth: 800,
        minHeight: 450,
        minRatio: 1.33, // 4:3
        maxRatio: 2, // 2:1
        sizes: {
            sm: { width: 600, height: 400 },
            md: { width: 900, height: 600 },
            lg: { width: 1200, height: 800 },
        },
    },
    // Small, roughly-square illustration shown in place of the gift icon on the
    // post-purchase card and the referral banner.
    icon: {
        minWidth: 64,
        minHeight: 64,
        minRatio: 0.5, // 1:2 (tall)
        maxRatio: 2, // 2:1 (wide)
        sizes: {
            sm: { width: 128, height: 128 },
            md: { width: 256, height: 256 },
            lg: { width: 512, height: 512 },
        },
    },
};

const WEBP_OPTIONS = { quality: 82, effort: 4 } as const;

/**
 * Resize a source raster buffer into a single size's bounding box and encode as
 * WebP. Aspect ratio is preserved and the image is never enlarged, so a source
 * smaller than the target box is returned at its own size.
 */
export function resizeToVariant(
    input: Buffer,
    type: ImageType,
    size: SizeVariant
): Promise<Buffer> {
    const box = imageTypeConfigs[type].sizes[size];
    return sharp(input)
        .resize(box.width, box.height, {
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp(WEBP_OPTIONS)
        .toBuffer();
}

/**
 * Generate every WebP size variant (sm/md/lg) from a validated source buffer.
 * `lg` is the canonical object; `sm`/`md` are the suffixed downscales.
 */
export async function generateWebpVariants(
    input: Buffer,
    type: ImageType
): Promise<Record<SizeVariant, Buffer>> {
    const [sm, md, lg] = await Promise.all([
        resizeToVariant(input, type, "sm"),
        resizeToVariant(input, type, "md"),
        resizeToVariant(input, type, "lg"),
    ]);
    return { sm, md, lg };
}

/**
 * Resolve a stored base type (e.g. `logo`, `hero`, `hero-a1b2c3d4`,
 * `icon-a1b2c3d4`) to its {@link ImageType}, or `null` if unrecognized.
 * Size-suffixed keys (`logo-sm`, `hero-md`, …) must be stripped before calling.
 */
export function resolveImageType(storageType: string): ImageType | null {
    if (storageType === "logo") return "logo";
    if (storageType === "hero" || storageType.startsWith("hero-"))
        return "hero";
    if (storageType === "icon" || storageType.startsWith("icon-"))
        return "icon";
    return null;
}

/** Matches a size-variant suffix on a storage key stem, e.g. `logo-sm` → `sm`. */
export const SIZE_SUFFIX_PATTERN = /-(sm|md|lg)$/;
