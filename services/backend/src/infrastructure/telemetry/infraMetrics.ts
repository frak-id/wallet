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

/**
 * Identity proof-of-possession verification outcomes (identity
 * proof-of-possession plan, Phase 2 acceptance: "telemetry: % of calls
 * carrying a valid proof, split derived / legacy / keygen-failed").
 *
 * Only calls that actually presented a proof reach `IdentityProofService.
 * verify()`, so `valid`/`invalid` are the only outcomes recorded here —
 * there is deliberately no `absent` label. That third state doesn't need
 * one: it is already the existing per-route request-count metric
 * (`httpMetrics`) minus this counter's `valid + invalid` total for the
 * same route, for any route that accepts an optional proof. Adding an
 * explicit `absent` increment would require touching every optional-proof
 * call site for a number that is already derivable.
 */
const identityProofCheckedTotal = register(
    new Counter({
        name: "identity_proof_checked_total",
        help: "Identity proof-of-possession verifications by op and outcome (valid/invalid only — absence is derived from the route's request count)",
        labelNames: ["op", "outcome"] as const,
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
    identityProofChecked(op: string, outcome: "valid" | "invalid") {
        identityProofCheckedTotal.inc({ op, outcome });
    },
};
