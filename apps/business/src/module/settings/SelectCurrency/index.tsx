import type { Currency } from "@frak-labs/core-sdk";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { useTranslation } from "react-i18next";
import { currencyStore } from "@/stores/currencyStore";
import { settingsField, settingsFieldLabel } from "../settings-field.css";

export function SelectCurrency() {
    const { t } = useTranslation();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const setCurrency = currencyStore((state) => state.setCurrency);

    return (
        <div className={settingsField}>
            <label htmlFor="currency-select" className={settingsFieldLabel}>
                {t("settings.currency.label")}
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
                    <SelectValue
                        placeholder={t("settings.currency.placeholder")}
                    />
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
