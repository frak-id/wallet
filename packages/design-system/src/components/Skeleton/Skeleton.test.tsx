import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from ".";

describe("Skeleton", () => {
    it("should render text skeleton", () => {
        const { container } = render(<Skeleton variant="text" width="200px" />);
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should render circle skeleton", () => {
        const { container } = render(
            <Skeleton variant="circle" width="40px" height="40px" />
        );
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should render rect skeleton", () => {
        const { container } = render(
            <Skeleton variant="rect" height="100px" />
        );
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should apply custom width as inline style", () => {
        const { container } = render(<Skeleton width="200px" />);
        const span = container.querySelector("span");
        expect(span?.style.width).toBe("200px");
    });

    it("should apply numeric width as px", () => {
        const { container } = render(<Skeleton width={100} />);
        const span = container.querySelector("span");
        expect(span?.style.width).toBe("100px");
    });

    it("should forward className", () => {
        const { container } = render(<Skeleton className="custom" />);
        expect(container.querySelector(".custom")).toBeTruthy();
    });
});
