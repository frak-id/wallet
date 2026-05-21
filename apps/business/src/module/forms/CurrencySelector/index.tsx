import type { Stablecoin } from "@frak-labs/app-essentials";
import { Stack } from "@frak-labs/design-system/components/Stack";
import clsx from "clsx";
import { CheckCircle2, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/module/common/component/Badge";
import { currencyOptions } from "@/module/common/utils/currencyOptions";
import * as styles from "./currency-selector.css";

interface CurrencySelectorProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    excludeCurrencies?: Stablecoin[];
}

export function CurrencySelector({
    value,
    onChange,
    disabled = false,
    excludeCurrencies = [],
}: CurrencySelectorProps) {
    const { t } = useTranslation();
    const availableCurrencies = currencyOptions
        .reduce<
            Array<{
                value: Stablecoin;
                label: string;
                group: string;
                description: string;
            }>
        >((acc, group) => {
            acc.push(
                ...group.options.map((option) => ({
                    ...option,
                    group: group.group,
                    description: group.description,
                }))
            );
            return acc;
        }, [])
        .filter((option) => !excludeCurrencies.includes(option.value));

    const isMoneriumRecommended = (group: string) => group === "Monerium";

    return (
        <Stack space="m" paddingY="m">
            <div className={styles.currencyGrid}>
                {availableCurrencies.map((currency) => {
                    const isSelected = value === currency.value;
                    const isRecommended = isMoneriumRecommended(currency.group);

                    return (
                        <button
                            key={currency.value}
                            type="button"
                            onClick={() =>
                                !disabled && onChange(currency.value)
                            }
                            disabled={disabled}
                            className={clsx(
                                styles.currencyCard,
                                isSelected && styles.currencyCardSelected,
                                disabled && styles.currencyCardDisabled
                            )}
                        >
                            {isSelected && (
                                <div className={styles.selectedIndicator}>
                                    <CheckCircle2 size={20} strokeWidth={2.5} />
                                </div>
                            )}
                            <Stack space="s" align="center">
                                <span className={styles.currencySymbol}>
                                    {currency.label
                                        .replace(/e$/i, "")
                                        .toUpperCase()}
                                </span>
                                <div className={styles.currencyBadges}>
                                    <Badge size="small" variant="information">
                                        {currency.group}
                                    </Badge>
                                    {isRecommended && (
                                        <div
                                            className={styles.recommendedBadge}
                                            title={t(
                                                "forms.currencySelector.recommendedTooltip"
                                            )}
                                        >
                                            <Star
                                                size={16}
                                                fill="currentColor"
                                                strokeWidth={0}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Stack>
                        </button>
                    );
                })}
            </div>

            <div className={styles.currencyExplanation}>
                <div className={styles.explanationSection}>
                    <strong>Monerium:</strong>{" "}
                    {t("forms.currencySelector.moneriumDescription")}
                </div>
                <div className={styles.explanationSection}>
                    <strong>Circle (USDC):</strong>{" "}
                    {t("forms.currencySelector.circleDescription")}
                </div>
            </div>
        </Stack>
    );
}
