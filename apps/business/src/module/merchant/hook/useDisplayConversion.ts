import { getStablecoin } from "@frak-labs/app-essentials";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useConversionRate } from "@/module/common/hook/useConversionRate";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import {
    conversionRate,
    formatConversionRate,
    formatFiat,
    resolveDisplayCurrency,
    resolvePayoutCurrency,
} from "@/module/common/utils/displayConversion";
import { useMerchant } from "./useMerchant";
import { useSdkConfig } from "./useSdkConfig";

/**
 * How the amounts visitors see (the SDK display currency) relate to the fiat
 * the reward token pays in. `displayCurrency` overrides the saved SDK setting
 * (an unsaved form value); `rewardToken` overrides the merchant default.
 * Nothing is converted until the display currency is known (`isReady`);
 * `isAuto` means it falls back to EUR unless the site's own code sets one.
 */
export function useDisplayConversion({
    merchantId,
    displayCurrency: displayOverride,
    rewardToken,
}: {
    merchantId: string;
    displayCurrency?: string;
    rewardToken?: Address;
}) {
    const { i18n } = useTranslation();
    const locale = i18n.language;
    const { data: sdk, isSuccess: isSdkConfigLoaded } = useSdkConfig({
        merchantId,
    });
    const { data: merchant } = useMerchant({ merchantId });

    const token = rewardToken ?? merchant?.defaultRewardToken;
    const stablecoin = getStablecoin(token);
    const configured = displayOverride ?? sdk?.sdkConfig?.currency;
    const displayCurrency = resolveDisplayCurrency(configured);
    const payoutCurrency = resolvePayoutCurrency(token);
    const isReady =
        !!token && (displayOverride !== undefined || isSdkConfigLoaded);
    const isConverted = isReady && displayCurrency !== payoutCurrency;

    const { data: rates } = useConversionRate({
        token: isConverted ? token : undefined,
    });
    const rate = isConverted
        ? conversionRate(rates, displayCurrency, payoutCurrency)
        : undefined;

    return {
        isReady,
        isAuto: !configured,
        isConverted,
        displayCurrency,
        payoutCurrency,
        tokenLabel: currencyMetadata[stablecoin ?? "eure"].label,
        formattedRate: rate
            ? formatConversionRate(
                  rate,
                  displayCurrency,
                  payoutCurrency,
                  locale
              )
            : undefined,
        formatPayout: (amount: number) =>
            formatFiat(amount, payoutCurrency, locale),
        formatDisplayed: (payoutAmount: number) =>
            rate
                ? formatFiat(
                      Math.round(payoutAmount * rate),
                      displayCurrency,
                      locale,
                      [0, 0]
                  )
                : undefined,
    };
}
