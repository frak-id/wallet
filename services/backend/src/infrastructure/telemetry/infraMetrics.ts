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
 * Identity proof-of-possession verification outcomes.
 *
 * Only calls that actually presented a proof reach
 * `IdentityProofService.verify()`, so `valid`/`invalid` are the only
 * outcomes recorded — deliberately no `absent` label. That count is
 * already derivable from the route's request-count metric minus this
 * counter's total, so it isn't tracked here separately.
 */
const identityProofCheckedTotal = register(
    new Counter({
        name: "identity_proof_checked_total",
        help: "Identity proof-of-possession verifications by op and outcome (valid/invalid only — absence is derived from the route's request count)",
        labelNames: ["op", "outcome"] as const,
    })
);

/**
 * The credential a caller presented on an identity admission route,
 * classified as the answer that route will give once its proof requirement
 * becomes mandatory. `absent_unlatched` is the would-403 population: allowed
 * today, refused after the flip.
 */
export type IdentityCredentialClass =
    | "proven"
    | "invalid"
    | "absent_latched"
    | "absent_unlatched";

/**
 * Outcome of the Gate 2 checkout-token ladder. The `checkout_token` share of
 * `generate` is a bucket-D cutover condition, so it needs its own series.
 */
export type InstallCredentialOutcome = "resolved" | "deferred" | "unresolved";

/** Which route ran the ladder: `generate` mints, `resolve` redeems. */
export type InstallCredentialCallSite = "generate" | "resolve";

/**
 * Verdict of the claim-age bound. `undated` is expected to stay at zero: the
 * column is `DEFAULT now()` and no writer passes an explicit null, so it is
 * only reachable if some future writer starts doing so.
 */
export type InstallClaimAgeVerdict = "fresh" | "expired" | "undated";

export type IdentityEnsureArm =
    | "wallet_ticket"
    | "wallet_bare"
    | "wallet_proof"
    | "sdk";

/**
 * `n/a` is the ticket arm, whose receipt is not a credential class. `absent`
 * is the bare arm, which refuses without reading a latch — so it may not claim
 * `absent_unlatched`, a latched id reaches it too.
 */
export type IdentityEnsureArmClass = IdentityCredentialClass | "n/a" | "absent";

/**
 * No `merchant` label: `merchantId` arrives unvalidated in the body of an
 * unauthenticated route and the emission necessarily precedes `validateToken`,
 * so labelling it would let any caller mint unbounded series. The per-merchant
 * cut comes from the `absent_unlatched` log line instead.
 */
const identityMergeExecuteCredentialTotal = register(
    new Counter({
        name: "identity_merge_execute_credential_total",
        help: "Credential class presented on /user/identity/merge/execute",
        labelNames: ["class"] as const,
    })
);

const identityMergeInitiateCredentialTotal = register(
    new Counter({
        name: "identity_merge_initiate_credential_total",
        help: "Credential class presented on /user/identity/merge/initiate's anonymous-source arm",
        labelNames: ["class"] as const,
    })
);

const identityInstallCodeGenerateCredentialTotal = register(
    new Counter({
        name: "identity_install_code_generate_credential_total",
        help: "Credential class presented on /user/identity/install-code/generate",
        labelNames: ["class"] as const,
    })
);

const identityEnsureArmTotal = register(
    new Counter({
        name: "identity_ensure_arm_total",
        help: "Arm taken on /user/identity/ensure and the credential class it presented",
        labelNames: ["arm", "class"] as const,
    })
);

const identityWalletConflictTotal = register(
    new Counter({
        name: "identity_wallet_conflict_total",
        help: "Refused merges between identity groups carrying different wallets, by the flow that hit it",
        labelNames: ["source"] as const,
    })
);

const identityMergeExecuteWalletSourceUnprovenTotal = register(
    new Counter({
        name: "identity_merge_execute_wallet_source_unproven_total",
        help: "Merge executions redeeming a wallet-session-minted token with no target proof, by merchant",
        labelNames: ["merchant"] as const,
    })
);

const installCredentialClaimArmTotal = register(
    new Counter({
        name: "install_credential_claim_arm_total",
        help: "Install-credential resolutions served by the forgeable pending-claim arm, by merchant and call site",
        labelNames: ["merchant", "call_site"] as const,
    })
);

const installClaimAgeTotal = register(
    new Counter({
        name: "install_claim_age_total",
        help: "Claim-age bound verdicts on the forgeable pending-claim arm, by call site",
        labelNames: ["verdict", "call_site"] as const,
    })
);

const installCredentialOutcomeTotal = register(
    new Counter({
        name: "install_credential_outcome_total",
        help: "Outcome of the Gate 2 checkout-token ladder, by call site",
        labelNames: ["outcome", "call_site"] as const,
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
    identityMergeExecuteCredential(credentialClass: IdentityCredentialClass) {
        identityMergeExecuteCredentialTotal.inc({ class: credentialClass });
    },
    identityMergeInitiateCredential(credentialClass: IdentityCredentialClass) {
        identityMergeInitiateCredentialTotal.inc({ class: credentialClass });
    },
    identityInstallCodeGenerateCredential(
        credentialClass: IdentityCredentialClass
    ) {
        identityInstallCodeGenerateCredentialTotal.inc({
            class: credentialClass,
        });
    },
    identityEnsureArm(
        arm: IdentityEnsureArm,
        credentialClass: IdentityEnsureArmClass
    ) {
        identityEnsureArmTotal.inc({ arm, class: credentialClass });
    },
    identityWalletConflict(source: string) {
        identityWalletConflictTotal.inc({ source });
    },
    identityMergeExecuteWalletSourceUnproven(merchant: string) {
        identityMergeExecuteWalletSourceUnprovenTotal.inc({ merchant });
    },
    installCredentialClaimArm(
        merchant: string,
        callSite: InstallCredentialCallSite
    ) {
        installCredentialClaimArmTotal.inc({ merchant, call_site: callSite });
    },
    installCredentialOutcome(
        outcome: InstallCredentialOutcome,
        callSite: InstallCredentialCallSite
    ) {
        installCredentialOutcomeTotal.inc({ outcome, call_site: callSite });
    },
    installClaimAge(
        verdict: InstallClaimAgeVerdict,
        callSite: InstallCredentialCallSite
    ) {
        installClaimAgeTotal.inc({ verdict, call_site: callSite });
    },
};
