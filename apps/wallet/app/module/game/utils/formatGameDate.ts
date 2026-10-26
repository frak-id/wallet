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
