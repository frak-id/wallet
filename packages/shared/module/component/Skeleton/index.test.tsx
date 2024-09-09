import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Skeleton } from ".";

describe("<Skeleton />", () => {
    test("should render component", () => {
        const { container } = render(<Skeleton />);
        expect(container.firstChild).toBeDefined();
        const span = container.querySelector("span");
        expect(span).toHaveClass("skeleton");
    });
});
