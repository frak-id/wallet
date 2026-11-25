import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/module/merchant/hook/useMediaUpload", () => ({
    useMediaUpload: () => ({
        mutate: vi.fn(),
        isPending: false,
        error: null,
        isSuccess: false,
        reset: vi.fn(),
    }),
    useMediaList: () => ({ data: [] }),
}));

import { ImageUploadField } from "./index";

function Field({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return (
        <ImageUploadField
            merchantId="merchant-1"
            type="logo"
            value={value}
            onChange={setValue}
            onUploadSuccess={setValue}
        />
    );
}

const urlInput = () => screen.queryByPlaceholderText("https://...");

describe("ImageUploadField", () => {
    it("shows the upload form when no image is set", () => {
        render(<Field initial="" />);
        expect(urlInput()).not.toBeNull();
        expect(
            screen.queryByAltText("merchantEdit.explorer.currentImage")
        ).toBeNull();
    });

    it("shows the current image instead of the form, and toggles it with Edit / Done", () => {
        render(<Field initial="https://cdn.example.com/logo.webp" />);
        expect(
            screen
                .getByAltText("merchantEdit.explorer.currentImage")
                .getAttribute("src")
        ).toBe("https://cdn.example.com/logo.webp");
        expect(urlInput()).toBeNull();

        fireEvent.click(screen.getByText("merchantEdit.explorer.editImage"));
        expect((urlInput() as HTMLInputElement).value).toBe(
            "https://cdn.example.com/logo.webp"
        );

        fireEvent.click(screen.getByText("merchantEdit.explorer.doneEditing"));
        expect(urlInput()).toBeNull();
    });

    it("falls back to a notice when the image fails to load", () => {
        render(<Field initial="https://cdn.example.com/broken.webp" />);
        fireEvent.error(
            screen.getByAltText("merchantEdit.explorer.currentImage")
        );
        expect(
            screen.getByText("merchantEdit.explorer.imageUnavailable")
        ).toBeTruthy();
    });

    it("returns to the upload form when the image is removed", () => {
        render(<Field initial="https://cdn.example.com/logo.webp" />);
        fireEvent.click(screen.getByText("merchantEdit.explorer.removeImage"));
        expect((urlInput() as HTMLInputElement).value).toBe("");
    });
});
