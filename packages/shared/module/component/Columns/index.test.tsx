import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Column, Columns } from ".";

describe("<Columns />", () => {
    test("should render component", () => {
        const { container } = render(<Columns />);
        const firstChild = container.firstChild as Element;
        expect(firstChild).toBeDefined();
        expect(firstChild?.classList.contains("columns")).toBe(true);
    });
});

describe("<Column />", () => {
    test("should render component", () => {
        const { container } = render(<Column />);
        const firstChild = container.firstChild as Element;
        expect(firstChild).toBeDefined();
        expect(firstChild?.classList.contains("column")).toBe(true);
    });
});
