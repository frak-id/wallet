import type { Currency } from "@frak-labs/core-sdk";
import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { EurIcon, GbpIcon, UsdIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { currencyStore } from "@/stores/currencyStore";
import { RadioOption } from "../RadioOption";
import * as radio from "../RadioOption/radio-option.css";
import { SettingsCard } from "../SettingsCard";

export function CurrencyCard() {
    const { t } = useTranslation();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const setCurrency = currencyStore((state) => state.setCurrency);

    const options: { value: Currency; label: string; icon: ReactNode }[] = [
        {
            value: "eur",
            label: t("settings.currency.options.eur"),
            icon: <EurIcon width={24} height={24} />,
        },
        {
            value: "gbp",
            label: t("settings.currency.options.gbp"),
            icon: <GbpIcon width={24} height={24} />,
        },
        {
            value: "usd",
            label: t("settings.currency.options.usd"),
            icon: <UsdIcon width={24} height={24} />,
        },
    ];

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
                {options.map((option) => (
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
