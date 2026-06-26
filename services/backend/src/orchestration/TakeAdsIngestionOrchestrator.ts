import { log } from "@backend-infrastructure";
import type { AffiliateAttributionRepository } from "../domain/affiliate/repositories/AffiliateAttributionRepository";
import type { AffiliateSyncStateRepository } from "../domain/affiliate/repositories/AffiliateSyncStateRepository";
import type {
    TakeAdsAction,
    TakeAdsActionListResponse,
} from "../infrastructure/integrations/takeads";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";
import type { RewardLifecycleOrchestrator } from "./RewardLifecycleOrchestrator";

export type IngestionSummary = {
    pages: number;
    processed: number;
    created: number;
    cancelled: number;
    skipped: number;
    errors: number;
    newWatermark: Date | null;
};

type ActionCounts = {
    processed: number;
    created: number;
    cancelled: number;
    skipped: number;
    errors: number;
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
const PAGE_CAP = 1000;
// Wall-clock budget per run. The job is hourly and holds an advisory lock for
// its whole duration, so a large backlog (first run / post-outage) is drained
// incrementally across ticks rather than blocking all replicas for hours.
const RUN_BUDGET_MS = 10 * 60_000;

function computeWatermark(
    successTimestamps: Date[],
    failedTimestamps: Date[]
): Date | null {
    if (failedTimestamps.length === 0) {
        if (successTimestamps.length === 0) return null;
        return new Date(Math.max(...successTimestamps.map((d) => d.getTime())));
    }
    const minFailed = Math.min(...failedTimestamps.map((d) => d.getTime()));
    const safe = successTimestamps.filter((d) => d.getTime() < minFailed);
    if (safe.length === 0) return null;
    return new Date(Math.max(...safe.map((d) => d.getTime())));
}

export class TakeAdsIngestionOrchestrator {
    constructor(
        private readonly affiliateAttributionRepository: AffiliateAttributionRepository,
        private readonly affiliateSyncStateRepository: AffiliateSyncStateRepository,
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
            cancelled: 0,
            skipped: 0,
            errors: 0,
        };
        const successTimestamps: Date[] = [];
        const failedTimestamps: Date[] = [];

        let next: string | undefined;
        do {
            if (pages >= PAGE_CAP) {
                log.warn(
                    { pages },
                    "TakeAdsIngestionOrchestrator: page cap reached, stopping"
                );
                break;
            }
            if (Date.now() > deadline) {
                log.warn(
                    { pages },
                    "TakeAdsIngestionOrchestrator: run budget exceeded, stopping (resumes next tick)"
                );
                break;
            }
            const resp = await client.getActions({
                updatedAtFrom,
                limit: 500,
                next,
            });
            pages++;
            for (const action of resp.data) {
                await this.processAction(
                    action,
                    counts,
                    successTimestamps,
                    failedTimestamps
                );
            }
            next = resp.meta.next ?? undefined;
        } while (next !== undefined);

        const newWatermark = computeWatermark(
            successTimestamps,
            failedTimestamps
        );
        if (newWatermark) {
            await this.affiliateSyncStateRepository.advanceWatermark(
                PROVIDER,
                STREAM,
                newWatermark
            );
        }

        return { pages, ...counts, newWatermark };
    }

    private async processAction(
        action: TakeAdsAction,
        counts: ActionCounts,
        successTimestamps: Date[],
        failedTimestamps: Date[]
    ): Promise<void> {
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
                return;
            }
            if (action.status === "CANCELED") {
                await this.rewardLifecycleOrchestrator.cancelForRefund({
                    merchantId: attribution.merchantId,
                    externalId,
                });
                counts.cancelled++;
            } else {
                const interactionLogId =
                    await this.purchaseInteractionCreator.create({
                        purchaseId: externalId,
                        externalId,
                        externalCustomerId: action.subId,
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
}
