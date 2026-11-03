import { useCallback } from "react";
import { heroProductId, orders } from "@/data/merchant";
import { type Lang, useLang, useT } from "@/i18n";
import { merchantMessages } from "../messages";

const SEPARATORS: Record<Lang, { group: string; decimal: string }> = {
    fr: { group: "\u00A0", decimal: "," },
    en: { group: ",", decimal: "." },
};

export function useMerchantT() {
    return useT(merchantMessages);
}

/** Hand-rolled: `Intl` leaves 4-digit French numbers ungrouped ("1284"), store pages print "1 284". */
function formatNumber(value: number, lang: Lang): string {
    const { group, decimal } = SEPARATORS[lang];
    const [whole = "", fraction] = String(value).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    return fraction ? `${grouped}${decimal}${fraction}` : grouped;
}

export function useFormatNumber() {
    const lang = useLang();
    return useCallback((value: number) => formatNumber(value, lang), [lang]);
}

/** Léa already had the rest of her order in her bag before picking the serum. */
export const leaBagBeforeHero = orders.lea.lines.reduce(
    (count, line) =>
        line.productId === heroProductId ? count : count + line.quantity,
    0
);
