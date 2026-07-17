import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const LABELS: Record<string, string> = {
    "settings.currency.options.eur": "EUR",
    "settings.currency.options.gbp": "GBP",
    "settings.currency.options.usd": "USD",
};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => LABELS[key] ?? key }),
}));

const setCurrency = vi.fn();
let preferredCurrency = "eur";

vi.mock("@/stores/currencyStore", () => ({
    currencyStore: (selector: (state: unknown) => unknown) =>
        selector({ preferredCurrency, setCurrency }),
}));

import { CurrencyCard } from "./index";

describe("CurrencyCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        preferredCurrency = "eur";
    });

    it("renders EUR/GBP/USD radio options", () => {
        render(<CurrencyCard />);
        expect(screen.getByText("EUR")).toBeInTheDocument();
        expect(screen.getByText("GBP")).toBeInTheDocument();
        expect(screen.getByText("USD")).toBeInTheDocument();
        expect(screen.getAllByRole("radio")).toHaveLength(3);
    });

    it("stores the picked currency", () => {
        render(<CurrencyCard />);
        fireEvent.click(screen.getByRole("radio", { name: /gbp/i }));
        expect(setCurrency).toHaveBeenCalledWith("gbp");
    });
});
