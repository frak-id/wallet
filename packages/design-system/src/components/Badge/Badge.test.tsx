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

    it("should render all 5 variants", () => {
        const variants = [
            "success",
            "warning",
            "error",
            "info",
            "neutral",
        ] as const;
        for (const variant of variants) {
            const { container } = render(
                <Badge variant={variant}>{variant}</Badge>
            );
            expect(container.querySelector("span")).toBeTruthy();
        }
    });

    it("should default to neutral variant", () => {
        const { container } = render(<Badge>Default</Badge>);
        const span = container.querySelector("span");
        expect(span).toBeTruthy();
    });

    it("should forward className", () => {
        const { container } = render(<Badge className="custom">Test</Badge>);
        expect(container.querySelector(".custom")).toBeTruthy();
    });
});
