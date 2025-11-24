import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "./index";

vi.mock("@radix-ui/react-switch", () => ({
    Root: ({ children, className, checked, ...props }: any) => (
        <button
            type="button"
            role="switch"
            data-testid="switch"
            className={className}
            aria-checked={checked}
            {...props}
        >
            {children}
        </button>
    ),
    Thumb: ({ className }: any) => (
        <span data-testid="switch-thumb" className={className} />
    ),
}));

describe("Switch", () => {
    it("should render switch", () => {
        render(<Switch />);

        expect(screen.getByTestId("switch")).toBeInTheDocument();
    });

    it("should render thumb", () => {
        render(<Switch />);

        expect(screen.getByTestId("switch-thumb")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(<Switch className="custom-switch" />);

        const switchElement = screen.getByTestId("switch");
        expect(switchElement.className).toContain("custom-switch");
    });

    it("should handle checked state", () => {
        render(<Switch checked />);

        const switchElement = screen.getByTestId("switch");
        expect(switchElement).toHaveAttribute("aria-checked", "true");
    });

    it("should handle unchecked state", () => {
        render(<Switch checked={false} />);

        const switchElement = screen.getByTestId("switch");
        expect(switchElement).toHaveAttribute("aria-checked", "false");
    });
});
