import { eventEmitter, log } from "@backend-infrastructure";
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

type ActionsClient = {
    getActions(params: {
        updatedAtFrom?: string;
        limit?: number;
        next?: string;
    }): Promise<TakeAdsActionListResponse>;
};

const PROVIDER = "takeads" as const;
const STREAM = "conversions";
// Pages fetched per run. Kept low on purpose: every page is checkpointed (see
// ingestActions), so anything beyond the cap simply resumes on the next tick.
// If a backlog ever outpaces the hourly cadence, raise this or shorten the cron
// period rather than letting one run hold the advisory lock for long.
const PAGE_CAP = 50;
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
            // Per-page checkpointing assumes TakeAds returns actions in
            // non-decreasing updatedAt order across pages (the standard contract
            // for a timestamp-cursor report). The guard below surfaces any
            // violation loudly rather than silently dropping a retry.
            const committedBefore = newWatermark;
            const resp = await client.getActions({
                updatedAtFrom,
                limit: 500,
                next,
            });
            pages++;

            // Per-page timestamp buffers, bounded by the page limit — keeps memory
            // flat and keeps computeWatermark off any unbounded array.
            const pageSuccess: Date[] = [];
            const pageFailed: Date[] = [];
            let deadlineHit = false;
            for (const action of resp.data) {
                if (Date.now() > deadline) {
                    deadlineHit = true;
                    break;
                }
                await this.processAction(
                    action,
                    counts,
                    pageSuccess,
                    pageFailed
                );
            }

            // Checkpoint this page's safe progress before moving on.
            const pageWatermark = computeWatermark(pageSuccess, pageFailed);
            if (pageWatermark) {
                await this.affiliateSyncStateRepository.advanceWatermark(
                    PROVIDER,
                    STREAM,
                    pageWatermark
                );
                newWatermark = pageWatermark;
            }

            // If a failed action is older than a checkpoint already committed by
            // an earlier page this run, the next tick will start past it and it
            // won't be retried — only possible if TakeAds broke updatedAt
            // ordering. Surface it for on-call instead of losing it silently.
            if (
                committedBefore &&
                pageFailed.some((d) => d.getTime() < committedBefore.getTime())
            ) {
                log.warn(
                    { pages, committedBefore },
                    "TakeAdsIngestionOrchestrator: out-of-order failed action below committed watermark — may not be retried (check TakeAds ordering)"
                );
            }

            if (pageFailed.length > 0) {
                // Hold the cursor at the checkpoint; the failed action(s) are
                // re-fetched and retried on the next tick. Stop here so a later
                // page can't advance the watermark past the failure.
                log.warn(
                    { pages, failed: pageFailed.length },
                    "TakeAdsIngestionOrchestrator: action failure — checkpointed, retries next tick"
                );
                break;
            }
            if (deadlineHit) {
                log.warn(
                    { pages },
                    "TakeAdsIngestionOrchestrator: run budget exceeded mid-page, checkpointed, resumes next tick"
                );
                break;
            }
            next = resp.meta.next ?? undefined;
        } while (next !== undefined);

        return { pages, ...counts, newWatermark };
    }

    private async processAction(
        action: TakeAdsAction,
        counts: ActionCounts,
        successTimestamps: Date[],
        failedTimestamps: Date[]
    ): Promise<void> {
        // NOTE (audit M-2): TakeAds response fields are currently trusted as-is.
        // If we add boundary validation later (bounding orderAmount, allow-listing
        // currencyCode, guarding actionId/subId length), do it with TypeBox to
        // match the rest of the codebase — not zod.
        const externalId = `takeads:${action.actionId}`;
        const actionTs = new Date(action.updatedAt);
        if (Number.isNaN(actionTs.getTime())) {
            // A malformed updatedAt can't be placed on the watermark timeline,
            // so we drop it loudly rather than poison the cursor with NaN.
            log.error(
                {
                    actionId: action.actionId,
                    subId: action.subId,
                    updatedAt: action.updatedAt,
                },
                "TakeAdsIngestionOrchestrator: action has invalid updatedAt — skipping"
            );
            counts.errors++;
            return;
        }
        try {
            const attribution =
                await this.affiliateAttributionRepository.findByToken(
                    action.subId
                );
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
                return;
            }
            if (action.status === "CANCELED") {
                await this.rewardLifecycleOrchestrator.cancelForRefund({
                    merchantId: attribution.merchantId,
                    externalId,
                });
                counts.cancelled++;
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
