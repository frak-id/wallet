"use client";

import type { Stablecoin } from "@frak-labs/app-essentials";
import { CheckCircle2, Star } from "lucide-react";
import { Badge } from "@/module/common/component/Badge";
import { currencyOptions } from "@/module/product/utils/currencyOptions";
import styles from "./index.module.css";

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
        <div className={styles.currencySelection}>
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
                            className={`${styles.currencyCard} ${
                                isSelected ? styles.currencyCardSelected : ""
                            } ${disabled ? styles.currencyCardDisabled : ""}`}
                        >
                            {isSelected && (
                                <div className={styles.selectedIndicator}>
                                    <CheckCircle2 size={20} strokeWidth={2.5} />
                                </div>
                            )}
                            <div className={styles.currencyCardHeader}>
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
                                            title="Recommended"
                                        >
                                            <Star
                                                size={16}
                                                fill="currentColor"
                                                strokeWidth={0}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className={styles.currencyExplanation}>
                <div className={styles.explanationSection}>
                    <strong>Monerium:</strong> Best for easy IBAN transfers.
                    Your users can fund their wallets directly via bank
                    transfer, making it simple for non-crypto users.
                </div>
                <div className={styles.explanationSection}>
                    <strong>Circle (USDC):</strong> Best for blockchain-native
                    users. Widely used across DeFi platforms and exchanges.
                </div>
            </div>
        </div>
    );
}
