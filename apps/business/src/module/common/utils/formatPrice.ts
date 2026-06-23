import { getNumberFormat } from "./intlCache";

export function formatPrice(
    price?: string | number,
    locales = "en-US",
    currency = "USD"
) {
    if (typeof price === "undefined") return;
    return getNumberFormat(locales, {
        style: "currency",
        currency,
    }).format(Number(price));
}
