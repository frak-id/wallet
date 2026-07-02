import { Counter, Gauge, Histogram } from "prom-client";
import { register } from "./registry";

/**
 * Background-job metrics. All jobs run through `MutexCron` (src/utils), so
 * these are incremented once from that single wrapper — every current and
 * future cron gets metrics for free.
 */

const cronRunsTotal = register(
    new Counter({
        name: "cron_runs_total",
        help: "Cron executions by outcome",
        // outcome: success | error | skipped (coalesced / already running)
        labelNames: ["cron", "outcome"] as const,
    })
);

const cronRunDuration = register(
    new Histogram({
        name: "cron_run_duration_seconds",
        help: "Cron execution duration in seconds",
        labelNames: ["cron"] as const,
        buckets: [0.05, 0.5, 2, 10, 30, 60, 300],
    })
);

const cronLastSuccess = register(
    new Gauge({
        name: "cron_last_success_timestamp_seconds",
        help: "Unix timestamp of the last successful cron run",
        labelNames: ["cron"] as const,
    })
);

export const cronMetrics = {
    skipped(cron: string) {
        cronRunsTotal.inc({ cron, outcome: "skipped" });
    },
    /** Wrap a cron run; records duration, outcome and last-success timestamp. */
    async observe(cron: string, run: () => Promise<void> | void) {
        const stop = cronRunDuration.startTimer({ cron });
        try {
            await run();
            stop();
            cronRunsTotal.inc({ cron, outcome: "success" });
            cronLastSuccess.set({ cron }, Date.now() / 1000);
        } catch (error) {
            stop();
            cronRunsTotal.inc({ cron, outcome: "error" });
            throw error;
        }
    },
};
