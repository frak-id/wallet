import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from ".";

describe("Avatar", () => {
    it("should render initials from a two-word name", () => {
        const { getByText } = render(<Avatar name="Acme Store" />);
        expect(getByText("AS")).toBeTruthy();
    });

    it("should use the first two words of a longer name", () => {
        const { getByText } = render(<Avatar name="E-Commerce Store Plus" />);
        expect(getByText("ES")).toBeTruthy();
    });

    it("should use the first two letters of a single-word name", () => {
        const { getByText } = render(<Avatar name="Frak" />);
        expect(getByText("FR")).toBeTruthy();
    });

    it("should uppercase lowercase input", () => {
        const { getByText } = render(<Avatar name="acme store" />);
        expect(getByText("AS")).toBeTruthy();
    });

    it("should ignore extra whitespace", () => {
        const { getByText } = render(<Avatar name="  acme   store  " />);
        expect(getByText("AS")).toBeTruthy();
    });

    it("should render all sizes", () => {
        const sizes = ["s", "m"] as const;
        for (const size of sizes) {
            const { getByText, unmount } = render(
                <Avatar name="Acme Store" size={size} />
            );
            expect(getByText("AS")).toBeTruthy();
            unmount();
        }
    });

    it("should forward className", () => {
        const { container } = render(
            <Avatar name="Acme Store" className="custom" />
        );
        expect(container.querySelector(".custom")).toBeTruthy();
    });

    it("should have aria-hidden", () => {
        const { container } = render(<Avatar name="Acme Store" />);
        const span = container.querySelector("span");
        expect(span?.getAttribute("aria-hidden")).toBe("true");
    });
});
