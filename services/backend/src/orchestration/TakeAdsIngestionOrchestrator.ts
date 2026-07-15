import { eventEmitter, log } from "@backend-infrastructure";
import type { AffiliateAttributionSelect } from "../domain/affiliate/db/schema";
import type { AffiliateAttributionRepository } from "../domain/affiliate/repositories/AffiliateAttributionRepository";
import type { AffiliateSyncStateRepository } from "../domain/affiliate/repositories/AffiliateSyncStateRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    TakeAdsAction,
    TakeAdsActionListResponse,
} from "../infrastructure/integrations/takeads";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";
import type { RewardLifecycleOrchestrator } from "./RewardLifecycleOrchestrator";

export type IngestionSummary = {
    pages: number;
    processed: number;
    /** Fresh purchase interactions (rewardable SALEs). */
    created: number;
    /** Fresh custom interactions (attributed non-purchase / un-priceable events). */
    custom: number;
    cancelled: number;
    /** Actions with no matching attribution (foreign/unknown subId). */
    skipped: number;
    errors: number;
    newWatermark: Date | null;
};

type ActionCounts = Omit<IngestionSummary, "pages" | "newWatermark">;

// Outcome of processing a single page. `fetched: false` = the API call failed
// (stop the run, no page counted). `stop` = halt after this page (action
// failure, deadline, or checkpoint-write error) while still surfacing any
// committed `watermark`.
type PageOutcome =
    | { fetched: false }
    | {
          fetched: true;
          stop: boolean;
          next: string | undefined;
          watermark: Date | null;
      };

type ActionsClient = {
    getActions(params: {
        updatedAtFrom?: string;
        limit?: number;
        next?: string;
    }): Promise<TakeAdsActionListResponse>;
};

const PROVIDER = "takeads" as const;
const STREAM = "conversions";
// Per-action retry budget before a permanently-failing ("poison") action is
// skipped rather than pinning the cursor forever. See the in-memory counter
// on the orchestrator instance for the caveats of this budget.
const MAX_ACTION_RETRIES = 5;
// Tolerance for clock skew between TakeAds and us. An action whose updatedAt
// is further in the future than this is treated as corrupt: letting it onto
// the watermark would persist a future cursor and silently starve ingestion
// (updatedAtFrom > now returns 0 actions) until real time catches up.
const MAX_FUTURE_SKEW_MS = 60_000;
// Pages fetched per run. Kept low on purpose: every page is checkpointed (see
// ingestActions), so anything beyond the cap simply resumes on the next tick.
// If a backlog ever outpaces the hourly cadence, raise this or shorten the cron
// period rather than letting one run hold the advisory lock for long.
const PAGE_CAP = 50;
// How many actions from a single page are dispatched concurrently to the DB.
// Processing a 500-action page sequentially serialises ~500 round-trips; batching
// reduces that to ceil(500/20)=25 parallel waves. Keep below the DB pool size.
const ACTION_BATCH_SIZE = 20;
// Wall-clock budget per run. The job is hourly and holds an advisory lock for
// its whole duration, so a large backlog (first run / post-outage) is drained
// incrementally across ticks rather than blocking all replicas for hours.
const RUN_BUDGET_MS = 10 * 60_000;

// A TakeAds action only earns a *purchase* reward when it is a SALE carrying a
// usable, positively-priced order. Everything else attributed to a user (leads,
// clicks, bonuses, or a malformed/zero SALE) is still recorded — as a `custom`
// interaction with the raw event metadata — so no attributed event is lost and
// nothing un-priceable is forced through purchase pricing.
function isRewardablePurchase(
    action: TakeAdsAction
): action is TakeAdsAction & { type: "SALE" } {
    return (
        action.type === "SALE" &&
        Number.isFinite(action.orderAmount) &&
        action.orderAmount > 0 &&
        !!action.currencyCode
    );
}

// Highest "safe" timestamp = newest success strictly older than the oldest
// failure, so the cursor never advances past an action that still needs a retry.
// Runs on a single page's timestamps (bounded by the page limit) and avoids
// Math.max(...array) spreads, which overflow the call stack on large inputs.
function computeWatermark(
    successTimestamps: Date[],
    failedTimestamps: Date[]
): Date | null {
    const minFailed = failedTimestamps.reduce(
        (min, d) => Math.min(min, d.getTime()),
        Number.POSITIVE_INFINITY
    );
    let maxSafe = Number.NEGATIVE_INFINITY;
    for (const d of successTimestamps) {
        const ts = d.getTime();
        if (ts < minFailed && ts > maxSafe) maxSafe = ts;
    }
    return maxSafe === Number.NEGATIVE_INFINITY ? null : new Date(maxSafe);
}

export class TakeAdsIngestionOrchestrator {
    // Process-local, in-memory count of consecutive failures per action
    // (`takeads:${actionId}`). Bounds a poison action to MAX_ACTION_RETRIES
    // attempts before it's skipped so it can't wedge the watermark forever
    // (see B4). Deliberately not persisted: it only ever holds currently-
    // failing ids (successes prune their entry), so it cannot grow unbounded,
    // and resetting it on a process restart is an acceptable degradation — a
    // restarted poison action simply gets another MAX_ACTION_RETRIES attempts
    // rather than needing a schema change to track it durably.
    private readonly actionFailureCounts = new Map<string, number>();

    constructor(
        private readonly affiliateAttributionRepository: AffiliateAttributionRepository,
        private readonly affiliateSyncStateRepository: AffiliateSyncStateRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly purchaseInteractionCreator: PurchaseInteractionCreator,
        private readonly rewardLifecycleOrchestrator: RewardLifecycleOrchestrator,
        private readonly actionsClientFactory: () => ActionsClient
    ) {}

    async ingestActions(): Promise<IngestionSummary> {
        const watermark = await this.affiliateSyncStateRepository.getWatermark(
            PROVIDER,
            STREAM
        );
        const updatedAtFrom = watermark?.toISOString();
        const client = this.actionsClientFactory();
        const deadline = Date.now() + RUN_BUDGET_MS;

        let pages = 0;
        const counts: ActionCounts = {
            processed: 0,
            created: 0,
            custom: 0,
            cancelled: 0,
            skipped: 0,
            errors: 0,
        };
        // Latest checkpoint persisted this run. The watermark is advanced after
        // every page so a failure (or a thrown getActions) on a later page never
        // discards the progress of the pages already drained.
        let newWatermark: Date | null = null;

        let next: string | undefined;
        do {
            if (pages >= PAGE_CAP) {
                log.warn(
                    { pages },
                    "TakeAdsIngestionOrchestrator: page cap reached, resumes next tick"
                );
                break;
            }
            if (Date.now() > deadline) {
                log.warn(
                    { pages },
                    "TakeAdsIngestionOrchestrator: run budget exceeded, resumes next tick"
                );
                break;
            }

            const outcome = await this.processPage(
                client,
                { updatedAtFrom, next },
                { deadline, pages, committedBefore: newWatermark, counts }
            );
            if (!outcome.fetched) break;
            pages++;
            if (outcome.watermark) newWatermark = outcome.watermark;
            if (outcome.stop) break;
            next = outcome.next;
        } while (next !== undefined);

        return { pages, ...counts, newWatermark };
    }

    /**
     * Fetch + process a single page and checkpoint its safe watermark. Returns
     * a discriminated outcome so the pagination loop in {@link ingestActions}
     * stays flat: `fetched: false` means the API call failed (stop, no page
     * counted); `stop` means the run should halt after this page (failure,
     * deadline, or a checkpoint write error) while still surfacing any
     * committed `watermark`.
     */
    private async processPage(
        client: ActionsClient,
        params: { updatedAtFrom?: string; next?: string },
        ctx: {
            deadline: number;
            pages: number;
            committedBefore: Date | null;
            counts: ActionCounts;
        }
    ): Promise<PageOutcome> {
        const { deadline, committedBefore, counts } = ctx;
        const resp = await this.fetchPage(client, params, ctx.pages, counts);
        if (resp === null) return { fetched: false };

        // This page's 1-based number, for logging/ordering guards.
        const pages = ctx.pages + 1;

        // Pre-fetch this page's attributions in one round-trip (P1) instead of
        // one lookup per action.
        const attributionsByToken =
            await this.affiliateAttributionRepository.findByTokens(
                resp.data.map((action) => action.subId)
            );

        // Per-page timestamp buffers, bounded by the page limit — keeps memory
        // flat and keeps computeWatermark off any unbounded array.
        const pageSuccess: Date[] = [];
        const pageFailed: Date[] = [];
        let deadlineHit = false;
        // Process actions in concurrent batches (ACTION_BATCH_SIZE at a time)
        // instead of sequentially, so a 500-action page doesn't serialise 500
        // DB write round-trips. Deadline is checked between batches.
        for (let i = 0; i < resp.data.length; i += ACTION_BATCH_SIZE) {
            if (Date.now() > deadline) {
                deadlineHit = true;
                break;
            }
            const batch = resp.data.slice(i, i + ACTION_BATCH_SIZE);
            await Promise.all(
                batch.map((action) =>
                    this.processAction(
                        action,
                        counts,
                        pageSuccess,
                        pageFailed,
                        attributionsByToken
                    )
                )
            );
        }

        // Checkpoint this page's safe progress before moving on.
        const pageWatermark = computeWatermark(pageSuccess, pageFailed);
        let watermark: Date | null = null;
        if (pageWatermark) {
            const committed = await this.checkpointWatermark(
                pageWatermark,
                pages,
                counts
            );
            if (!committed) {
                return {
                    fetched: true,
                    stop: true,
                    next: undefined,
                    watermark: null,
                };
            }
            watermark = pageWatermark;
        }

        this.warnOnOutOfOrderFailure(committedBefore, pageFailed, pages);

        if (pageFailed.length > 0) {
            // Hold the cursor at the checkpoint; the failed action(s) are
            // re-fetched and retried on the next tick. Stop here so a later page
            // can't advance the watermark past the failure.
            log.warn(
                { pages, failed: pageFailed.length },
                "TakeAdsIngestionOrchestrator: action failure — checkpointed, retries next tick"
            );
            return { fetched: true, stop: true, next: undefined, watermark };
        }
        if (deadlineHit) {
            log.warn(
                { pages },
                "TakeAdsIngestionOrchestrator: run budget exceeded mid-page, checkpointed, resumes next tick"
            );
            return { fetched: true, stop: true, next: undefined, watermark };
        }
        return {
            fetched: true,
            stop: false,
            next: resp.meta.next ?? undefined,
            watermark,
        };
    }

    // Per-page checkpointing assumes TakeAds returns actions in non-decreasing
    // updatedAt order across pages (the standard contract for a timestamp-cursor
    // report). If a failed action is older than a checkpoint already committed
    // by an earlier page this run, the next tick starts past it and it won't be
    // retried — only possible if TakeAds broke updatedAt ordering. Surface it
    // for on-call instead of losing it silently.
    private warnOnOutOfOrderFailure(
        committedBefore: Date | null,
        pageFailed: Date[],
        pages: number
    ): void {
        if (
            committedBefore &&
            pageFailed.some((d) => d.getTime() < committedBefore.getTime())
        ) {
            log.warn(
                { pages, committedBefore },
                "TakeAdsIngestionOrchestrator: out-of-order failed action below committed watermark — may not be retried (check TakeAds ordering)"
            );
        }
    }

    // R3: a thrown getActions must not lose the partial progress already
    // committed by earlier pages this run — log and return null (instead of
    // propagating) so the caller can break and return the partial summary.
    private async fetchPage(
        client: ActionsClient,
        params: { updatedAtFrom?: string; next?: string },
        pages: number,
        counts: ActionCounts
    ): Promise<TakeAdsActionListResponse | null> {
        try {
            return await client.getActions({ ...params, limit: 500 });
        } catch (err) {
            log.error(
                { err, pages, ...counts },
                "TakeAdsIngestionOrchestrator: getActions failed — returning partial summary"
            );
            counts.errors++;
            return null;
        }
    }

    // Same rationale as fetchPage: a thrown advanceWatermark must not lose
    // already-committed pages — log and return false so the caller can break
    // and return the partial summary.
    private async checkpointWatermark(
        watermark: Date,
        pages: number,
        counts: ActionCounts
    ): Promise<boolean> {
        try {
            await this.affiliateSyncStateRepository.advanceWatermark(
                PROVIDER,
                STREAM,
                watermark
            );
            return true;
        } catch (err) {
            log.error(
                { err, pages, ...counts },
                "TakeAdsIngestionOrchestrator: advanceWatermark failed — returning partial summary"
            );
            counts.errors++;
            return false;
        }
    }

    private async processAction(
        action: TakeAdsAction,
        counts: ActionCounts,
        successTimestamps: Date[],
        failedTimestamps: Date[],
        attributionsByToken: Map<string, AffiliateAttributionSelect>
    ): Promise<void> {
        // NOTE (audit M-2): TakeAds response fields are currently trusted as-is.
        // If we add boundary validation later (bounding orderAmount, allow-listing
        // currencyCode, guarding actionId/subId length), do it with TypeBox to
        // match the rest of the codebase — not zod.
        const externalId = `takeads:${action.actionId}`;
        const actionTs = new Date(action.updatedAt);
        if (Number.isNaN(actionTs.getTime())) {
            // A malformed updatedAt can't be placed on the watermark timeline at
            // all, so we can't retry it on a future tick either — push a
            // sentinel epoch failure. This forces the page-level break below,
            // holding the cursor at the prior checkpoint instead of letting a
            // later success on this page advance past a permanently-lost action.
            log.error(
                {
                    actionId: action.actionId,
                    subId: action.subId,
                    updatedAt: action.updatedAt,
                },
                "TakeAdsIngestionOrchestrator: action has invalid updatedAt — cursor held"
            );
            counts.errors++;
            failedTimestamps.push(new Date(0));
            return;
        }
        if (actionTs.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
            // A far-future updatedAt (TakeAds bug / clock skew) must never reach
            // the watermark: it would be persisted as the cursor and every
            // subsequent run would fetch 0 actions until real time catches up.
            // Same sentinel pattern as the NaN guard above — hold the cursor.
            log.error(
                {
                    actionId: action.actionId,
                    subId: action.subId,
                    updatedAt: action.updatedAt,
                },
                "TakeAdsIngestionOrchestrator: action has far-future updatedAt — cursor held"
            );
            counts.errors++;
            failedTimestamps.push(new Date(0));
            return;
        }
        try {
            const attribution = attributionsByToken.get(action.subId) ?? null;
            if (!attribution) {
                log.debug(
                    { subId: action.subId, actionId: action.actionId },
                    "TakeAds action subId not found in attribution — skipping (foreign/unknown subId)"
                );
                counts.skipped++;
                // A foreign/unknown subId is fully accounted for — let the cursor
                // advance past it so a single unattributable action can't pin the
                // watermark and force every later run to re-scan from here.
                successTimestamps.push(actionTs);
                this.actionFailureCounts.delete(externalId);
                return;
            }
            if (action.status === "CANCELED") {
                const { affectedCount } =
                    await this.rewardLifecycleOrchestrator.cancelForRefund({
                        merchantId: attribution.merchantId,
                        externalId,
                    });
                if (affectedCount > 0) {
                    counts.cancelled++;
                } else {
                    log.warn(
                        { actionId: action.actionId, externalId },
                        "CANCELED action had no matching purchase to cancel"
                    );
                }
            } else if (isRewardablePurchase(action)) {
                const interactionLogId =
                    await this.purchaseInteractionCreator.create({
                        purchaseId: externalId,
                        externalId,
                        externalCustomerId: action.subId,
                        // TODO (audit M-3): confirm TakeAds reports orderAmount in
                        // major units (not cents) once the first live events land
                        // — a unit mismatch would mis-price rewards by 100x.
                        totalPrice: String(action.orderAmount),
                        currencyCode: action.currencyCode,
                        items: [],
                        identityGroupId: attribution.identityGroupId,
                        merchantId: attribution.merchantId,
                        cancelled: false,
                    });
                // null = idempotent no-op (already ingested); only count fresh
                // interactions so the summary reflects real new work.
                if (interactionLogId !== null) counts.created++;
            } else {
                // Attributed non-purchase / un-priceable event: record it as a
                // custom interaction carrying the raw action metadata so the
                // event is never lost. It only earns a reward if a campaign rule
                // targets this custom event.
                await this.recordCustomInteraction(
                    action,
                    externalId,
                    attribution,
                    counts
                );
            }
            counts.processed++;
            successTimestamps.push(actionTs);
            // Prune: this action is no longer failing, so it must not keep
            // counting towards its retry budget.
            this.actionFailureCounts.delete(externalId);
        } catch (err) {
            log.error(
                {
                    err,
                    actionId: action.actionId,
                    subId: action.subId,
                    status: action.status,
                    updatedAt: action.updatedAt,
                },
                "TakeAdsIngestionOrchestrator: error processing action"
            );
            counts.errors++;

            const failures =
                (this.actionFailureCounts.get(externalId) ?? 0) + 1;
            if (failures >= MAX_ACTION_RETRIES) {
                // Retry budget exhausted (B4): this action would otherwise be
                // re-fetched and re-thrown every tick, pinning the cursor
                // forever. Log loudly and treat it as a skip — push its
                // timestamp as a success so the cursor can advance past it.
                log.error(
                    {
                        actionId: action.actionId,
                        subId: action.subId,
                        failures,
                    },
                    `TakeAdsIngestionOrchestrator: permanently skipping poison action after ${failures} failures`
                );
                this.actionFailureCounts.delete(externalId);
                counts.skipped++;
                successTimestamps.push(actionTs);
                return;
            }
            this.actionFailureCounts.set(externalId, failures);
            failedTimestamps.push(actionTs);
        }
    }

    private async recordCustomInteraction(
        action: TakeAdsAction,
        externalId: string,
        attribution: { identityGroupId: string; merchantId: string },
        counts: ActionCounts
    ): Promise<void> {
        const interactionLog =
            await this.interactionLogRepository.createIdempotent({
                type: "custom",
                identityGroupId: attribution.identityGroupId,
                merchantId: attribution.merchantId,
                externalEventId: externalId,
                payload: {
                    customType: "affiliate_action",
                    data: {
                        provider: PROVIDER,
                        actionId: action.actionId,
                        actionType: action.type,
                        status: action.status,
                        orderAmount: action.orderAmount,
                        currencyCode: action.currencyCode,
                        publisherRevenue: action.publisherRevenue,
                        countryCode: action.countryCode,
                        orderDate: action.orderDate,
                        updatedAt: action.updatedAt,
                    },
                },
            });
        // null = idempotent no-op (already ingested). On a fresh row, wake the
        // reward cron so a custom-targeting campaign can act on it.
        if (interactionLog) {
            eventEmitter.emit("newInteraction");
            counts.custom++;
        }
    }
}
