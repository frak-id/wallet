import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputAmount, InputAmountCampaign } from "./index";

vi.mock("@/stores/currencyStore", () => ({
    currencyStore: vi.fn((selector) =>
        selector({
            preferredCurrency: "USD",
        })
    ),
}));

describe("InputAmount", () => {
    it("should render input with currency from store as rightSection", () => {
        const { container } = render(<InputAmount {...({} as any)} />);

        // InputNumber renders as an input
        const input = container.querySelector("input");
        expect(input).toBeInTheDocument();
        // The rightSection with currency should be present
        expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("should pass through props to InputNumber component", () => {
        const { container } = render(
            <InputAmount {...({ placeholder: "Enter amount" } as any)} />
        );

        const input = container.querySelector("input");
        expect(input).toHaveAttribute("placeholder", "Enter amount");
    });
});

describe("InputAmountCampaign", () => {
    it("should render input with currency from store as rightSection", () => {
        const { container } = render(<InputAmountCampaign {...({} as any)} />);

        // InputNumber renders as an input
        const input = container.querySelector("input");
        expect(input).toBeInTheDocument();
        // The rightSection with currency should be present
        expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("should pass through props to InputNumber component", () => {
        const { container } = render(
            <InputAmountCampaign
                {...({ placeholder: "Campaign amount" } as any)}
            />
        );

        const input = container.querySelector("input");
        expect(input).toHaveAttribute("placeholder", "Campaign amount");
    });
});
