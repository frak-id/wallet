import type { PayoutConversion } from "@frak-labs/core-sdk/rewards";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversionNotice } from "./ConversionNotice";
import type { SharingReward } from "./types";

const t = (key: string, opts?: Record<string, unknown>): string => {
    if (key.startsWith("sdk.sharingPage.conversion.currency.")) {
        return `<${key.split(".").pop()}>`;
    }
    const context = opts?.context ? `_${opts.context}` : "";
    return `${key}${context}|${opts?.payoutCurrency}|${opts?.displayCurrency}|${opts?.payoutAmount}|${opts?.rate}`;
};

const conversion: PayoutConversion = {
    displayCurrency: "gbp",
    payoutCurrency: "eur",
    rate: 0.87,
    formattedRate: "€1 = £0.87",
    payoutAmount: "€10",
};

const ready = (
    overrides: Partial<Extract<SharingReward, { status: "ready" }>>
): SharingReward => ({ status: "ready", ...overrides });

describe("ConversionNotice", () => {
    it("renders nothing without a conversion", () => {
        const { container } = render(
            <ConversionNotice reward={ready({})} t={t} />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing while the reward is not ready", () => {
        const { container } = render(
            <ConversionNotice reward={{ status: "loading" }} t={t} />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it("states the payout amount and the rate for a fixed reward", () => {
        render(
            <ConversionNotice
                reward={ready({ payoutType: "fixed", conversion })}
                t={t}
            />
        );

        expect(
            screen.getByText(
                "sdk.sharingPage.conversion.paid|<eur>|<gbp>|€10|€1 = £0.87 sdk.sharingPage.conversion.rate|<eur>|<gbp>|€10|€1 = £0.87"
            )
        ).toBeInTheDocument();
    });

    it("uses the tiered wording for a tiered reward", () => {
        render(
            <ConversionNotice
                reward={ready({ payoutType: "tiered", conversion })}
                t={t}
            />
        );

        expect(
            screen.getByText(/conversion\.paid_tiered\|<eur>/)
        ).toBeInTheDocument();
    });

    it("leaves the rate sentence out when no rate is known", () => {
        render(
            <ConversionNotice
                reward={ready({
                    payoutType: "fixed",
                    conversion: {
                        ...conversion,
                        rate: undefined,
                        formattedRate: undefined,
                    },
                })}
                t={t}
            />
        );

        expect(screen.queryByText(/conversion\.rate/)).not.toBeInTheDocument();
        expect(screen.getByText(/conversion\.paid/)).toBeInTheDocument();
    });

    it("explains the day-of-purchase conversion for a percentage reward", () => {
        render(
            <ConversionNotice
                reward={ready({
                    payoutType: "percentage",
                    conversion: {
                        displayCurrency: "gbp",
                        payoutCurrency: "eur",
                    },
                })}
                t={t}
            />
        );

        expect(
            screen.getByText(/conversion\.percentage\|<eur>/)
        ).toBeInTheDocument();
    });

    it("renders nothing when a merchant empties the override", () => {
        const emptyT = (key: string, opts?: Record<string, unknown>) =>
            key.startsWith("sdk.sharingPage.conversion.currency.")
                ? t(key, opts)
                : "";
        const { container } = render(
            <ConversionNotice
                reward={ready({ payoutType: "fixed", conversion })}
                t={emptyT}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
