import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TextWithCopy } from "./index";

// Mock the copy hook
const mockCopy = vi.fn();
vi.mock("../../hook/useCopyToClipboardWithState", () => ({
    useCopyToClipboardWithState: () => ({
        copied: false,
        copy: mockCopy,
    }),
}));

describe("TextWithCopy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render text and copy button", () => {
        render(<TextWithCopy text="Test text">Test Content</TextWithCopy>);

        expect(screen.getByText("Test Content")).toBeInTheDocument();
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should not render when text is not provided", () => {
        const { container } = render(
            <TextWithCopy text={undefined}>Content</TextWithCopy>
        );
        expect(container.firstChild).toBeNull();
    });

    it("should call copy when button is clicked", () => {
        render(<TextWithCopy text="Text to copy">Content</TextWithCopy>);

        const button = screen.getByRole("button");
        fireEvent.click(button);

        expect(mockCopy).toHaveBeenCalledWith("Text to copy");
    });

    it("should render with children", () => {
        render(
            <TextWithCopy text="Text">
                <span data-testid="child">Child content</span>
            </TextWithCopy>
        );

        expect(screen.getByTestId("child")).toBeInTheDocument();
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should apply custom style", () => {
        const { container } = render(
            <TextWithCopy text="Text" style={{ color: "red" }}>
                Content
            </TextWithCopy>
        );

        const wrapper = container.querySelector("div");
        // Browser converts color names to RGB
        expect(wrapper).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });

    it("should render copy icon when not copied", () => {
        render(<TextWithCopy text="Text">Content</TextWithCopy>);

        const button = screen.getByRole("button");
        // Clipboard icon should be present (from lucide-react)
        expect(button).toBeInTheDocument();
    });
});
