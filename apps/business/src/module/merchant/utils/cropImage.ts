import { cropOutputSize, type ImageKind } from "./imageRatio";

type Area = { x: number; y: number; width: number; height: number };

const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/png": "png",
};

/** Throws in jsdom, which has no `decode()`: callers treat that as "size unknown". */
export async function loadImage(src: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
}

/** PNG keeps logo transparency; Safari silently falls back to PNG when asked for WebP. */
function outputType(sourceType: string): string {
    return sourceType === "image/jpeg" || sourceType === "image/webp"
        ? sourceType
        : "image/png";
}

export async function cropImageFile({
    file,
    src,
    area,
    aspect,
    kind,
}: {
    file: File;
    src: string;
    area: Area;
    aspect: number;
    kind: ImageKind;
}): Promise<File> {
    const image = await loadImage(src);
    const { width, height } = cropOutputSize(area, aspect, kind);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(
        image,
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
        canvas.toBlob(resolve, outputType(file.type), 0.92)
    );
    if (!blob) throw new Error("Could not encode the cropped image");

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const extension = extensions[blob.type] ?? "png";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}
