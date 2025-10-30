export function formatPrice(
    price?: string | number,
    locales = "en-US",
    currency = "USD"
) {
    if (typeof price === "undefined") return;
    const formatter = new Intl.NumberFormat(locales, {
        style: "currency",
        currency,
    });
    return formatter.format(Number(price));
}
