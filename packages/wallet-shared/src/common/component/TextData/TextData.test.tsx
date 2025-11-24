import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextData } from "./index";

describe("TextData", () => {
    it("should render children", () => {
        render(<TextData>Test content</TextData>);
        expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("should render with ReactNode children", () => {
        render(
            <TextData>
                <span data-testid="child">Child element</span>
            </TextData>
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
        render(
            <TextData>
                <div>First</div>
                <div>Second</div>
            </TextData>
        );
        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
    });

    it("should apply textData className", () => {
        const { container } = render(<TextData>Content</TextData>);
        const wrapper = container.querySelector("div");
        // CSS Modules generates hashed class names
        expect(wrapper?.className).toContain("textData");
    });
});
