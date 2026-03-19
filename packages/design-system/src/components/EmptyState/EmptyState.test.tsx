/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./index";

describe("EmptyState", () => {
    it("should render all elements when all props provided", () => {
        const handleClick = vi.fn();
        render(
            <EmptyState
                icon={<span data-testid="empty-icon">🛒</span>}
                title="No rewards yet"
                description="Start earning rewards"
                action={{ label: "Discover rewards", onClick: handleClick }}
            />
        );
        expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
        expect(screen.getByText("No rewards yet")).toBeInTheDocument();
        expect(screen.getByText("Start earning rewards")).toBeInTheDocument();
        expect(screen.getByText("Discover rewards")).toBeInTheDocument();
    });

    it("should render only title when minimal props provided", () => {
        render(<EmptyState title="Nothing here" />);
        expect(screen.getByText("Nothing here")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should call action.onClick when action button is clicked", () => {
        const handleClick = vi.fn();
        render(
            <EmptyState
                title="Empty"
                action={{ label: "Act now", onClick: handleClick }}
            />
        );
        fireEvent.click(screen.getByText("Act now"));
        expect(handleClick).toHaveBeenCalledOnce();
    });
});
