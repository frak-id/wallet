import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CropSource,
    cropImageFile,
    readCropSource,
    releaseCropSource,
} from "./cropImage";

const createObjectURL = vi.fn(() => "blob:source");
const revokeObjectURL = vi.fn();

function decodesAs(width: number, height: number) {
    HTMLImageElement.prototype.decode = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
        width
    );
    vi.spyOn(
        HTMLImageElement.prototype,
        "naturalHeight",
        "get"
    ).mockReturnValue(height);
}

const file = (name: string, type: string) => new File(["x"], name, { type });

beforeEach(() => {
    Object.assign(URL, { createObjectURL, revokeObjectURL });
});

afterEach(() => {
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
});

describe("readCropSource", () => {
    it("leaves SVGs alone without decoding them", async () => {
        expect(
            await readCropSource(file("logo.svg", "image/svg+xml"), "logo")
        ).toBeNull();
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("returns null and frees the URL when the file cannot be decoded", async () => {
        expect(
            await readCropSource(file("broken.png", "image/png"), "logo")
        ).toBeNull();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:source");
    });

    it("returns null and frees the URL when no crop reaches the minimum size", async () => {
        decodesAs(600, 300);
        expect(
            await readCropSource(file("tiny.png", "image/png"), "hero")
        ).toBeNull();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:source");
    });

    it("keeps the decoded image and its crop plan", async () => {
        decodesAs(1200, 300);
        const source = await readCropSource(
            file("wordmark.png", "image/png"),
            "logo"
        );
        expect(source).toMatchObject({
            src: "blob:source",
            size: { width: 1200, height: 300 },
            fits: false,
            initial: { label: "2:1" },
        });
        expect(source?.image).toBeInstanceOf(HTMLImageElement);
        expect(revokeObjectURL).not.toHaveBeenCalled();

        if (source) releaseCropSource(source);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:source");
    });
});

describe("cropImageFile", () => {
    const drawImage = vi.fn();
    let encodedAs: string | undefined;

    function stubCanvas(encodes: (type: string) => string | null) {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage,
        } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (callback, type) => {
                encodedAs = type;
                const output = encodes(type ?? "image/png");
                callback(output ? new Blob(["out"], { type: output }) : null);
            }
        );
    }

    const source = (type: string, name = "photo.source") =>
        ({
            file: file(name, type),
            image: new Image(),
            src: "blob:source",
            size: { width: 1600, height: 1600 },
        }) as CropSource;

    const area = { x: 0, y: 200, width: 1600, height: 1200 };

    afterEach(() => {
        drawImage.mockClear();
        encodedAs = undefined;
    });

    it("draws the chosen area of the decoded image at the output size", async () => {
        stubCanvas((type) => type);
        const input = source("image/jpeg");
        await cropImageFile({
            source: input,
            area,
            aspect: 4 / 3,
            kind: "hero",
        });
        expect(drawImage).toHaveBeenCalledWith(
            input.image,
            0,
            200,
            1600,
            1200,
            0,
            0,
            1600,
            1200
        );
    });

    it("keeps JPEG as JPEG", async () => {
        stubCanvas((type) => type);
        const out = await cropImageFile({
            source: source("image/jpeg", "photo.jpeg"),
            area,
            aspect: 4 / 3,
            kind: "hero",
        });
        expect(encodedAs).toBe("image/jpeg");
        expect(out).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
    });

    it("turns other formats into WebP", async () => {
        stubCanvas((type) => type);
        const out = await cropImageFile({
            source: source("image/png", "logo.png"),
            area,
            aspect: 4 / 3,
            kind: "hero",
        });
        expect(out).toMatchObject({ name: "logo.webp", type: "image/webp" });
    });

    it("names the file after what the browser actually encoded", async () => {
        stubCanvas(() => "image/png");
        const out = await cropImageFile({
            source: source("image/gif", "anim.gif"),
            area,
            aspect: 4 / 3,
            kind: "hero",
        });
        expect(out).toMatchObject({ name: "anim.png", type: "image/png" });
    });

    it("fails when the canvas cannot encode", async () => {
        stubCanvas(() => null);
        await expect(
            cropImageFile({
                source: source("image/png"),
                area,
                aspect: 4 / 3,
                kind: "hero",
            })
        ).rejects.toThrow("Could not encode");
    });
});
