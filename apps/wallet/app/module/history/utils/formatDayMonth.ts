/** "12 March": the day and month of a timestamp in the user's locale. */
export function formatDayMonth(timestamp: number, locale: string): string {
    return new Date(timestamp).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
    });
}
