import { useCallback } from "react";
import { useLang, useT } from "@/i18n";
import { LOCALES } from "@/i18n/format";
import { walletMessages } from "./messages";

/** `•••• 0143`: the last four characters, as the wallet's `maskIban` shows an IBAN. */
export function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 4) return cleaned;
    return `•••• ${cleaned.slice(-4)}`;
}

/** "Aujourd'hui, 21:31", "Avant-hier, 21:31" / "2 days ago, 21:31". */
export function useDayTime() {
    const lang = useLang();
    const t = useT(walletMessages);
    return useCallback(
        (daysAgo: number, time: string) => {
            if (daysAgo === 0) return `${t("common.today")}, ${time}`;
            const day = new Intl.RelativeTimeFormat(LOCALES[lang], {
                numeric: "auto",
            }).format(-daysAgo, "day");
            return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`;
        },
        [lang, t]
    );
}
