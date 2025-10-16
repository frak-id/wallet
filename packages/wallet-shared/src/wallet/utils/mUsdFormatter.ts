/**
 * Format a frk amount
 * @param amount
 * @param fractionDigits
 */
export function formatUsd(amount: number, fractionDigits = 2) {
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        currencyDisplay: "code",
        maximumFractionDigits: amount % 1 !== 0 ? fractionDigits : 0,
    });
    return formatter.format(amount).replace("USD", "$");
}
