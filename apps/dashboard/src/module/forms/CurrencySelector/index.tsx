"use client";

import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import { currencyOptions } from "@/module/product/utils/currencyOptions";
import type { Stablecoin } from "@frak-labs/app-essentials";
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

    return (
        <div className={styles.currencySelection}>
            <RadioGroup
                value={value}
                onValueChange={onChange}
                disabled={disabled}
                className={styles.radioGroup}
            >
                {availableCurrencies.map((currency) => (
                    <div key={currency.value} className={styles.currencyOption}>
                        <RadioGroupItem
                            value={currency.value}
                            disabled={disabled}
                            id={`currency-${currency.value}`}
                        />
                        <label
                            htmlFor={`currency-${currency.value}`}
                            className={styles.currencyInfo}
                        >
                            <strong>
                                {currency.label} ({currency.group})
                            </strong>
                            <p>{currency.description}</p>
                        </label>
                    </div>
                ))}
            </RadioGroup>
        </div>
    );
}
