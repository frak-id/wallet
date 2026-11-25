import type { CropSource } from "@frak-labs/app-essentials/media/cropImage";
import { planCrop } from "@frak-labs/app-essentials/media/imageRatio";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

const { cropImageFile, area } = vi.hoisted(() => ({
    cropImageFile: vi.fn(),
    area: { x: 0, y: 0, width: 1600, height: 900 },
}));

vi.mock("@frak-labs/app-essentials/media/cropImage", () => ({
    cropImageFile,
}));

vi.mock("react-easy-crop", () => ({
    default: ({
        aspect,
        onCropComplete,
    }: {
        aspect: number;
        onCropComplete: (area: unknown, pixels: unknown) => void;
    }) => {
        useEffect(() => onCropComplete(area, area), [onCropComplete]);
        return <div data-testid="cropper" data-aspect={aspect} />;
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { ImageCropDialog } from "./index";

function request(width: number, height: number): CropSource {
    const plan = planCrop({ width, height }, "hero");
    if (!plan) throw new Error("no plan");
    return {
        ...plan,
        file: new File(["x"], "photo.png", { type: "image/png" }),
        src: "blob:photo",
        image: new Image(),
        size: { width, height },
    };
}

const useAsIs = () =>
    screen.queryByRole("button", {
        name: "merchantEdit.explorer.crop.useAsIs",
    });
const confirm = () =>
    screen.getByRole("button", { name: "merchantEdit.explorer.crop.confirm" });

describe("ImageCropDialog", () => {
    it("offers no Use as is for an image outside the accepted ratio", () => {
        render(
            <ImageCropDialog
                request={request(1600, 1600)}
                kind="hero"
                onSettle={vi.fn()}
            />
        );
        expect(useAsIs()).toBeNull();
        expect(
            screen.getByText("merchantEdit.explorer.crop.description")
        ).toBeTruthy();
    });

    it("hands back the untouched original through Use as is", async () => {
        const onSettle = vi.fn();
        const input = request(1600, 900);
        render(
            <ImageCropDialog request={input} kind="hero" onSettle={onSettle} />
        );
        fireEvent.click(useAsIs() as HTMLElement);
        expect(onSettle).toHaveBeenCalledWith(input.file);
        expect(cropImageFile).not.toHaveBeenCalled();
    });

    it("crops the decoded source at the selected ratio", async () => {
        const output = new File(["c"], "photo.webp", { type: "image/webp" });
        cropImageFile.mockResolvedValueOnce(output);
        const onSettle = vi.fn();
        const input = request(1600, 1600);
        render(
            <ImageCropDialog request={input} kind="hero" onSettle={onSettle} />
        );

        fireEvent.mouseDown(screen.getByRole("tab", { name: "16:9" }), {
            button: 0,
        });
        expect(screen.getByTestId("cropper").dataset.aspect).toBe(
            String(16 / 9)
        );
        fireEvent.click(confirm());

        expect(cropImageFile).toHaveBeenCalledWith({
            source: input,
            area,
            aspect: 16 / 9,
            kind: "hero",
        });
        await waitFor(() => expect(onSettle).toHaveBeenCalledWith(output));
    });

    it("stays open with an error when the crop fails", async () => {
        cropImageFile.mockRejectedValueOnce(new Error("encode"));
        const onSettle = vi.fn();
        render(
            <ImageCropDialog
                request={request(1600, 900)}
                kind="hero"
                onSettle={onSettle}
            />
        );
        fireEvent.click(confirm());
        await waitFor(() =>
            expect(
                screen.getByText("merchantEdit.explorer.crop.failed")
            ).toBeTruthy()
        );
        expect(onSettle).not.toHaveBeenCalled();
        expect(confirm()).not.toHaveProperty("disabled", true);
    });
});
