/**
 * Billing domain configuration (cron cadences, thresholds).
 */
export const BillingConfig = {
    cron: {
        /**
         * Monthly-bill generation/backfill sweep. Daily at 4am UTC (after the
         * 3am reward-expiration job): the sweep is idempotent and only creates
         * bills for fully-elapsed months, so a daily cadence simply picks up
         * each new month the day after it closes and backfills any gaps.
         */
        monthlyBillGeneration: "0 4 * * *",
    },
} as const;
