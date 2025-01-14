import { formatPrice } from "@/module/common/utils/formatPrice";

export function convertToEuro(price?: string | number) {
    if (typeof price === "undefined") return;
    const amountInEuros = Number(price) * 0.97; // Assuming 1 USD = 0.97 EUR
    return formatPrice(amountInEuros.toString(), undefined, "EUR");
}
