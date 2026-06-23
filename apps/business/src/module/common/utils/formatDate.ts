const dateFormatter = new Intl.DateTimeFormat();

export function formatDate(date: Date): string {
    try {
        return dateFormatter.format(date);
    } catch (error) {
        console.warn(`Failed to format date: ${date}`, error);
        return "N/A";
    }
}
