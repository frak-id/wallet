import type { TFunction } from "i18next";

/** "Today, 14:02", "Yesterday, 09:10" or "12 March, 18:45"; empty for an invalid timestamp. */
export function formatHistoryDateTime(
    timestamp: number,
    locale: string,
    t: TFunction,
    separator = ", "
): string {
    if (!Number.isFinite(timestamp)) return "";

    const date = new Date(timestamp);
    const time = date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    });

    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
        return `${t("common.today")}${separator}${time}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `${t("common.yesterday")}${separator}${time}`;
    }

    const dayMonth = date.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
    });
    return `${dayMonth}${separator}${time}`;
}
