import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantWebhook, PurchaseSelect } from "../domain/purchases";
import {
    type ResolvedSubscriptionOrder,
    SubscriptionAuthError,
} from "../domain/purchases/subscription/types";
import { SubscriptionResolutionOrchestrator } from "./SubscriptionResolutionOrchestrator";

const { emit, track } = vi.hoisted(() => ({ emit: vi.fn(), track: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    eventEmitter: { emit },
    productEvents: { track },
}));

const NOW = new Date("2026-11-26T12:00:00Z");
const MERCHANT = "merchant-1";

const webhook: MerchantWebhook = {
    id: 1,
    merchantId: MERCHANT,
    hookSignatureKey: "key",
    createdAt: NOW,
    platform: "shopify",
    subscriptionProvider: "recharge",
    subscriptionCredentials: "blob",
};

const purchase = (over: Partial<PurchaseSelect> = {}): PurchaseSelect => ({
    id: "purchase-1",
    webhookId: 1,
    externalId: "order-1",
    externalCustomerId: "customer-1",
    purchaseToken: null,
    totalPrice: "30.00",
    currencyCode: "EUR",
    status: "confirmed",
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: NOW,
    identityGroupId: null,
    subscription: { state: "pending", attempts: 0, nextAttemptAt: null },
    ...over,
});

const answer = (
    over: Partial<ResolvedSubscriptionOrder> = {}
): ResolvedSubscriptionOrder => ({
    kind: "checkout",
    providerSubscriptionIds: ["sub-1"],
    cyclesCovered: 1,
    merchandiseAmount: 27,
    ...over,
});

type Setup = {
    due?: PurchaseSelect[];
    webhooks?: MerchantWebhook[];
    answer?: ResolvedSubscriptionOrder | "retry" | Error;
    connected?: boolean;
    interaction?: { id: string } | null;
    linked?: PurchaseSelect[];
};

function setup(options: Setup = {}) {
    const purchaseRepository = {
        findDueSubscriptionResolutions: vi
            .fn()
            .mockResolvedValue(options.due ?? [purchase()]),
        findWebhooksByIds: vi
            .fn()
            .mockResolvedValue(options.webhooks ?? [webhook]),
        updateSubscription: vi.fn().mockResolvedValue(undefined),
        updateIdentityGroup: vi.fn().mockResolvedValue(undefined),
        findLinkedSubscriptionOrders: vi
            .fn()
            .mockResolvedValue(options.linked ?? []),
        findItemsByPurchaseId: vi.fn().mockResolvedValue([]),
    };
    const resolve = vi.fn(async () => {
        const result = options.answer ?? answer();
        if (result instanceof Error) throw result;
        return result;
    });
    const connectionService = {
        resolveProvider: vi
            .fn()
            .mockResolvedValue(
                options.connected === false
                    ? null
                    : { resolver: { resolve }, token: "token" }
            ),
        recordAuthError: vi.fn().mockResolvedValue(undefined),
    };
    const interactionLogRepository = {
        findPurchaseByExternalId: vi
            .fn()
            .mockResolvedValue(options.interaction ?? null),
        setPurchaseSubscription: vi.fn().mockResolvedValue(true),
    };
    const creator = { create: vi.fn().mockResolvedValue("interaction-new") };
    const orchestrator = new SubscriptionResolutionOrchestrator(
        purchaseRepository as never,
        connectionService as never,
        interactionLogRepository as never,
        creator as never
    );
    return {
        orchestrator,
        purchaseRepository,
        connectionService,
        interactionLogRepository,
        creator,
        resolve,
    };
}

const run = (s: ReturnType<typeof setup>) =>
    s.orchestrator.resolveDue({ limit: 10, now: NOW });

beforeEach(() => {
    emit.mockClear();
    track.mockClear();
});

describe("SubscriptionResolutionOrchestrator: results", () => {
    it("hands a checkout to its waiting interaction", async () => {
        const s = setup({ interaction: { id: "interaction-1" } });

        await expect(run(s)).resolves.toEqual({
            resolved: 1,
            retry: 0,
            unresolved: 0,
        });

        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({
                state: "resolved",
                kind: "checkout",
                merchandiseAmount: 27,
            })
        );
        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).toHaveBeenCalledWith(
            "interaction-1",
            expect.objectContaining({
                state: "resolved",
                kind: "checkout",
                counted: true,
            }),
            { close: false }
        );
        expect(emit).toHaveBeenCalledWith("newInteraction");
        expect(track).toHaveBeenCalledWith(
            "subscription_order_resolved",
            null,
            { kind: "checkout", provider: "recharge" }
        );
    });

    it("only records a checkout whose claim has not arrived", async () => {
        const s = setup({ interaction: null });

        await run(s);

        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).not.toHaveBeenCalled();
        expect(s.creator.create).not.toHaveBeenCalled();
    });

    it("turns the interaction a cart attribute created into a renewal", async () => {
        const s = setup({
            answer: answer({ kind: "renewal" }),
            interaction: { id: "interaction-1" },
        });

        await run(s);

        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).toHaveBeenCalledWith(
            "interaction-1",
            expect.objectContaining({ kind: "renewal" }),
            { close: false }
        );
        expect(s.creator.create).not.toHaveBeenCalled();
    });

    it("does not count a renewal the merchant earned nothing on", async () => {
        const s = setup({
            answer: answer({ kind: "renewal", merchandiseAmount: 0 }),
            interaction: { id: "interaction-1" },
        });

        await run(s);

        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).toHaveBeenCalledWith(
            "interaction-1",
            expect.objectContaining({ counted: false }),
            expect.anything()
        );
    });

    it("closes the interaction of a prepaid shipment without a reward", async () => {
        const s = setup({
            answer: answer({
                kind: "prepaid_shipment",
                cyclesCovered: 0,
                merchandiseAmount: 0,
            }),
            interaction: { id: "interaction-1" },
        });

        await run(s);

        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).toHaveBeenCalledWith(
            "interaction-1",
            expect.objectContaining({ counted: false, cyclesCovered: 0 }),
            { close: true }
        );
        expect(emit).not.toHaveBeenCalled();
    });

    it("lets a plain order proceed as a plain purchase", async () => {
        const s = setup({
            answer: answer({ kind: "none", providerSubscriptionIds: [] }),
            interaction: { id: "interaction-1" },
        });

        await run(s);

        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).toHaveBeenCalledWith("interaction-1", null);
        expect(emit).toHaveBeenCalledWith("newInteraction");
    });
});

describe("SubscriptionResolutionOrchestrator: renewal subscriber", () => {
    const renewal = answer({ kind: "renewal" });
    const linked = (
        id: string,
        identityGroupId: string,
        providerSubscriptionIds: string[]
    ) =>
        purchase({
            id,
            identityGroupId,
            subscription: {
                state: "resolved",
                attempts: 1,
                nextAttemptAt: null,
                kind: "checkout",
                providerSubscriptionIds,
                cyclesCovered: 1,
                merchandiseAmount: 27,
            },
        });

    it("takes the identity of the order of the same provider subscription", async () => {
        const s = setup({
            answer: renewal,
            linked: [
                linked("latest", "group-latest", ["sub-other"]),
                linked("first", "group-first", ["sub-1"]),
            ],
        });

        await run(s);

        expect(s.creator.create).toHaveBeenCalledWith(
            expect.objectContaining({
                identityGroupId: "group-first",
                merchantId: MERCHANT,
                cancelled: false,
                subscription: expect.objectContaining({ kind: "renewal" }),
            })
        );
        expect(s.purchaseRepository.updateIdentityGroup).toHaveBeenCalledWith(
            "purchase-1",
            "group-first",
            null
        );
    });

    it("falls back to the customer's latest linked subscription order", async () => {
        const s = setup({
            answer: renewal,
            linked: [
                linked("latest", "group-latest", ["sub-other"]),
                linked("older", "group-older", ["sub-another"]),
            ],
        });

        await run(s);

        expect(s.creator.create).toHaveBeenCalledWith(
            expect.objectContaining({ identityGroupId: "group-latest" })
        );
    });

    it("keeps the identity a purchase already carries", async () => {
        const s = setup({
            answer: renewal,
            due: [purchase({ identityGroupId: "group-own" })],
        });

        await run(s);

        expect(s.creator.create).toHaveBeenCalledWith(
            expect.objectContaining({ identityGroupId: "group-own" })
        );
        expect(
            s.purchaseRepository.findLinkedSubscriptionOrders
        ).not.toHaveBeenCalled();
    });

    it("drops a renewal nobody is known to own", async () => {
        const s = setup({ answer: renewal, linked: [] });

        await run(s);

        expect(s.creator.create).not.toHaveBeenCalled();
    });

    it("creates the interaction of a refunded renewal already cancelled", async () => {
        const s = setup({
            answer: renewal,
            due: [
                purchase({ identityGroupId: "group-own", status: "refunded" }),
            ],
        });

        await run(s);

        expect(s.creator.create).toHaveBeenCalledWith(
            expect.objectContaining({ cancelled: true })
        );
    });
});

describe("SubscriptionResolutionOrchestrator: retries", () => {
    it("retries after one minute, then backs off", async () => {
        const first = setup({ answer: "retry" });
        await run(first);
        expect(
            first.purchaseRepository.updateSubscription
        ).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({
                state: "pending",
                attempts: 1,
                nextAttemptAt: new Date(NOW.getTime() + 60_000).toISOString(),
            })
        );

        const third = setup({
            answer: "retry",
            due: [
                purchase({
                    subscription: {
                        state: "pending",
                        attempts: 2,
                        nextAttemptAt: null,
                    },
                }),
            ],
        });
        await run(third);
        expect(
            third.purchaseRepository.updateSubscription
        ).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({
                attempts: 3,
                nextAttemptAt: new Date(NOW.getTime() + 240_000).toISOString(),
            })
        );
    });

    it("never waits more than two hours", async () => {
        const s = setup({
            answer: "retry",
            due: [
                purchase({
                    subscription: {
                        state: "pending",
                        attempts: 20,
                        nextAttemptAt: null,
                    },
                }),
            ],
        });

        await run(s);

        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({
                nextAttemptAt: new Date(
                    NOW.getTime() + 2 * 3_600_000
                ).toISOString(),
            })
        );
    });

    it("gives up after 24 hours and lets the order proceed as a purchase", async () => {
        const s = setup({
            answer: "retry",
            due: [
                purchase({
                    createdAt: new Date(NOW.getTime() - 25 * 3_600_000),
                    subscription: {
                        state: "pending",
                        attempts: 9,
                        nextAttemptAt: null,
                    },
                }),
            ],
            interaction: { id: "interaction-1" },
        });

        await expect(run(s)).resolves.toMatchObject({ unresolved: 1 });

        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-1",
            { state: "unresolved", attempts: 10, nextAttemptAt: null }
        );
        expect(
            s.interactionLogRepository.setPurchaseSubscription
        ).toHaveBeenCalledWith("interaction-1", null);
    });

    it("keeps the rejected token on the merchant and retries", async () => {
        const s = setup({ answer: new SubscriptionAuthError() });

        await expect(run(s)).resolves.toMatchObject({ retry: 1 });

        expect(s.connectionService.recordAuthError).toHaveBeenCalledWith(
            webhook
        );
    });

    it("retries when the resolver fails for another reason", async () => {
        const s = setup({ answer: new Error("boom") });

        await expect(run(s)).resolves.toMatchObject({ retry: 1 });
        expect(s.connectionService.recordAuthError).not.toHaveBeenCalled();
    });

    it("gives up at once on a merchant that disconnected", async () => {
        const s = setup({ connected: false, interaction: { id: "i-1" } });

        await expect(run(s)).resolves.toMatchObject({ unresolved: 1 });

        expect(s.resolve).not.toHaveBeenCalled();
    });

    it("does nothing when no order is due", async () => {
        const s = setup({ due: [] });

        await expect(run(s)).resolves.toEqual({
            resolved: 0,
            retry: 0,
            unresolved: 0,
        });
        expect(s.purchaseRepository.findWebhooksByIds).not.toHaveBeenCalled();
    });
});
