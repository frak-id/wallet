/** Euro amount for game copy: whole amounts drop the cents (`1 €`, `100 €`). */
export function formatGameAmount(amount: number, locale: string): string {
    const digits = Number.isInteger(amount) ? 0 : 2;
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(amount);
}
