import type { Currency } from "@frak-labs/core-sdk";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import { currencyStore } from "@/stores/currencyStore";
import styles from "./index.module.css";

export function SelectCurrency() {
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const setCurrency = currencyStore((state) => state.setCurrency);

    return (
        <div className={styles.selectCurrency}>
            <label
                htmlFor="currency-select"
                className={styles.selectCurrency__label}
            >
                Choose your preferred currency
            </label>
            <Select
                name="currency-select"
                onValueChange={(value) => {
                    if (value === "") return;
                    setCurrency(value as Currency);
                }}
                value={preferredCurrency}
            >
                <SelectTrigger id="currency-select" length={"medium"}>
                    <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="eur">EUR</SelectItem>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="gbp">GBP</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
