import {
    type Currency,
    type FiatAmounts,
    formatAmount,
    getSupportedCurrency,
    type Language,
    sdkConfigStore,
} from "@frak-labs/core-sdk";

/** Backend config first, then the page's static SDK config. */
export function resolveRewardCurrency(): Currency | undefined {
    return (
        sdkConfigStore.getConfig().currency ??
        window.FrakSetup?.config?.metadata?.currency
    );
}

export function pickFiat(amounts: FiatAmounts, currency?: Currency): number {
    switch (getSupportedCurrency(currency)) {
        case "usd":
            return amounts.usdAmount;
        case "gbp":
            return amounts.gbpAmount;
        default:
            return amounts.eurAmount;
    }
}

export function formatFiat(amounts: FiatAmounts, currency?: Currency): string {
    return formatAmount(pickFiat(amounts, currency), currency);
}

/** Short day + month in the component's language, e.g. "5 Dec" / "5 déc.". */
export function formatRewardDate(date: Date, lang: Language): string {
    return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "short",
    });
}

export type ReminderPlaceholders = {
    reward?: string;
    days?: number;
    date?: string;
    brand?: string;
};

/** Fills `{REWARD}`, `{DAYS}`, `{DATE}` and `{BRAND}`; a missing value leaves an empty slot. */
export function fillReminderText(
    template: string,
    values: ReminderPlaceholders
): string {
    return (
        template
            .replaceAll("{REWARD}", () => values.reward ?? "")
            .replaceAll("{DAYS}", () =>
                values.days === undefined ? "" : String(values.days)
            )
            // A French short month already ends the sentence: "le 14 nov." not "nov..".
            .replace(/\{DATE\}(\.?)/g, (_, dot: string) => {
                const date = values.date ?? "";
                return date.endsWith(".") ? date : date + dot;
            })
            .replaceAll("{BRAND}", () => values.brand ?? "")
    );
}
