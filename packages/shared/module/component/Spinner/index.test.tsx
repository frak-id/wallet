import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Spinner } from ".";

describe("<Spinner />", () => {
    test("should render component", () => {
        const { container } = render(<Spinner />);
        expect(container.firstChild).toBeDefined();
        const span = container.querySelector("span");
        expect(span).toHaveClass("spinner");
    });
});
