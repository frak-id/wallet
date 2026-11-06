import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}${JSON.stringify(opts)}` : key,
    }),
}));

const conversion = {
    isReady: true,
    isAuto: false,
    isConverted: true,
    displayCurrency: "gbp",
    payoutCurrency: "eur",
    tokenLabel: "EURe",
    formattedRate: "€1 = £0.87" as string | undefined,
    formatPayout: () => "€10",
    formatDisplayed: () => "£9" as string | undefined,
};
vi.mock("@/module/merchant/hook/useDisplayConversion", () => ({
    useDisplayConversion: () => conversion,
}));

import { DisplayCurrencyNotice, RewardDisplayHint } from "./index";

describe("RewardDisplayHint", () => {
    it("states the reward fiat and the rate visitors see", () => {
        conversion.isConverted = true;
        render(<RewardDisplayHint merchantId="m" />);

        expect(screen.getByText(/rewardHint\.withRate/).textContent).toContain(
            "€1 = £0.87"
        );
    });

    it("words the hint as a default while the display currency is Auto", () => {
        conversion.isConverted = true;
        conversion.isAuto = true;
        render(<RewardDisplayHint merchantId="m" />);
        conversion.isAuto = false;

        expect(screen.getByText(/rewardHint\.withRate/).textContent).toContain(
            '"context":"auto"'
        );
    });

    it("renders nothing when display and payout fiat match", () => {
        conversion.isConverted = false;
        const { container } = render(<RewardDisplayHint merchantId="m" />);

        expect(container.textContent).toBe("");
    });
});

describe("DisplayCurrencyNotice", () => {
    it("offers to switch to the payout fiat", () => {
        conversion.isConverted = true;
        const onUsePayoutCurrency = vi.fn();
        render(
            <DisplayCurrencyNotice
                conversion={conversion as never}
                onUsePayoutCurrency={onUsePayoutCurrency}
            />
        );

        fireEvent.click(screen.getByRole("button"));
        expect(onUsePayoutCurrency).toHaveBeenCalledWith("eur");
    });
});
