import {
    currentStablecoins,
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    EurIcon,
    GbpIcon,
    UsdcIcon,
    UsdIcon,
} from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import type { CampaignDraft } from "@/stores/campaignStore";
import * as styles from "./basics.css";

/** Selectable tokens, in Figma order. Labels are currency codes (no i18n). */
const TOKENS = [
    { stablecoin: "gbpe", label: "GBP" },
    { stablecoin: "eure", label: "EUR" },
    { stablecoin: "usde", label: "USD" },
    { stablecoin: "usdc", label: "USDC" },
] as const satisfies ReadonlyArray<{ stablecoin: Stablecoin; label: string }>;

/** Currency glyphs (24px full-colour flag/coin icons). */
const CURRENCY_ICONS: Partial<Record<Stablecoin, ReactNode>> = {
    gbpe: <GbpIcon width={24} height={24} />,
    eure: <EurIcon width={24} height={24} />,
    usde: <UsdIcon width={24} height={24} />,
    usdc: <UsdcIcon width={24} height={24} />,
};

/** Literal i18n keys for the merchant-default subtitle (typed `t()`). */
const DEFAULT_LABEL_KEYS = {
    eure: "campaigns.create.basics.currency.defaults.eure",
    gbpe: "campaigns.create.basics.currency.defaults.gbpe",
    usde: "campaigns.create.basics.currency.defaults.usde",
    usdc: "campaigns.create.basics.currency.defaults.usdc",
} as const;

function detectStablecoin(address: Address): Stablecoin | undefined {
    const lower = address.toLowerCase();
    for (const [key, value] of Object.entries(currentStablecoins)) {
        if (value.toLowerCase() === lower) return key as Stablecoin;
    }
    return undefined;
}

export function FormRewardCurrency() {
    const { t } = useTranslation();
    const { control, watch } = useFormContext<CampaignDraft>();
    const merchantId = watch("merchantId");
    const { data: merchant } = useMerchant({ merchantId });

    const defaultStablecoin = merchant?.defaultRewardToken
        ? detectStablecoin(merchant.defaultRewardToken)
        : undefined;
    const defaultLabel = defaultStablecoin
        ? t(DEFAULT_LABEL_KEYS[defaultStablecoin])
        : t("campaigns.create.basics.currency.defaults.fallback");

    return (
        <Card radius="m">
            <Stack space="xs">
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("campaigns.create.basics.currency.label")}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("campaigns.create.basics.currency.description")}
                    </Text>
                </Stack>

                <Controller
                    control={control}
                    name="rewardToken"
                    render={({ field }) => {
                        const mode = field.value ? "other" : "default";
                        const selected = field.value
                            ? detectStablecoin(field.value)
                            : undefined;

                        const chooseAnotherRow = (
                            <label
                                htmlFor="currency-other"
                                className={styles.cellRow}
                            >
                                <span className={styles.cellSelector}>
                                    <RadioGroupItem
                                        id="currency-other"
                                        value="other"
                                    />
                                </span>
                                <span className={styles.cellMain}>
                                    <Text variant="body" weight="medium">
                                        {t(
                                            "campaigns.create.basics.currency.chooseAnother"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            "campaigns.create.basics.currency.chooseAnotherDescription"
                                        )}
                                    </Text>
                                </span>
                            </label>
                        );

                        return (
                            <RadioGroup
                                className={styles.cells}
                                value={mode}
                                onValueChange={(next) =>
                                    field.onChange(
                                        next === "other"
                                            ? getTokenAddressForStablecoin(
                                                  "eure"
                                              )
                                            : undefined
                                    )
                                }
                            >
                                <label
                                    htmlFor="currency-default"
                                    className={styles.cellRow}
                                >
                                    <span className={styles.cellSelector}>
                                        <RadioGroupItem
                                            id="currency-default"
                                            value="default"
                                        />
                                    </span>
                                    <span className={styles.cellMain}>
                                        <Text variant="body" weight="medium">
                                            {t(
                                                "campaigns.create.basics.currency.useDefault"
                                            )}
                                        </Text>
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
                                            {defaultLabel}
                                        </Text>
                                    </span>
                                    <span className={styles.cellRight}>
                                        <span
                                            className={styles.recommendedDot}
                                        />
                                        <Text
                                            variant="bodySmall"
                                            className={styles.actionText}
                                        >
                                            {t(
                                                "campaigns.create.basics.currency.recommended"
                                            )}
                                        </Text>
                                    </span>
                                </label>

                                {mode === "default" ? (
                                    chooseAnotherRow
                                ) : (
                                    <div className={styles.expandWrap}>
                                        {chooseAnotherRow}
                                        <RadioGroup
                                            className={styles.tokensRow}
                                            value={selected}
                                            onValueChange={(stablecoin) =>
                                                field.onChange(
                                                    getTokenAddressForStablecoin(
                                                        stablecoin as Stablecoin
                                                    )
                                                )
                                            }
                                        >
                                            {TOKENS.map((token) => (
                                                <label
                                                    key={token.stablecoin}
                                                    htmlFor={`token-${token.stablecoin}`}
                                                    className={styles.tokenCell}
                                                >
                                                    <RadioGroupItem
                                                        id={`token-${token.stablecoin}`}
                                                        value={token.stablecoin}
                                                    />
                                                    <span
                                                        className={
                                                            styles.tokenLabel
                                                        }
                                                    >
                                                        {
                                                            CURRENCY_ICONS[
                                                                token.stablecoin
                                                            ]
                                                        }
                                                        <Text
                                                            variant="body"
                                                            weight="medium"
                                                        >
                                                            {token.label}
                                                        </Text>
                                                    </span>
                                                </label>
                                            ))}
                                        </RadioGroup>
                                    </div>
                                )}
                            </RadioGroup>
                        );
                    }}
                />
            </Stack>
        </Card>
    );
}
