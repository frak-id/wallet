import { preferredCurrencyAtom } from "@/module/common/atoms/currency";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { Currency } from "@frak-labs/core-sdk";
import { useAtom } from "jotai";
import styles from "./index.module.css";

export function SelectCurrency() {
    const [preferredCurrency, setPreferredCurrency] = useAtom(
        preferredCurrencyAtom
    );

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
                    setPreferredCurrency(value as Currency);
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
