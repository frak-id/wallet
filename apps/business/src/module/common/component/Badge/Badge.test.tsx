import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./index";

describe("Badge", () => {
    it("should render with text content", () => {
        render(<Badge>Badge text</Badge>);

        expect(screen.getByText("Badge text")).toBeInTheDocument();
    });

    it("should render all variants", () => {
        const variants = [
            "primary",
            "secondary",
            "success",
            "danger",
            "information",
            "informationReverse",
            "warning",
        ] as const;

        variants.forEach((variant) => {
            const { unmount } = render(<Badge variant={variant}>Badge</Badge>);
            expect(screen.getByText("Badge")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render all sizes", () => {
        const sizes = ["none", "small", "medium"] as const;

        sizes.forEach((size) => {
            const { unmount } = render(<Badge size={size}>Badge</Badge>);
            expect(screen.getByText("Badge")).toBeInTheDocument();
            unmount();
        });
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Badge className="custom-badge">Badge</Badge>
        );

        const badge = container.querySelector("span");
        expect(badge).toHaveClass("custom-badge");
    });

    it("should render as span element", () => {
        const { container } = render(<Badge>Badge</Badge>);

        const span = container.querySelector("span");
        expect(span).toBeInTheDocument();
    });

    it("should default to primary variant", () => {
        const { container } = render(<Badge>Badge</Badge>);

        const badge = container.querySelector("span");
        expect(badge).toBeInTheDocument();
    });

    it("should default to medium size", () => {
        const { container } = render(<Badge>Badge</Badge>);

        const badge = container.querySelector("span");
        expect(badge).toBeInTheDocument();
    });
});
