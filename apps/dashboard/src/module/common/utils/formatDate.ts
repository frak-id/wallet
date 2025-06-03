export function formatDate(date: Date) {
    return new Intl.DateTimeFormat().format(date);
}
