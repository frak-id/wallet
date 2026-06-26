import { describe, expect, it, vi } from "vitest";
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
import { TakeAdsIngestionOrchestrator } from "./TakeAdsIngestionOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    eventEmitter: { emit: vi.fn() },
}));

const attribution: AffiliateAttributionSelect = {
    token: "tok-abc",
    provider: "takeads",
    identityGroupId: "identity-group-1",
    merchantId: "merchant-1",
    trackingLink: null,
    couponCode: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
};

function makeAction(overrides: Partial<TakeAdsAction> = {}): TakeAdsAction {
    return {
        actionId: "act-1",
        actionNumericId: 1,
        merchantId: 42,
        status: "PENDING",
        advertiserPaid: false,
        subId: "tok-abc",
        orderAmount: 100,
        publisherRevenue: 5,
        currencyCode: "USD",
        type: "SALE",
        orderDate: "2024-06-01T10:00:00Z",
        createdAt: "2024-06-01T10:00:00Z",
        updatedAt: "2024-06-01T12:00:00Z",
        countryCode: "US",
        ...overrides,
    };
}

function singlePage(actions: TakeAdsAction[]): TakeAdsActionListResponse {
    return { meta: { limit: 500, next: null }, data: actions };
}

const buildOrchestrator = () => {
    const attributionRepo = {
        findByToken: vi.fn(),
    } as unknown as AffiliateAttributionRepository;

    const syncStateRepo = {
        getWatermark: vi.fn().mockResolvedValue(null),
        advanceWatermark: vi.fn().mockResolvedValue(undefined),
    } as unknown as AffiliateSyncStateRepository;

    const interactionLogRepo = {
        createIdempotent: vi.fn().mockResolvedValue({ id: "custom-il-1" }),
    } as unknown as InteractionLogRepository;

    const purchaseInteractionCreator = {
        create: vi.fn().mockResolvedValue("interaction-1"),
    } as unknown as PurchaseInteractionCreator;

    const rewardLifecycleOrchestrator = {
        cancelForRefund: vi.fn().mockResolvedValue({
            affectedCount: 0,
            budgetRestoredByCampaign: {},
        }),
    } as unknown as RewardLifecycleOrchestrator;

    const getActions = vi.fn();
    const actionsClientFactory = () => ({ getActions });

    const orchestrator = new TakeAdsIngestionOrchestrator(
        attributionRepo,
        syncStateRepo,
        interactionLogRepo,
        purchaseInteractionCreator,
        rewardLifecycleOrchestrator,
        actionsClientFactory
    );

    return {
        orchestrator,
        attributionRepo,
        syncStateRepo,
        interactionLogRepo,
        purchaseInteractionCreator,
        rewardLifecycleOrchestrator,
        getActions,
    };
};

describe("TakeAdsIngestionOrchestrator", () => {
    describe("ingestActions", () => {
        it("1. unknown subId → skipped; neither create nor cancel called", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                purchaseInteractionCreator,
                rewardLifecycleOrchestrator,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(null);
            getActions.mockResolvedValue(singlePage([makeAction()]));

            const summary = await orchestrator.ingestActions();

            expect(summary.skipped).toBe(1);
            expect(summary.processed).toBe(0);
            expect(purchaseInteractionCreator.create).not.toHaveBeenCalled();
            expect(
                rewardLifecycleOrchestrator.cancelForRefund
            ).not.toHaveBeenCalled();
        });

        it("2. PENDING/CONFIRMED/SETTLED → purchaseInteractionCreator.create called with mapped params", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                purchaseInteractionCreator,
                rewardLifecycleOrchestrator,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions.mockResolvedValue(
                singlePage([
                    makeAction({ status: "PENDING", actionId: "act-pending" }),
                    makeAction({
                        status: "CONFIRMED",
                        actionId: "act-confirmed",
                    }),
                    makeAction({ status: "SETTLED", actionId: "act-settled" }),
                ])
            );

            const summary = await orchestrator.ingestActions();

            expect(summary.created).toBe(3);
            expect(purchaseInteractionCreator.create).toHaveBeenCalledTimes(3);

            expect(purchaseInteractionCreator.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    externalId: "takeads:act-pending",
                    purchaseId: "takeads:act-pending",
                    externalCustomerId: "tok-abc",
                    totalPrice: "100",
                    currencyCode: "USD",
                    items: [],
                    identityGroupId: "identity-group-1",
                    merchantId: "merchant-1",
                    cancelled: false,
                })
            );
            expect(
                rewardLifecycleOrchestrator.cancelForRefund
            ).not.toHaveBeenCalled();
        });

        it("3. CANCELED → cancelForRefund called; create NOT called", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                purchaseInteractionCreator,
                rewardLifecycleOrchestrator,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions.mockResolvedValue(
                singlePage([
                    makeAction({ status: "CANCELED", actionId: "act-cancel" }),
                ])
            );

            const summary = await orchestrator.ingestActions();

            expect(summary.cancelled).toBe(1);
            expect(
                rewardLifecycleOrchestrator.cancelForRefund
            ).toHaveBeenCalledOnce();
            expect(
                rewardLifecycleOrchestrator.cancelForRefund
            ).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                externalId: "takeads:act-cancel",
            });
            expect(purchaseInteractionCreator.create).not.toHaveBeenCalled();
        });

        it("4. pagination: two pages — all actions processed; getActions called twice", async () => {
            const { orchestrator, attributionRepo, getActions } =
                buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions
                .mockResolvedValueOnce({
                    meta: { limit: 500, next: "cursor-page-2" },
                    data: [makeAction({ actionId: "act-p1" })],
                })
                .mockResolvedValueOnce({
                    meta: { limit: 500, next: null },
                    data: [makeAction({ actionId: "act-p2" })],
                });

            const summary = await orchestrator.ingestActions();

            expect(getActions).toHaveBeenCalledTimes(2);
            expect(getActions).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ next: "cursor-page-2" })
            );
            expect(summary.pages).toBe(2);
            expect(summary.processed).toBe(2);
        });

        it("5. watermark advanced to the max updatedAt across processed actions", async () => {
            const { orchestrator, attributionRepo, getActions, syncStateRepo } =
                buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions.mockResolvedValue(
                singlePage([
                    makeAction({
                        actionId: "act-a",
                        updatedAt: "2024-06-01T10:00:00Z",
                    }),
                    makeAction({
                        actionId: "act-b",
                        updatedAt: "2024-06-01T12:00:00Z",
                    }),
                    makeAction({
                        actionId: "act-c",
                        updatedAt: "2024-06-01T11:00:00Z",
                    }),
                ])
            );

            const summary = await orchestrator.ingestActions();

            expect(summary.newWatermark).toEqual(
                new Date("2024-06-01T12:00:00Z")
            );
            expect(syncStateRepo.advanceWatermark).toHaveBeenCalledWith(
                "takeads",
                "conversions",
                new Date("2024-06-01T12:00:00Z")
            );
        });

        it("6. error isolation: one action throws → newWatermark capped below that action's updatedAt", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                purchaseInteractionCreator,
                syncStateRepo,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );

            // act-a succeeds at T1, act-b fails at T2 (>T1), act-c succeeds at T3 (>T2)
            getActions.mockResolvedValue(
                singlePage([
                    makeAction({
                        actionId: "act-a",
                        updatedAt: "2024-06-01T10:00:00Z",
                    }),
                    makeAction({
                        actionId: "act-b",
                        updatedAt: "2024-06-01T11:00:00Z",
                    }),
                    makeAction({
                        actionId: "act-c",
                        updatedAt: "2024-06-01T12:00:00Z",
                    }),
                ])
            );

            // act-b is the second call — fail it
            vi.mocked(purchaseInteractionCreator.create)
                .mockResolvedValueOnce("interaction-1")
                .mockRejectedValueOnce(new Error("db error"))
                .mockResolvedValueOnce("interaction-3");

            const summary = await orchestrator.ingestActions();

            expect(summary.errors).toBe(1);
            // newWatermark must be capped at T1 (strictly before the failing T2)
            expect(summary.newWatermark).toEqual(
                new Date("2024-06-01T10:00:00Z")
            );
            expect(syncStateRepo.advanceWatermark).toHaveBeenCalledWith(
                "takeads",
                "conversions",
                new Date("2024-06-01T10:00:00Z")
            );
            // The crux of error isolation: act-c (T3 > the failed T2) must still
            // be processed this run, never silently skipped past the failure.
            expect(purchaseInteractionCreator.create).toHaveBeenCalledTimes(3);
            expect(summary.created).toBe(2);
            expect(summary.processed).toBe(2);
        });

        it("8. duplicate create (null) counts as processed but not created", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                purchaseInteractionCreator,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            // create returns null → interaction already existed (idempotent no-op)
            vi.mocked(purchaseInteractionCreator.create).mockResolvedValue(
                null
            );
            getActions.mockResolvedValue(singlePage([makeAction()]));

            const summary = await orchestrator.ingestActions();

            expect(summary.processed).toBe(1);
            expect(summary.created).toBe(0);
        });

        it("9. non-purchase types (CLICK/BONUS/LEAD) → recorded as custom interaction, not purchase", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                interactionLogRepo,
                purchaseInteractionCreator,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions.mockResolvedValue(
                singlePage([
                    makeAction({
                        actionId: "clk",
                        type: "CLICK",
                        orderAmount: 0,
                    }),
                    makeAction({ actionId: "bns", type: "BONUS" }),
                    makeAction({ actionId: "led", type: "LEAD" }),
                ])
            );

            const summary = await orchestrator.ingestActions();

            expect(purchaseInteractionCreator.create).not.toHaveBeenCalled();
            expect(interactionLogRepo.createIdempotent).toHaveBeenCalledTimes(
                3
            );
            expect(summary.custom).toBe(3);
            expect(summary.created).toBe(0);
            expect(summary.processed).toBe(3);
            // custom payload carries the action metadata for an attributed user.
            expect(interactionLogRepo.createIdempotent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "custom",
                    identityGroupId: attribution.identityGroupId,
                    merchantId: attribution.merchantId,
                    externalEventId: "takeads:clk",
                    payload: expect.objectContaining({
                        customType: "affiliate_action",
                        data: expect.objectContaining({
                            provider: "takeads",
                            actionId: "clk",
                            actionType: "CLICK",
                            status: "PENDING",
                        }),
                    }),
                })
            );
        });

        it("10. a SALE with missing/zero order info → custom, not a NaN-priced purchase", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                interactionLogRepo,
                purchaseInteractionCreator,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions.mockResolvedValue(
                singlePage([
                    makeAction({
                        actionId: "zero",
                        type: "SALE",
                        orderAmount: 0,
                    }),
                    makeAction({
                        actionId: "nocur",
                        type: "SALE",
                        orderAmount: 50,
                        currencyCode: "",
                    }),
                ])
            );

            const summary = await orchestrator.ingestActions();

            expect(purchaseInteractionCreator.create).not.toHaveBeenCalled();
            expect(interactionLogRepo.createIdempotent).toHaveBeenCalledTimes(
                2
            );
            expect(summary.custom).toBe(2);
            expect(summary.created).toBe(0);
        });

        it("11. unknown subId is NOT recorded as custom (no end user to attach)", async () => {
            const {
                orchestrator,
                attributionRepo,
                getActions,
                interactionLogRepo,
            } = buildOrchestrator();

            vi.mocked(attributionRepo.findByToken).mockResolvedValue(null);
            getActions.mockResolvedValue(
                singlePage([makeAction({ type: "CLICK" })])
            );

            const summary = await orchestrator.ingestActions();

            expect(interactionLogRepo.createIdempotent).not.toHaveBeenCalled();
            expect(summary.custom).toBe(0);
            expect(summary.skipped).toBe(1);
        });

        it("7. first run (watermark null) → getActions called with updatedAtFrom: undefined", async () => {
            const { orchestrator, attributionRepo, getActions, syncStateRepo } =
                buildOrchestrator();

            vi.mocked(syncStateRepo.getWatermark).mockResolvedValue(null);
            vi.mocked(attributionRepo.findByToken).mockResolvedValue(
                attribution
            );
            getActions.mockResolvedValue(singlePage([]));

            await orchestrator.ingestActions();

            expect(getActions).toHaveBeenCalledWith(
                expect.objectContaining({ updatedAtFrom: undefined })
            );
        });
    });
});
