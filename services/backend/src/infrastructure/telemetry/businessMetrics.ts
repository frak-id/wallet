import { Counter, Gauge } from "prom-client";
import { register } from "./registry";

/**
 * Business-flow metrics, incremented once per batch/run from orchestrators and
 * jobs (not per-item in hot loops), keeping overhead negligible.
 */

// --- Reward settlement (money path) ---

const settlementRewardsTotal = register(
    new Counter({
        name: "settlement_rewards_total",
        help: "Rewards processed by the settlement job, by outcome",
        // outcome: settled | failed | depleted
        labelNames: ["outcome"] as const,
    })
);

const settlementTxTotal = register(
    new Counter({
        name: "settlement_tx_total",
        help: "On-chain settlement transactions broadcast",
    })
);

const settlementErrorsTotal = register(
    new Counter({
        name: "settlement_errors_total",
        help: "Errors encountered during settlement runs",
    })
);

const settlementRequeuedTotal = register(
    new Counter({
        name: "settlement_requeued_rewards_total",
        help: "Bank-depleted rewards re-queued once bank capacity refilled",
    })
);

// --- Reward calculation (interaction -> pending reward) ---

const rewardInteractionsTotal = register(
    new Counter({
        name: "reward_interactions_processed_total",
        help: "Interactions processed into rewards, by outcome",
        // outcome: success | deferred | error
        labelNames: ["outcome"] as const,
    })
);

// --- Webhooks (forced-200 error path is otherwise invisible) ---

const webhookErrorsTotal = register(
    new Counter({
        name: "webhook_errors_total",
        help: "E-commerce webhook handler errors (returned as HTTP 200 'ko:')",
    })
);

// --- Notifications ---

const notificationsSentTotal = register(
    new Counter({
        name: "notifications_sent_total",
        help: "Push notifications sent, by channel and outcome",
        // channel: webpush | fcm ; outcome: success | invalid_token | error
        labelNames: ["channel", "outcome"] as const,
    })
);

// --- Affiliate ingestion health ---

const affiliateWatermarkLag = register(
    new Gauge({
        name: "affiliate_ingestion_watermark_lag_seconds",
        help: "Age of the affiliate ingestion watermark (now - watermark)",
    })
);

export const businessMetrics = {
    settlementRewards(outcome: "settled" | "failed" | "depleted", n: number) {
        if (n > 0) settlementRewardsTotal.inc({ outcome }, n);
    },
    settlementTx(n: number) {
        if (n > 0) settlementTxTotal.inc(n);
    },
    settlementErrors(n: number) {
        if (n > 0) settlementErrorsTotal.inc(n);
    },
    settlementRequeued(n: number) {
        if (n > 0) settlementRequeuedTotal.inc(n);
    },
    rewardInteractions(outcome: "success" | "deferred" | "error", n: number) {
        if (n > 0) rewardInteractionsTotal.inc({ outcome }, n);
    },
    webhookError() {
        webhookErrorsTotal.inc();
    },
    notificationsSent(
        channel: "webpush" | "fcm",
        outcome: "success" | "invalid_token" | "error",
        n = 1
    ) {
        if (n > 0) notificationsSentTotal.inc({ channel, outcome }, n);
    },
    affiliateWatermarkLagSeconds(seconds: number) {
        affiliateWatermarkLag.set(seconds);
    },
};
