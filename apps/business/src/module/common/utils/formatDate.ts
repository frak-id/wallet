export function formatDate(date: Date): string {
    return new Intl.DateTimeFormat().format(date);
}
