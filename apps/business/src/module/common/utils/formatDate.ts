export function formatDate(date: Date): string {
    try {
        return new Intl.DateTimeFormat().format(date);
    } catch (error) {
        console.warn(`Failed to format date: ${date}`, error);
        return "N/A";
    }
}
