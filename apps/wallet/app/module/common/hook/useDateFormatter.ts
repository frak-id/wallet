import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Locale-aware long-date formatter (e.g. "April 1, 2025" / "1 avril 2025"),
 * memoized on the active language. Shared by the recovery screens that render
 * on-chain validity dates.
 */
export function useDateFormatter() {
    const { i18n } = useTranslation();
    return useMemo(
        () =>
            new Intl.DateTimeFormat(
                i18n.language?.startsWith("fr") ? "fr-FR" : "en-US",
                { dateStyle: "long" }
            ),
        [i18n.language]
    );
}
