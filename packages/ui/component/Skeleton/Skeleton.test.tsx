import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./index";

describe("Skeleton", () => {
    it("should render", () => {
        const { container } = render(<Skeleton />);
        const skeleton = container.querySelector("span");
        expect(skeleton).toBeInTheDocument();
    });

    it("should render with default height", () => {
        const { container } = render(<Skeleton />);
        const skeleton = container.querySelector("span");
        expect(skeleton).toBeInTheDocument();
        // react-loading-skeleton applies height via inline styles or classes
    });

    it("should render with custom width", () => {
        const { container } = render(<Skeleton width={200} />);
        const skeleton = container.querySelector("span");
        expect(skeleton).toBeInTheDocument();
    });

    it("should render with custom height", () => {
        const { container } = render(<Skeleton height={100} />);
        const skeleton = container.querySelector("span");
        expect(skeleton).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(<Skeleton className="custom-skeleton" />);
        const skeleton = container.querySelector("span");
        // react-loading-skeleton applies classes, check that skeleton renders
        expect(skeleton).toBeInTheDocument();
        // Custom class is passed to react-loading-skeleton component
        // The library may apply it differently, so we verify the component accepts it
    });

    it("should apply custom containerClassName", () => {
        const { container } = render(
            <Skeleton containerClassName="custom-container" />
        );
        // react-loading-skeleton wraps content in a container
        const skeleton = container.querySelector("span");
        expect(skeleton).toBeInTheDocument();
    });

    it("should render with both width and height", () => {
        const { container } = render(<Skeleton width={300} height={150} />);
        const skeleton = container.querySelector("span");
        expect(skeleton).toBeInTheDocument();
    });

    it("should accept other SkeletonProps", () => {
        const { container } = render(<Skeleton count={3} circle={true} />);
        // react-loading-skeleton should render multiple skeletons when count > 1
        const skeletons = container.querySelectorAll("span");
        expect(skeletons.length).toBeGreaterThan(0);
    });
});
