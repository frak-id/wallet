import type { Stablecoin } from "@frak-labs/app-essentials";
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
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import * as styles from "./merchantWizard.css";

/** Selectable currencies, in Figma order. */
const CURRENCIES = ["eure", "gbpe", "usde", "usdc"] as const;

/** 24px full-colour flag/coin icon per currency. */
const CURRENCY_ICONS: Record<Stablecoin, ReactNode> = {
    eure: <EurIcon width={24} height={24} />,
    gbpe: <GbpIcon width={24} height={24} />,
    usde: <UsdIcon width={24} height={24} />,
    usdc: <UsdcIcon width={24} height={24} />,
};

type MerchantCurrencyFieldProps = {
    value?: string;
    onChange: (value: Stablecoin) => void;
};

export function MerchantCurrencyField({
    value,
    onChange,
}: MerchantCurrencyFieldProps) {
    return (
        <RadioGroup
            className={styles.currencyGrid}
            value={value}
            onValueChange={(next) => onChange(next as Stablecoin)}
        >
            {CURRENCIES.map((stablecoin) => {
                const meta = currencyMetadata[stablecoin];
                return (
                    <label
                        key={stablecoin}
                        htmlFor={`currency-${stablecoin}`}
                        className={styles.currencyCell}
                    >
                        <RadioGroupItem
                            id={`currency-${stablecoin}`}
                            value={stablecoin}
                            size="l"
                        />
                        <div className={styles.currencyLabel}>
                            {CURRENCY_ICONS[stablecoin]}
                            <Stack space="xxs">
                                <Text variant="body" weight="medium">
                                    {meta.currencySymbol}
                                </Text>
                                <Text variant="bodySmall" color="secondary">
                                    {meta.provider}
                                </Text>
                            </Stack>
                        </div>
                    </label>
                );
            })}
        </RadioGroup>
    );
}
