import type { PayoutConversion } from "@frak-labs/core-sdk/rewards";
import { Notice } from "@frak-labs/design-system/components/Notice";
import type { SharingReward, SharingT } from "./types";

/** The `{{payoutCurrency}}` / `{{displayCurrency}}` words shared by the notice and the FAQ sentence. */
export function conversionCurrencies(
    conversion: PayoutConversion,
    t: SharingT
) {
    return {
        payoutCurrency: t(
            `sdk.sharingPage.conversion.currency.${conversion.payoutCurrency}`
        ),
        displayCurrency: t(
            `sdk.sharingPage.conversion.currency.${conversion.displayCurrency}`
        ),
    };
}

/** The conversion of a ready reward, or `undefined` when the page shows none. */
export function readyConversion(
    reward: SharingReward
): PayoutConversion | undefined {
    return reward.status === "ready" ? reward.conversion : undefined;
}

/**
 * One quiet line under the reward card, shown only when the headline is
 * displayed in another fiat than the one the reward is paid in.
 */
export function ConversionNotice({
    reward,
    t,
}: {
    reward: SharingReward;
    t: SharingT;
}) {
    const conversion = readyConversion(reward);
    if (!conversion || reward.status !== "ready") return null;

    const { payoutAmount, formattedRate } = conversion;
    const options = {
        ...conversionCurrencies(conversion, t),
        payoutAmount,
        rate: formattedRate,
    };

    // Merchants override these keys, and an empty override must not leave an icon-only notice.
    const text = payoutAmount
        ? withRate(
              t(
                  "sdk.sharingPage.conversion.paid",
                  reward.payoutType === "tiered"
                      ? { ...options, context: "tiered" }
                      : options
              ),
              formattedRate && t("sdk.sharingPage.conversion.rate", options)
          )
        : t("sdk.sharingPage.conversion.percentage", options);
    if (!text.trim()) return null;

    return <Notice tone="neutral">{text}</Notice>;
}

function withRate(paid: string, rate: string | undefined): string {
    return rate ? `${paid} ${rate}`.trim() : paid;
}
