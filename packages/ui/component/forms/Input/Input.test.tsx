import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "./index";

describe("Input", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with default props", () => {
        render(<Input />);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with value", () => {
        render(<Input value="test value" onChange={() => {}} />);
        expect(screen.getByRole("textbox")).toHaveValue("test value");
    });

    it("should render with placeholder", () => {
        render(<Input placeholder="Enter text" />);
        expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("should render with leftSection as string", () => {
        render(<Input leftSection="@" />);
        expect(screen.getByText("@")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with leftSection as ReactNode", () => {
        const LeftIcon = () => <span data-testid="left-icon">🔍</span>;
        render(<Input leftSection={<LeftIcon />} />);
        expect(screen.getByTestId("left-icon")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with rightSection as string", () => {
        render(<Input rightSection="✓" />);
        expect(screen.getByText("✓")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with rightSection as ReactNode", () => {
        const RightIcon = () => <span data-testid="right-icon">×</span>;
        render(<Input rightSection={<RightIcon />} />);
        expect(screen.getByTestId("right-icon")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should handle onChange events", () => {
        const handleChange = vi.fn();
        render(<Input onChange={handleChange} />);

        const input = screen.getByRole("textbox");
        fireEvent.change(input, { target: { value: "new value" } });

        expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("should handle onFocus events", () => {
        const handleFocus = vi.fn();
        render(<Input onFocus={handleFocus} />);

        const input = screen.getByRole("textbox");
        fireEvent.focus(input);

        expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it("should handle onBlur events", () => {
        const handleBlur = vi.fn();
        render(<Input onBlur={handleBlur} />);

        const input = screen.getByRole("textbox");
        fireEvent.blur(input);

        expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when disabled prop is true", () => {
        render(<Input disabled />);
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("should render with different length variants", () => {
        const lengths = ["small", "medium", "big"] as const;

        lengths.forEach((length) => {
            const { unmount } = render(<Input length={length} />);
            expect(screen.getByRole("textbox")).toBeInTheDocument();
            unmount();
        });
    });

    it("should apply custom className to input", () => {
        const { container } = render(<Input className="custom-input" />);
        const input = container.querySelector("input");
        expect(input).toHaveClass("custom-input");
    });

    it("should apply custom classNameWrapper", () => {
        const { container } = render(
            <Input classNameWrapper="custom-wrapper" />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper).toHaveClass("custom-wrapper");
    });

    it("should accept different input types", () => {
        const types = ["text", "email", "password", "number", "tel"] as const;

        types.forEach((type) => {
            const { container, unmount } = render(<Input type={type} />);
            const input = container.querySelector("input");
            expect(input).toHaveAttribute("type", type);
            // Password inputs don't have textbox role, so we check the element directly
            if (type === "number") {
                expect(screen.getByRole("spinbutton")).toBeInTheDocument();
            } else if (type === "password") {
                // Password inputs are not accessible via getByRole("textbox")
                expect(input).toBeInTheDocument();
            } else {
                expect(screen.getByRole("textbox")).toBeInTheDocument();
            }
            unmount();
        });
    });

    it("should render with both leftSection and rightSection", () => {
        render(<Input leftSection="@" rightSection="✓" />);
        expect(screen.getByText("@")).toBeInTheDocument();
        expect(screen.getByText("✓")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should handle controlled input", () => {
        const handleChange = vi.fn();
        const { rerender } = render(
            <Input value="initial" onChange={handleChange} />
        );

        expect(screen.getByRole("textbox")).toHaveValue("initial");

        rerender(<Input value="updated" onChange={handleChange} />);
        expect(screen.getByRole("textbox")).toHaveValue("updated");
    });
});
