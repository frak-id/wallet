import type { Currency } from "@frak-labs/core-sdk";
import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { EurIcon, GbpIcon, UsdIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { currencyStore } from "@/stores/currencyStore";
import { RadioOption } from "../RadioOption";
import * as radio from "../RadioOption/radio-option.css";
import { SettingsCard } from "../SettingsCard";

const OPTIONS: { value: Currency; label: string; icon: ReactNode }[] = [
    { value: "eur", label: "EUR", icon: <EurIcon width={24} height={24} /> },
    { value: "gbp", label: "GBP", icon: <GbpIcon width={24} height={24} /> },
    { value: "usd", label: "USD", icon: <UsdIcon width={24} height={24} /> },
];

export function CurrencyCard() {
    const { t } = useTranslation();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const setCurrency = currencyStore((state) => state.setCurrency);

    return (
        <SettingsCard
            title={t("settings.currency.title")}
            description={t("settings.currency.label")}
        >
            <RadioGroup
                className={radio.group}
                value={preferredCurrency}
                onValueChange={(value) =>
                    value && setCurrency(value as Currency)
                }
                aria-label={t("settings.currency.title")}
            >
                {OPTIONS.map((option) => (
                    <RadioOption
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={option.icon}
                        fill
                    />
                ))}
            </RadioGroup>
        </SettingsCard>
    );
}
