import type { MoneriumOrderAmountBucket } from "@frak-labs/wallet-shared";

export function getAmountBucket(amount: string): MoneriumOrderAmountBucket {
    const value = Number.parseFloat(amount);
    if (value < 50) return "under_50";
    if (value < 500) return "50_to_500";
    if (value < 5000) return "500_to_5000";
    return "over_5000";
}
