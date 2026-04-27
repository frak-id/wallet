import { HttpError } from "@backend-utils";
import sharp from "sharp";

/**
 * Constraints per image type:
 *  - maxWidth/maxHeight: bounding box for resize (aspect ratio preserved)
 *  - minWidth/minHeight: minimum input size
 *  - minRatio/maxRatio: allowed width/height aspect ratio range
 */
const imageConstraints = {
    logo: {
        maxWidth: 512,
        maxHeight: 512,
        minWidth: 128,
        minHeight: 128,
        minRatio: 0.5, // 1:2 (tall)
        maxRatio: 2, // 2:1 (wide)
    },
    hero: {
        maxWidth: 1200,
        maxHeight: 800,
        minWidth: 600,
        minHeight: 200,
        minRatio: 1.5, // 3:2
        maxRatio: 4, // 4:1
    },
} as const;

export type ImageType = keyof typeof imageConstraints;

type ProcessedImage = {
    buffer: Buffer;
    contentType: string;
};

// Image validation errors are surfaced as 400 HttpError instances so Elysia
// returns a typed `t.ErrorResponse` body without bespoke handler wiring.

/**
 * Service for validating and processing merchant images
 *  - SVGs are passed through as-is (already vector, no compression needed)
 *  - Raster images are validated, resized within bounds, and converted to WebP
 */
export class ImageProcessingService {
    /**
     * Process an uploaded image file
     *  @throws {HttpError} (400) if the image doesn't meet constraints
     */
    async process(file: File, type: ImageType): Promise<ProcessedImage> {
        const arrayBuffer = await file.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        // SVG passthrough — already vector, no validation on dimensions
        if (file.type === "image/svg+xml") {
            return {
                buffer: inputBuffer,
                contentType: "image/svg+xml",
            };
        }

        const constraints = imageConstraints[type];

        // Read metadata to validate dimensions before processing
        const metadata = await sharp(inputBuffer).metadata();
        const width = metadata.width;
        const height = metadata.height;

        if (!width || !height) {
            throw HttpError.badRequest(
                "INVALID_IMAGE",
                "Could not read image dimensions"
            );
        }

        // Check minimum size
        if (width < constraints.minWidth || height < constraints.minHeight) {
            throw HttpError.badRequest(
                "IMAGE_TOO_SMALL",
                `Image must be at least ${constraints.minWidth}×${constraints.minHeight}px (got ${width}×${height}px)`
            );
        }

        // Check aspect ratio
        const ratio = width / height;
        if (ratio < constraints.minRatio || ratio > constraints.maxRatio) {
            const minLabel = formatRatio(constraints.minRatio);
            const maxLabel = formatRatio(constraints.maxRatio);
            throw HttpError.badRequest(
                "INVALID_ASPECT_RATIO",
                `Image aspect ratio must be between ${minLabel} and ${maxLabel} (got ${formatRatio(ratio)})`
            );
        }

        // Resize within bounding box (preserves original aspect ratio)
        const buffer = await sharp(inputBuffer)
            .resize(constraints.maxWidth, constraints.maxHeight, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: 82, effort: 4 })
            .toBuffer();

        return {
            buffer,
            contentType: "image/webp",
        };
    }
}

/**
 * Format a ratio as a human-readable string (e.g. 1.5 → "3:2")
 */
function formatRatio(ratio: number): string {
    // Try common ratios first for clean display
    const knownRatios: [number, string][] = [
        [0.5, "1:2"],
        [1, "1:1"],
        [1.5, "3:2"],
        [1.6, "16:10"],
        [16 / 9, "16:9"],
        [2, "2:1"],
        [3, "3:1"],
        [4, "4:1"],
    ];

    for (const [value, label] of knownRatios) {
        if (Math.abs(ratio - value) < 0.05) return label;
    }

    return `${ratio.toFixed(1)}:1`;
}
