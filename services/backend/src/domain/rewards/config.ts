export const RewardConfig = {
    batch: {
        size: 100,
    },

    settlement: {
        batchSize: 100,
        /** Minutes after which a "processing" item is considered stuck */
        stuckThresholdMinutes: 30,
        maxAttempts: 5,
        /** Minimum cooldown between settlement runs, in milliseconds */
        cooldownMs: 60_000,
        confirmations: 4,
    },

    cron: {
        /** Every 5 minutes */
        rewardCalculation: "*/5 * * * *",
        /** Every hour */
        settlement: "0 * * * *",
        /** Every 3 hours */
        requeueDepleted: "0 */3 * * *",
        /** Daily at 3am UTC */
        expiration: "0 3 * * *",
    },
} as const;
