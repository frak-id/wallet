import { useCallback } from "react";
import { type Lang, useLang } from "@/i18n";

const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

type MoneyStyle = "price" | "reward";

/**
 * `price` always shows cents (`39,00 €`), `reward` drops them when whole
 * (`10 €` / `€10`), matching how the SDK components render rewards.
 */
export function formatMoney(
    amount: number,
    lang: Lang,
    style: MoneyStyle = "price"
): string {
    const whole = Number.isInteger(amount);
    return new Intl.NumberFormat(LOCALES[lang], {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: style === "reward" && whole ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function useFormatMoney() {
    const lang = useLang();
    return useCallback(
        (amount: number, style: MoneyStyle = "price") =>
            formatMoney(amount, lang, style),
        [lang]
    );
}
