export type ImageKind = "logo" | "hero" | "icon";

type Size = { width: number; height: number };

export type RatioPreset = { label: string; value: number };

type RatioRule = {
    minRatio: number;
    maxRatio: number;
    minWidth: number;
    minHeight: number;
    /** Ascending, first and last are the accepted bounds. */
    presets: readonly RatioPreset[];
};

const squareRule = {
    minRatio: 0.5,
    maxRatio: 2,
    presets: [
        { label: "1:2", value: 1 / 2 },
        { label: "1:1", value: 1 },
        { label: "2:1", value: 2 },
    ],
} as const;

// Mirrors `imageTypeConfigs` in services/backend/src/domain/media/services/imageVariants.ts.
const ratioRules: Record<ImageKind, RatioRule> = {
    logo: { ...squareRule, minWidth: 128, minHeight: 128 },
    icon: { ...squareRule, minWidth: 64, minHeight: 64 },
    hero: {
        minRatio: 1.33,
        maxRatio: 2,
        minWidth: 800,
        minHeight: 450,
        presets: [
            { label: "4:3", value: 4 / 3 },
            { label: "16:9", value: 16 / 9 },
            { label: "2:1", value: 2 },
        ],
    },
};

const MAX_ZOOM = 4;
// The backend never stores more than 1200px, this only keeps the upload under its 10 MB cap.
const MAX_OUTPUT_SIDE = 2048;

export type CropPlan = {
    presets: RatioPreset[];
    initial: RatioPreset;
    /** The original is accepted as-is, so the merchant may skip the crop. */
    fits: boolean;
};

/** `null` when no crop of the image could reach the minimum size. */
export function planCrop(size: Size, kind: ImageKind): CropPlan | null {
    const { minRatio, maxRatio } = ratioRules[kind];
    const ratio = size.width / size.height;
    const fits = ratio >= minRatio && ratio <= maxRatio;

    const presets = croppablePresets(size, kind);
    const distance = (preset: RatioPreset) =>
        Math.abs(Math.log(ratio / preset.value));
    const initial = presets.reduce<RatioPreset | undefined>(
        (best, preset) =>
            !best || distance(preset) < distance(best) ? preset : best,
        undefined
    );
    return initial ? { presets, initial, fits } : null;
}

export function ratioRangeLabels(kind: ImageKind) {
    const { presets } = ratioRules[kind];
    return { min: presets[0]?.label, max: presets[presets.length - 1]?.label };
}

/** Largest crop of `aspect` inside the image, i.e. the crop at zoom 1. */
function fullCrop({ width, height }: Size, aspect: number): Size {
    return width / height > aspect
        ? { width: height * aspect, height }
        : { width, height: width / aspect };
}

function croppablePresets(size: Size, kind: ImageKind): RatioPreset[] {
    const { presets, minWidth, minHeight } = ratioRules[kind];
    return presets.filter((preset) => {
        const crop = fullCrop(size, preset.value);
        return crop.width >= minWidth && crop.height >= minHeight;
    });
}

/** Zoom past this and the crop drops under the minimum size the backend accepts. */
export function maxCropZoom(
    size: Size,
    aspect: number,
    kind: ImageKind
): number {
    const { minWidth, minHeight } = ratioRules[kind];
    const crop = fullCrop(size, aspect);
    const zoom = Math.min(crop.width / minWidth, crop.height / minHeight);
    return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

/** Integer canvas size for a crop; pixel rounding must never step outside the accepted range. */
export function cropOutputSize(
    area: Size,
    aspect: number,
    kind: ImageKind
): Size {
    const { minRatio, maxRatio } = ratioRules[kind];
    const scale = Math.min(
        1,
        MAX_OUTPUT_SIDE / Math.max(area.width, area.height)
    );
    const height = Math.max(1, Math.round(area.height * scale));
    const width = Math.round(height * aspect);
    if (width / height > maxRatio) {
        return { width: Math.floor(height * maxRatio), height };
    }
    if (width / height < minRatio) {
        return { width: Math.ceil(height * minRatio), height };
    }
    return { width, height };
}
