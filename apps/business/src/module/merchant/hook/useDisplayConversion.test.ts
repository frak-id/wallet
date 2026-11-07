import { currentStablecoins } from "@frak-labs/app-essentials";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ i18n: { language: "en" } }),
}));

let sdkCurrency: string | undefined;
let sdkConfigLoaded = true;
vi.mock("./useSdkConfig", () => ({
    useSdkConfig: () => ({
        data: sdkConfigLoaded
            ? { sdkConfig: { currency: sdkCurrency } }
            : undefined,
        isSuccess: sdkConfigLoaded,
    }),
}));

let defaultRewardToken: string | undefined;
vi.mock("./useMerchant", () => ({
    useMerchant: () => ({
        data: defaultRewardToken ? { defaultRewardToken } : undefined,
    }),
}));

const rateToken = vi.fn();
vi.mock("@/module/common/hook/useConversionRate", () => ({
    useConversionRate: (args: { token?: string }) => {
        rateToken(args.token);
        return { data: { eur: 1, usd: 1.08, gbp: 0.87 } };
    },
}));

import { useDisplayConversion } from "./useDisplayConversion";

describe("useDisplayConversion", () => {
    beforeEach(() => {
        sdkCurrency = undefined;
        sdkConfigLoaded = true;
        defaultRewardToken = currentStablecoins.eure;
        rateToken.mockClear();
    });

    it("is not converted when Auto resolves to the payout fiat", () => {
        const { result } = renderHook(() =>
            useDisplayConversion({ merchantId: "m" })
        );

        expect(result.current.isConverted).toBe(false);
        expect(result.current.displayCurrency).toBe("eur");
        expect(result.current.formattedRate).toBeUndefined();
        expect(rateToken).toHaveBeenLastCalledWith(undefined);
    });

    it("converts a GBP display of a EURe reward at the live rate", () => {
        sdkCurrency = "gbp";
        const { result } = renderHook(() =>
            useDisplayConversion({ merchantId: "m" })
        );

        expect(result.current.isConverted).toBe(true);
        expect(result.current.tokenLabel).toBe("EURe");
        expect(result.current.formattedRate).toBe("€1 = £0.87");
        expect(result.current.formatPayout(10)).toBe("€10");
        expect(result.current.formatDisplayed(10)).toBe("£9");
    });

    it("flags Auto so copy can say the currency is a default", () => {
        const auto = renderHook(() =>
            useDisplayConversion({ merchantId: "m" })
        );
        expect(auto.result.current.isAuto).toBe(true);

        sdkCurrency = "eur";
        const explicit = renderHook(() =>
            useDisplayConversion({ merchantId: "m" })
        );
        expect(explicit.result.current.isAuto).toBe(false);
    });

    it("stays unconverted until the sdk config has loaded", () => {
        sdkConfigLoaded = false;
        defaultRewardToken = currentStablecoins.usdc;
        const { result } = renderHook(() =>
            useDisplayConversion({ merchantId: "m" })
        );

        expect(result.current.isReady).toBe(false);
        expect(result.current.isConverted).toBe(false);
        expect(rateToken).toHaveBeenLastCalledWith(undefined);
    });

    it("is ready without the sdk config when a form value is given", () => {
        sdkConfigLoaded = false;
        const { result } = renderHook(() =>
            useDisplayConversion({ merchantId: "m", displayCurrency: "gbp" })
        );

        expect(result.current.isReady).toBe(true);
        expect(result.current.isConverted).toBe(true);
    });

    it("prefers the unsaved display currency over the saved one", () => {
        sdkCurrency = "gbp";
        const { result } = renderHook(() =>
            useDisplayConversion({ merchantId: "m", displayCurrency: "" })
        );

        expect(result.current.isConverted).toBe(false);
    });

    it("uses the campaign token over the merchant default", () => {
        sdkCurrency = "eur";
        const { result } = renderHook(() =>
            useDisplayConversion({
                merchantId: "m",
                rewardToken: currentStablecoins.usdc,
            })
        );

        expect(result.current.payoutCurrency).toBe("usd");
        expect(result.current.isConverted).toBe(true);
        expect(result.current.tokenLabel).toBe("USDC");
    });

    it("is not ready until a reward token is known", () => {
        defaultRewardToken = undefined;
        sdkCurrency = "gbp";
        const { result } = renderHook(() =>
            useDisplayConversion({ merchantId: "m" })
        );

        expect(result.current.isReady).toBe(false);
        expect(result.current.isConverted).toBe(false);
    });
});
