import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TextArea } from "./index";

describe("TextArea", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with default props", () => {
        render(<TextArea />);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with value", () => {
        render(<TextArea value="test value" onChange={() => {}} />);
        expect(screen.getByRole("textbox")).toHaveValue("test value");
    });

    it("should render with placeholder", () => {
        render(<TextArea placeholder="Enter text" />);
        expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("should render with leftSection as string", () => {
        render(<TextArea leftSection="📝" />);
        expect(screen.getByText("📝")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with leftSection as ReactNode", () => {
        const LeftIcon = () => <span data-testid="left-icon">📝</span>;
        render(<TextArea leftSection={<LeftIcon />} />);
        expect(screen.getByTestId("left-icon")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with rightSection as string", () => {
        render(<TextArea rightSection="✓" />);
        expect(screen.getByText("✓")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with rightSection as ReactNode", () => {
        const RightIcon = () => <span data-testid="right-icon">✓</span>;
        render(<TextArea rightSection={<RightIcon />} />);
        expect(screen.getByTestId("right-icon")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should handle onChange events", () => {
        const handleChange = vi.fn();
        render(<TextArea onChange={handleChange} />);

        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, { target: { value: "new value" } });

        expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("should handle onFocus events", () => {
        const handleFocus = vi.fn();
        render(<TextArea onFocus={handleFocus} />);

        const textarea = screen.getByRole("textbox");
        fireEvent.focus(textarea);

        expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it("should handle onBlur events", () => {
        const handleBlur = vi.fn();
        render(<TextArea onBlur={handleBlur} />);

        const textarea = screen.getByRole("textbox");
        fireEvent.blur(textarea);

        expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when disabled prop is true", () => {
        render(<TextArea disabled />);
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("should render with different length variants", () => {
        const lengths = ["small", "medium", "big"] as const;

        lengths.forEach((length) => {
            const { unmount } = render(<TextArea length={length} />);
            expect(screen.getByRole("textbox")).toBeInTheDocument();
            unmount();
        });
    });

    it("should apply custom className to textarea", () => {
        const { container } = render(<TextArea className="custom-textarea" />);
        const textarea = container.querySelector("textarea");
        expect(textarea).toHaveClass("custom-textarea");
    });

    it("should apply custom classNameWrapper", () => {
        const { container } = render(
            <TextArea classNameWrapper="custom-wrapper" />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper).toHaveClass("custom-wrapper");
    });

    it("should handle controlled textarea", () => {
        const handleChange = vi.fn();
        const { rerender } = render(
            <TextArea value="initial" onChange={handleChange} />
        );

        expect(screen.getByRole("textbox")).toHaveValue("initial");

        rerender(<TextArea value="updated" onChange={handleChange} />);
        expect(screen.getByRole("textbox")).toHaveValue("updated");
    });

    it("should render with both leftSection and rightSection", () => {
        render(<TextArea leftSection="📝" rightSection="✓" />);
        expect(screen.getByText("📝")).toBeInTheDocument();
        expect(screen.getByText("✓")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should accept rows prop", () => {
        render(<TextArea rows={5} />);
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveAttribute("rows", "5");
    });

    it("should accept cols prop", () => {
        render(<TextArea cols={50} />);
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveAttribute("cols", "50");
    });
});
