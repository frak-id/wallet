const base = {
    balance: ["balance"] as const,
} as const;

/**
 * Query keys for wallet-related balance queries
 */
export const walletBalanceQueryKeys = {
    balance: {
        base: base.balance,
    },
} as const;
