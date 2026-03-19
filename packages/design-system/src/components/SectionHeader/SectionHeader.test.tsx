import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionHeader } from "./index";

describe("SectionHeader", () => {
    it("should render title text", () => {
        render(<SectionHeader title="History" />);
        expect(screen.getByText("History")).toBeInTheDocument();
    });

    it("should render action button with label when action provided", () => {
        const handleClick = vi.fn();
        render(
            <SectionHeader
                title="History"
                action={{ label: "See all", onClick: handleClick }}
            />
        );
        expect(screen.getByText("See all")).toBeInTheDocument();
    });

    it("should call onClick handler when action button clicked", () => {
        const handleClick = vi.fn();
        render(
            <SectionHeader
                title="History"
                action={{ label: "See all", onClick: handleClick }}
            />
        );
        fireEvent.click(screen.getByText("See all"));
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should not render action element when action prop omitted", () => {
        render(<SectionHeader title="History" />);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
