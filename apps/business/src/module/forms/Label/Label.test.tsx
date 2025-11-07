import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "./index";

vi.mock("@radix-ui/react-label", () => ({
    Root: ({ children, className, htmlFor, ...props }: any) => (
        <label className={className} htmlFor={htmlFor} {...props}>
            {children}
        </label>
    ),
}));

describe("Label", () => {
    it("should render label text", () => {
        render(<Label>Test Label</Label>);

        expect(screen.getByText("Test Label")).toBeInTheDocument();
    });

    it("should render as label element", () => {
        const { container } = render(<Label>Label</Label>);

        const label = container.querySelector("label");
        expect(label).toBeInTheDocument();
    });

    it("should apply htmlFor attribute", () => {
        render(<Label htmlFor="input-id">Label</Label>);

        const label = screen.getByText("Label");
        // htmlFor is converted to for in HTML
        expect(label).toHaveAttribute("for", "input-id");
    });

    it("should apply custom className", () => {
        render(<Label className="custom-label">Label</Label>);

        const label = screen.getByText("Label");
        expect(label.className).toContain("custom-label");
    });
});
