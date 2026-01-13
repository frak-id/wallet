/**
 * Centralized configuration for the rewards system.
 * All reward-related constants should be defined here.
 */
export const RewardConfig = {
    /**
     * Batch processing configuration for reward calculation.
     */
    batch: {
        /** Maximum interactions to process per batch */
        size: 100,
        /** Minimum age in seconds before processing an interaction */
        minAgeSeconds: 60,
    },

    /**
     * Settlement configuration for blockchain operations.
     */
    settlement: {
        /** Maximum rewards to settle per batch */
        batchSize: 100,
        /** Minutes after which a "processing" item is considered stuck */
        stuckThresholdMinutes: 30,
        /** Maximum settlement attempts before giving up */
        maxAttempts: 5,
        /** Minimum cooldown between settlement runs in milliseconds */
        cooldownMs: 60_000,
        /** Number of block confirmations to wait for */
        confirmations: 4,
    },

    /**
     * Cron patterns for background jobs.
     */
    cron: {
        /** Reward calculation job pattern (every 5 minutes) */
        rewardCalculation: "0 */5 * * * *",
        /** Settlement job pattern (every hour) */
        settlement: "0 * * * *",
        /** Expiration job pattern (daily at 3am UTC) */
        expiration: "0 3 * * *",
    },
} as const;

export type RewardConfigType = typeof RewardConfig;
