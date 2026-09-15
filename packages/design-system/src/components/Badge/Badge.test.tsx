import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from ".";

describe("Badge", () => {
    it("should render as span element", () => {
        const { container } = render(<Badge>Active</Badge>);
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should render children", () => {
        const { getByText } = render(<Badge variant="success">Success</Badge>);
        expect(getByText("Success")).toBeTruthy();
    });

    it("should forward className", () => {
        const { container } = render(<Badge className="custom">Test</Badge>);
        expect(container.querySelector(".custom")).toBeTruthy();
    });
});
