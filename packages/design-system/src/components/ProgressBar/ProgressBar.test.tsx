import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from ".";

describe("ProgressBar", () => {
    it("should expose progressbar semantics", () => {
        const { getByRole } = render(<ProgressBar value={25} />);
        const bar = getByRole("progressbar");
        expect(bar).toBeTruthy();
        expect(bar.getAttribute("aria-valuenow")).toBe("25");
        expect(bar.getAttribute("aria-valuemin")).toBe("0");
        expect(bar.getAttribute("aria-valuemax")).toBe("100");
    });

    it("should size the fill to the clamped value", () => {
        const { getByRole } = render(<ProgressBar value={75} />);
        const fill = getByRole("progressbar").firstElementChild as HTMLElement;
        expect(fill.style.width).toBe("75%");
    });

    it("should clamp values outside the 0-100 range", () => {
        const { getByRole, rerender } = render(<ProgressBar value={140} />);
        const bar = getByRole("progressbar");
        expect(bar.getAttribute("aria-valuenow")).toBe("100");
        expect((bar.firstElementChild as HTMLElement).style.width).toBe("100%");

        rerender(<ProgressBar value={-20} />);
        expect(bar.getAttribute("aria-valuenow")).toBe("0");
        expect((bar.firstElementChild as HTMLElement).style.width).toBe("0%");
    });

    it("should round fractional values", () => {
        const { getByRole } = render(<ProgressBar value={33.6} />);
        expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
            "34"
        );
    });

    it("should forward an accessible label", () => {
        const { getByRole } = render(
            <ProgressBar value={50} label="Wallet security" />
        );
        expect(getByRole("progressbar").getAttribute("aria-label")).toBe(
            "Wallet security"
        );
    });

    it("should forward className", () => {
        const { container } = render(
            <ProgressBar value={50} className="custom" />
        );
        expect(container.querySelector(".custom")).toBeTruthy();
    });
});
