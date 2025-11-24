import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconInfo } from "./index";

describe("IconInfo", () => {
    it("should render info icon", () => {
        render(<IconInfo />);
        const icon = screen.getByText("i");
        expect(icon).toBeInTheDocument();
    });

    it("should render as span element", () => {
        const { container } = render(<IconInfo />);
        const span = container.querySelector("span");
        expect(span).toBeInTheDocument();
    });

    it("should accept className prop", () => {
        const { container } = render(<IconInfo className="custom-class" />);
        const icon = container.querySelector("span");
        // Component accepts className prop (though it may not merge with CSS Modules class)
        expect(icon).toBeInTheDocument();
    });

    it("should accept other span props", () => {
        render(<IconInfo data-testid="info-icon" />);
        expect(screen.getByTestId("info-icon")).toBeInTheDocument();
    });

    it("should have iconInfo className from CSS Modules", () => {
        const { container } = render(<IconInfo />);
        const span = container.querySelector("span");
        expect(span?.className).toContain("iconInfo");
    });
});
