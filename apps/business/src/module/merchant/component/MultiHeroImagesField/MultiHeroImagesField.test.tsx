import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}${JSON.stringify(opts)}` : key,
    }),
}));

vi.mock("@/module/merchant/hook/useMediaUpload", () => ({
    useMediaUpload: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
        error: null,
        reset: vi.fn(),
    }),
    useMediaList: () => ({ data: [] }),
}));

import { MultiHeroImagesField } from "./index";

function Field({ initial }: { initial: string[] }) {
    const [values, setValues] = useState(initial);
    return (
        <MultiHeroImagesField
            merchantId="merchant-1"
            values={values}
            onChange={setValues}
        />
    );
}

const urls = (n: number) =>
    Array.from(
        { length: n },
        (_, i) => `https://cdn.example.com/hero-${i}.webp`
    );

const slide = (index: number) =>
    `merchantEdit.explorer.slide${JSON.stringify({ index })}`;

describe("MultiHeroImagesField", () => {
    it("shows the full dropzone while the slider is empty", () => {
        render(<Field initial={[]} />);
        expect(
            screen.getByText("merchantEdit.explorer.dragAndDrop")
        ).toBeTruthy();
        expect(screen.queryByRole("list")).toBeNull();
    });

    it("shows one numbered tile per image, then an add tile with the count", () => {
        render(<Field initial={urls(2)} />);
        expect(screen.getByAltText(slide(1)).getAttribute("src")).toBe(
            "https://cdn.example.com/hero-0.webp"
        );
        expect(screen.getByAltText(slide(2))).toBeTruthy();
        expect(
            screen.getByRole("button", {
                name: "merchantEdit.explorer.addImage (2/4)",
            })
        ).toBeTruthy();
        expect(
            screen.queryByText("merchantEdit.explorer.dragAndDrop")
        ).toBeNull();
    });

    it("drops the add tile once 4 images are set", () => {
        render(<Field initial={urls(4)} />);
        expect(screen.getAllByRole("listitem")).toHaveLength(4);
        expect(screen.queryByText("merchantEdit.explorer.addImage")).toBeNull();
    });

    it("removes a slide and renumbers the rest", () => {
        render(<Field initial={urls(2)} />);
        fireEvent.click(
            screen.getByRole("button", {
                name: `merchantEdit.explorer.removeSlide${JSON.stringify({ index: 1 })}`,
            })
        );
        expect(screen.getByAltText(slide(1)).getAttribute("src")).toBe(
            "https://cdn.example.com/hero-1.webp"
        );
        expect(screen.queryByAltText(slide(2))).toBeNull();
    });
});
