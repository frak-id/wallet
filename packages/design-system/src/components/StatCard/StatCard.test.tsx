import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./index";

describe("StatCard", () => {
    it("should render amount and label as visible text", () => {
        render(<StatCard amount="0€" label="En attente" />);
        expect(screen.getByText("0€")).toBeInTheDocument();
        expect(screen.getByText("En attente")).toBeInTheDocument();
    });

    it("should apply highlighted class when highlighted=true", () => {
        const { rerender } = render(
            <StatCard amount="55€" label="Total" highlighted={false} />
        );
        const normalClass = screen.getByText("55€").className;

        rerender(<StatCard amount="55€" label="Total" highlighted={true} />);
        const highlightedClass = screen.getByText("55€").className;

        expect(normalClass).not.toBe(highlightedClass);
    });

    it("should render icon when provided", () => {
        render(
            <StatCard
                amount="10€"
                label="Total"
                icon={<span data-testid="stat-icon">★</span>}
            />
        );
        expect(screen.getByTestId("stat-icon")).toBeInTheDocument();
    });
});
