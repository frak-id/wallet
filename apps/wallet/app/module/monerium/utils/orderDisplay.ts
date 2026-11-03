import type { MoneriumOrderDto } from "@backend-domain/monerium/schemas";
import { formatCurrency } from "@frak-labs/wallet-shared";

/** Signed amount: a redeem leaves the wallet (`-`), an issue lands in it (`+`). */
export function formatOrderAmount(
    order: MoneriumOrderDto,
    locale: string
): string {
    const numericAmount = Number.parseFloat(order.amount);
    const formattedAmount = Number.isFinite(numericAmount)
        ? formatCurrency(numericAmount, "EUR", locale)
        : order.amount;
    return `${order.kind === "redeem" ? "-" : "+"}${formattedAmount}`;
}

export function orderAmountColor(
    order: MoneriumOrderDto
): "success" | "primary" | "disabled" {
    if (order.state !== "processed") return "disabled";
    return order.kind === "issue" ? "success" : "primary";
}

export function orderStateColor(order: MoneriumOrderDto): "error" | "warning" {
    return order.state === "rejected" ? "error" : "warning";
}

/** Milliseconds of the most meaningful moment: processed when known, else placed. */
export function orderTimestamp(order: MoneriumOrderDto): number {
    return Date.parse(order.processedAt ?? order.placedAt);
}
