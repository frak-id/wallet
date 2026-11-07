import type { Currency } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/design-system/components/Button";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useDisplayConversion } from "@/module/merchant/hook/useDisplayConversion";

type Conversion = ReturnType<typeof useDisplayConversion>;

const SAMPLE_REWARD = 10;

/** `"euros"`, `"pounds"`, `"US dollars"`: the fiat name used in merchant copy. */
export function useFiatName() {
    const { t } = useTranslation();
    return (currency: Currency) => t(`displayConversion.fiat.${currency}`);
}

function conversionTexts(
    conversion: Conversion,
    fiatName: (c: Currency) => string
) {
    return {
        displayFiat: fiatName(conversion.displayCurrency),
        payoutFiat: fiatName(conversion.payoutCurrency),
        token: conversion.tokenLabel,
        rate: conversion.formattedRate ?? "",
        context: conversion.isAuto ? "auto" : undefined,
        sample: conversion.formatPayout(SAMPLE_REWARD),
        converted: conversion.formatDisplayed(SAMPLE_REWARD) ?? "",
    };
}

/** Customize → Identity: what visitors see and what is paid when the display currency differs. */
export function DisplayCurrencyNotice({
    conversion,
    onUsePayoutCurrency,
}: {
    conversion: Conversion;
    onUsePayoutCurrency: (currency: Currency) => void;
}) {
    const { t } = useTranslation();
    const fiatName = useFiatName();
    if (!conversion.isConverted) return null;

    const texts = conversionTexts(conversion, fiatName);
    return (
        <Notice tone="info" role="status">
            <Stack space="xs">
                <Text variant="bodySmall" color="primary">
                    {t(
                        conversion.formattedRate
                            ? "displayConversion.notice.withRate"
                            : "displayConversion.notice.withoutRate",
                        texts
                    )}
                </Text>
                <div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        width="auto"
                        onClick={() =>
                            onUsePayoutCurrency(conversion.payoutCurrency)
                        }
                    >
                        {t("displayConversion.notice.switch", texts)}
                    </Button>
                </div>
            </Stack>
        </Notice>
    );
}

/** Campaign wizard: amounts are typed in the reward fiat but visitors see another one. */
export function RewardDisplayHint({
    merchantId,
    rewardToken,
}: {
    merchantId: string;
    rewardToken?: Address;
}) {
    const { t } = useTranslation();
    const fiatName = useFiatName();
    const conversion = useDisplayConversion({ merchantId, rewardToken });
    if (!conversion.isConverted) return null;

    return (
        <Text variant="caption" color="tertiary">
            {t(
                conversion.formattedRate
                    ? "displayConversion.rewardHint.withRate"
                    : "displayConversion.rewardHint.withoutRate",
                conversionTexts(conversion, fiatName)
            )}
        </Text>
    );
}
