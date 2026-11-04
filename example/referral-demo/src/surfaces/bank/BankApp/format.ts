import type { Lang } from "@/i18n";
import { LOCALES } from "@/i18n/format";

/** "Aujourd'hui", "Hier", then the weekday and date: how a statement groups its days. */
export function dayLabel(daysAgo: number, lang: Lang, today: Date): string {
    const locale = LOCALES[lang];
    const label =
        daysAgo < 2
            ? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
                  -daysAgo,
                  "day"
              )
            : new Intl.DateTimeFormat(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
              }).format(
                  new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate() - daysAgo
                  )
              );
    return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

/** `FR76 1695 … 0143` → `FR76 •••• 0143`. */
export function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    return `${cleaned.slice(0, 4)} •••• ${cleaned.slice(-4)}`;
}
