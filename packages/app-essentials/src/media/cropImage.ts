import {
    type CropPlan,
    cropOutputSize,
    type ImageKind,
    planCrop,
} from "./imageRatio";

type Size = { width: number; height: number };

export type CropArea = Size & { x: number; y: number };

/** A decoded upload waiting for the merchant's crop; release it once settled. */
export type CropSource = CropPlan & {
    file: File;
    src: string;
    image: HTMLImageElement;
    size: Size;
};

const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/png": "png",
};

/** Throws in jsdom, which has no `decode()`. */
export async function loadImage(src: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
}

/**
 * `null` when the file should go up untouched: an SVG (a crop would rasterise
 * it), a file the browser cannot decode, or one too small for any preset.
 */
export async function readCropSource(
    file: File,
    kind: ImageKind
): Promise<CropSource | null> {
    if (file.type === "image/svg+xml") return null;

    const src = URL.createObjectURL(file);
    const image = await loadImage(src).catch(() => null);
    const size = image && {
        width: image.naturalWidth,
        height: image.naturalHeight,
    };
    const plan = size && planCrop(size, kind);
    if (!image || !size || !plan) {
        URL.revokeObjectURL(src);
        return null;
    }
    return { ...plan, file, src, image, size };
}

export function releaseCropSource(source: CropSource) {
    URL.revokeObjectURL(source.src);
}

/** WebP keeps transparency at a fraction of PNG's size; browsers that cannot encode it return PNG. */
function outputType(sourceType: string): string {
    return sourceType === "image/jpeg" ? sourceType : "image/webp";
}

export async function cropImageFile({
    source,
    area,
    aspect,
    kind,
}: {
    source: CropSource;
    area: CropArea;
    aspect: number;
    kind: ImageKind;
}): Promise<File> {
    const { width, height } = cropOutputSize(area, aspect, kind);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(
        source.image,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        width,
        height
    );

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType(source.file.type), 0.92)
    );
    if (!blob) throw new Error("Could not encode the cropped image");

    const baseName = source.file.name.replace(/\.[^.]+$/, "");
    const extension = extensions[blob.type] ?? "png";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}
