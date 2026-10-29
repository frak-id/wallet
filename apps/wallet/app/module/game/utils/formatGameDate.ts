/** Day and month (`7 octobre`), with the year only when it is not the current one. */
export function formatGameDate(
    date: Date | string,
    locale: string,
    now: Date = new Date()
): string {
    const value = new Date(date);
    return value.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        ...(value.getFullYear() === now.getFullYear()
            ? {}
            : { year: "numeric" }),
    });
}

/** When an open game ends, to the minute (`vendredi 31 octobre à 18:00`). */
export function formatGameEnd(date: Date | string, locale: string): string {
    return new Date(date).toLocaleString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** A deadline short enough for one line on a card (`30 oct., 12:08`). */
export function formatGameDeadline(
    date: Date | string,
    locale: string
): string {
    return new Date(date).toLocaleString(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}
