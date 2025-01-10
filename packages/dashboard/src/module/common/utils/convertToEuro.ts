import { formatPrice } from "@/module/common/utils/formatPrice";

export function convertToEuro(price?: string | number) {
    if (typeof price === "undefined") return;
    const amountInEuros = Number(price) * 0.91; // Assuming 1 USD = 0.91 EUR
    const formattedEuros = formatPrice(
        amountInEuros.toString(),
        undefined,
        "EUR"
    );
    return formattedEuros;
}
