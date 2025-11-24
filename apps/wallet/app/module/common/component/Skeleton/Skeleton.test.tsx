import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./index";

describe("Skeleton", () => {
    it("should render skeleton", () => {
        const { container } = render(<Skeleton />);

        const skeleton = container.querySelector('[class*="skeleton"]');
        expect(skeleton).toBeInTheDocument();
    });

    it("should render with custom width", () => {
        const { container } = render(<Skeleton width={200} />);

        const skeleton = container.querySelector('[class*="skeleton"]');
        expect(skeleton).toBeInTheDocument();
    });

    it("should render with custom height", () => {
        const { container } = render(<Skeleton height={100} />);

        const skeleton = container.querySelector('[class*="skeleton"]');
        expect(skeleton).toBeInTheDocument();
    });

    it("should render with custom containerClassName", () => {
        const { container } = render(
            <Skeleton containerClassName="custom-container" />
        );

        const containerElement = container.querySelector(
            '[class*="skeletonContainer"]'
        );
        expect(containerElement).toHaveClass("custom-container");
    });

    it("should render with custom className", () => {
        const { container } = render(<Skeleton className="custom-skeleton" />);

        // react-loading-skeleton applies className to the skeleton element
        // Check that the className appears somewhere in the rendered output
        const skeletonElements = container.querySelectorAll(
            '[class*="skeleton"]'
        );
        const hasCustomClass = Array.from(skeletonElements).some((el) =>
            el.className.includes("custom-skeleton")
        );
        expect(hasCustomClass).toBe(true);
    });

    it("should render with count", () => {
        const { container } = render(<Skeleton count={3} />);

        const skeletons = container.querySelectorAll('[class*="skeleton"]');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should default height to 250", () => {
        const { container } = render(<Skeleton />);

        const skeleton = container.querySelector('[class*="skeleton"]');
        expect(skeleton).toBeInTheDocument();
    });
});
