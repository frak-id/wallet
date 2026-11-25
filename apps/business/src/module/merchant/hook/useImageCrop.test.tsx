import type { CropSource } from "@frak-labs/app-essentials/media/cropImage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readCropSource, releaseCropSource, cropped } = vi.hoisted(() => ({
    readCropSource: vi.fn(),
    releaseCropSource: vi.fn(),
    cropped: new File(["crop"], "crop.webp", { type: "image/webp" }),
}));

vi.mock("@frak-labs/app-essentials/media/cropImage", () => ({
    readCropSource,
    releaseCropSource,
}));

vi.mock("@/module/merchant/component/ImageCropDialog", () => ({
    ImageCropDialog: ({
        request,
        onSettle,
    }: {
        request: CropSource;
        onSettle: (file: File | null) => void;
    }) => (
        <div role="dialog" aria-label={request.file.name}>
            <button type="button" onClick={() => onSettle(cropped)}>
                crop
            </button>
            <button type="button" onClick={() => onSettle(null)}>
                cancel
            </button>
        </div>
    ),
}));

import { useImageCrop } from "./useImageCrop";

const original = new File(["x"], "photo.png", { type: "image/png" });

function Harness() {
    const { prepareImage, cropDialog } = useImageCrop("hero");
    const [result, setResult] = useState<string>("pending");
    return (
        <>
            <button
                type="button"
                onClick={async () => {
                    const file = await prepareImage(original);
                    setResult(file ? file.name : "cancelled");
                }}
            >
                drop
            </button>
            <output>{result}</output>
            {cropDialog}
        </>
    );
}

const result = () => screen.getByRole("status");

describe("useImageCrop", () => {
    beforeEach(() => {
        readCropSource.mockReset();
        releaseCropSource.mockReset();
    });

    it("passes the original through when no crop applies", async () => {
        readCropSource.mockResolvedValue(null);
        render(<Harness />);
        fireEvent.click(screen.getByText("drop"));
        await waitFor(() => expect(result().textContent).toBe("photo.png"));
        expect(readCropSource).toHaveBeenCalledWith(original, "hero");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("resolves with the crop and frees the decoded image", async () => {
        const source = { file: original, src: "blob:1" };
        readCropSource.mockResolvedValue(source);
        render(<Harness />);
        fireEvent.click(screen.getByText("drop"));
        fireEvent.click(await screen.findByText("crop"));
        await waitFor(() => expect(result().textContent).toBe("crop.webp"));
        expect(releaseCropSource).toHaveBeenCalledWith(source);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("resolves with null when the merchant cancels", async () => {
        readCropSource.mockResolvedValue({ file: original, src: "blob:2" });
        render(<Harness />);
        fireEvent.click(screen.getByText("drop"));
        fireEvent.click(await screen.findByText("cancel"));
        await waitFor(() => expect(result().textContent).toBe("cancelled"));
        expect(releaseCropSource).toHaveBeenCalledTimes(1);
    });
});
