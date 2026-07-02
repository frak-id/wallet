import { Counter, Histogram } from "prom-client";
import { register } from "./registry";

/**
 * Infrastructure-level metrics for centralized choke points (advisory locks,
 * rate limiter, event bus). Each is incremented from a single wrapper — no
 * per-call-site instrumentation, so overhead stays negligible.
 */

const advisoryLockTotal = register(
    new Counter({
        name: "advisory_lock_total",
        help: "Postgres advisory lock attempts by outcome",
        // outcome: acquired | contended (another replica holds it)
        labelNames: ["lock", "outcome"] as const,
    })
);

const advisoryLockHoldDuration = register(
    new Histogram({
        name: "advisory_lock_hold_duration_seconds",
        help: "Time an advisory lock was held while running its task",
        labelNames: ["lock"] as const,
        buckets: [0.1, 1, 5, 30, 120, 600],
    })
);

const rateLimitRejectedTotal = register(
    new Counter({
        name: "rate_limit_rejected_total",
        help: "Requests rejected by the in-memory rate limiter",
        labelNames: ["route"] as const,
    })
);

const domainEventsEmittedTotal = register(
    new Counter({
        name: "domain_events_emitted_total",
        help: "Domain events emitted on the in-process event bus",
        labelNames: ["event"] as const,
    })
);

export const infraMetrics = {
    advisoryLockAcquired(lock: string) {
        advisoryLockTotal.inc({ lock, outcome: "acquired" });
    },
    advisoryLockContended(lock: string) {
        advisoryLockTotal.inc({ lock, outcome: "contended" });
    },
    advisoryLockHoldTimer(lock: string) {
        return advisoryLockHoldDuration.startTimer({ lock });
    },
    rateLimitRejected(route: string) {
        rateLimitRejectedTotal.inc({ route });
    },
    domainEventEmitted(event: string) {
        domainEventsEmittedTotal.inc({ event });
    },
};
