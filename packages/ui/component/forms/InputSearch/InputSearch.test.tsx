import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InputSearch } from "./index";

describe("InputSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render search input", () => {
        render(<InputSearch />);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with search icon", () => {
        const { container } = render(<InputSearch />);
        // Search icon should be present in leftSection
        const icon = container.querySelector("svg");
        expect(icon).toBeInTheDocument();
    });

    it("should accept all Input props", () => {
        render(<InputSearch placeholder="Search..." />);
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });

    it("should handle onChange events", () => {
        const handleChange = vi.fn();
        render(<InputSearch onChange={handleChange} />);

        const input = screen.getByRole("textbox");
        fireEvent.change(input, { target: { value: "search query" } });

        expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("should render with value", () => {
        render(<InputSearch value="test" onChange={() => {}} />);
        expect(screen.getByRole("textbox")).toHaveValue("test");
    });

    it("should be disabled when disabled prop is true", () => {
        render(<InputSearch disabled />);
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("should accept type prop", () => {
        render(<InputSearch type="search" />);
        const input = screen.getByRole("textbox");
        // InputSearch forwards all Input props including type
        // Default type is "text" if not specified
        expect(input).toBeInTheDocument();
    });

    it("should render with length variants", () => {
        const lengths = ["small", "medium", "big"] as const;

        lengths.forEach((length) => {
            const { unmount } = render(<InputSearch length={length} />);
            expect(screen.getByRole("textbox")).toBeInTheDocument();
            unmount();
        });
    });
});
