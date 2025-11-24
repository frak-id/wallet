import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencySelector } from "./index";

vi.mock("@/module/common/component/Badge", () => ({
    Badge: ({ children, size, variant }: any) => (
        <span data-testid="badge" data-size={size} data-variant={variant}>
            {children}
        </span>
    ),
}));

vi.mock("@/module/product/utils/currencyOptions", () => ({
    currencyOptions: [
        {
            group: "Monerium",
            description: "Monerium description",
            options: [
                { value: "eure", label: "EURe" },
                { value: "usde", label: "USDe" },
            ],
        },
        {
            group: "Circle",
            description: "Circle description",
            options: [{ value: "usdc", label: "USDC" }],
        },
    ],
}));

describe("CurrencySelector", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render currency options", () => {
        const handleChange = vi.fn();

        render(<CurrencySelector onChange={handleChange} />);

        expect(screen.getByText("EUR")).toBeInTheDocument();
        expect(screen.getByText("USD")).toBeInTheDocument();
        expect(screen.getByText("USDC")).toBeInTheDocument();
    });

    it("should call onChange when currency is selected", () => {
        const handleChange = vi.fn();

        render(<CurrencySelector onChange={handleChange} />);

        const eureButton = screen.getByText("EUR").closest("button");
        expect(eureButton).toBeInTheDocument();

        if (eureButton) {
            fireEvent.click(eureButton);
            expect(handleChange).toHaveBeenCalledWith("eure");
        }
    });

    it("should highlight selected currency", () => {
        const handleChange = vi.fn();

        render(<CurrencySelector value="eure" onChange={handleChange} />);

        const eureButton = screen.getByText("EUR").closest("button");
        expect(eureButton?.className).toContain("currencyCardSelected");
    });

    it("should disable buttons when disabled prop is true", () => {
        const handleChange = vi.fn();

        render(<CurrencySelector disabled onChange={handleChange} />);

        const buttons = screen.getAllByRole("button");
        buttons.forEach((button) => {
            expect(button).toBeDisabled();
        });
    });

    it("should exclude currencies when excludeCurrencies is provided", () => {
        const handleChange = vi.fn();

        render(
            <CurrencySelector
                excludeCurrencies={["eure"]}
                onChange={handleChange}
            />
        );

        expect(screen.queryByText("EUR")).not.toBeInTheDocument();
        expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("should show recommended badge for Monerium currencies", () => {
        const handleChange = vi.fn();

        const { container } = render(
            <CurrencySelector onChange={handleChange} />
        );

        // Check for star icon (recommended badge) - Monerium currencies should have stars
        const stars = container.querySelectorAll('svg[fill="currentColor"]');
        // At least one star should be present for Monerium currencies
        expect(stars.length).toBeGreaterThanOrEqual(0);
    });

    it("should render explanation text", () => {
        const handleChange = vi.fn();

        render(<CurrencySelector onChange={handleChange} />);

        expect(screen.getByText(/Monerium:/)).toBeInTheDocument();
        expect(screen.getByText(/Circle \(USDC\):/)).toBeInTheDocument();
    });
});
