import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantWebhook, PurchaseSelect } from "../domain/purchases";
import {
    type ResolvedSubscriptionOrder,
    SubscriptionAuthError,
    SubscriptionRateLimitError,
    SubscriptionUnavailableError,
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
    identityGroupId: "group-buyer",
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
    hasPlan?: boolean;
    dropped?: number;
    authError?: boolean;
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
        dropUnclaimedSubscriptions: vi
            .fn()
            .mockResolvedValue(options.dropped ?? 0),
    };
    const assetLogRepository = {
        hasPlan: vi.fn().mockResolvedValue(options.hasPlan ?? true),
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
        hasAuthError: vi.fn().mockReturnValue(options.authError ?? false),
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
        creator as never,
        assetLogRepository as never
    );
    return {
        orchestrator,
        assetLogRepository,
        purchaseRepository,
        connectionService,
        interactionLogRepository,
        creator,
        resolve,
    };
}

const run = (s: ReturnType<typeof setup>) =>
    s.orchestrator.resolveDue({ limit: 10 });

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    emit.mockClear();
    track.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("SubscriptionResolutionOrchestrator: results", () => {
    it("hands a checkout to its waiting interaction", async () => {
        const s = setup({ interaction: { id: "interaction-1" } });

        await expect(run(s)).resolves.toEqual({
            resolved: 1,
            retry: 0,
            unresolved: 0,
            skipped: 0,
            throttled: 0,
            dropped: 0,
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
            due: [purchase({ identityGroupId: null })],
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
            due: [purchase({ identityGroupId: null })],
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

    it("drops a renewal whose owner is no longer linked", async () => {
        const s = setup({
            answer: renewal,
            due: [purchase({ identityGroupId: null })],
            linked: [
                {
                    ...linked("purchase-1", "group-first", ["sub-1"]),
                    id: "purchase-1",
                },
            ],
        });

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

describe("SubscriptionResolutionOrchestrator: who is worth asking", () => {
    const linkedCheckout = purchase({
        id: "checkout",
        identityGroupId: "group-first",
        subscription: {
            state: "resolved",
            attempts: 1,
            nextAttemptAt: null,
            kind: "checkout",
            providerSubscriptionIds: ["sub-1"],
            cyclesCovered: 1,
            merchandiseAmount: 27,
        },
    });

    it("asks the provider about the order of a subscriber holding a plan", async () => {
        const s = setup({
            answer: answer({ kind: "renewal" }),
            due: [purchase({ identityGroupId: null })],
            linked: [linkedCheckout],
            hasPlan: true,
        });

        await expect(run(s)).resolves.toMatchObject({ resolved: 1 });

        expect(s.assetLogRepository.hasPlan).toHaveBeenCalledWith(
            MERCHANT,
            "group-first"
        );
        expect(s.resolve).toHaveBeenCalled();
    });

    it("skips an unlinked order of a subscriber without a plan, without asking the provider", async () => {
        const s = setup({
            due: [purchase({ identityGroupId: null })],
            linked: [linkedCheckout],
            hasPlan: false,
        });

        await expect(run(s)).resolves.toMatchObject({
            skipped: 1,
            resolved: 0,
        });

        expect(s.resolve).not.toHaveBeenCalled();
        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({ state: "pending", attempts: 1 })
        );
    });

    it("gives up on an unlinked order after 24 hours without asking the provider", async () => {
        const s = setup({
            due: [
                purchase({
                    identityGroupId: null,
                    createdAt: new Date(NOW.getTime() - 25 * 3_600_000),
                }),
            ],
            linked: [linkedCheckout],
            hasPlan: false,
        });

        await expect(run(s)).resolves.toMatchObject({ unresolved: 1 });

        expect(s.resolve).not.toHaveBeenCalled();
    });

    it("asks a linked order without checking for a plan", async () => {
        const s = setup({ interaction: { id: "interaction-1" } });

        await run(s);

        expect(s.assetLogRepository.hasPlan).not.toHaveBeenCalled();
        expect(s.resolve).toHaveBeenCalled();
    });

    it("drops the orders nobody can earn on before resolving the rest", async () => {
        const s = setup({ due: [], dropped: 4 });

        await expect(run(s)).resolves.toMatchObject({ dropped: 4 });

        expect(
            s.purchaseRepository.dropUnclaimedSubscriptions
        ).toHaveBeenCalledWith(new Date(NOW.getTime() - 24 * 3_600_000));
    });
});

describe("SubscriptionResolutionOrchestrator: rate limits", () => {
    it("leaves a throttled merchant's other orders for the next run", async () => {
        const s = setup({
            answer: new SubscriptionRateLimitError(2000),
            due: [
                purchase({ id: "purchase-1" }),
                purchase({ id: "purchase-2", externalId: "order-2" }),
            ],
        });

        await expect(run(s)).resolves.toMatchObject({
            throttled: 2,
            retry: 0,
        });

        expect(s.resolve).toHaveBeenCalledTimes(1);
    });

    it("pushes every due order of a throttled merchant past Retry-After without counting an attempt", async () => {
        const s = setup({
            answer: new SubscriptionRateLimitError(300_000),
            due: [
                purchase({ id: "purchase-1" }),
                purchase({ id: "purchase-2", externalId: "order-2" }),
            ],
        });
        const nextAttemptAt = new Date(NOW.getTime() + 300_000).toISOString();

        await run(s);

        for (const id of ["purchase-1", "purchase-2"]) {
            expect(
                s.purchaseRepository.updateSubscription
            ).toHaveBeenCalledWith(
                id,
                expect.objectContaining({
                    state: "pending",
                    attempts: 0,
                    nextAttemptAt,
                })
            );
        }
    });

    it("waits at least the base backoff when Retry-After is shorter", async () => {
        const s = setup({ answer: new SubscriptionRateLimitError(2000) });

        await run(s);

        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({
                nextAttemptAt: new Date(NOW.getTime() + 60_000).toISOString(),
            })
        );
    });

    it("never gives one webhook more than half of a batch", async () => {
        const window = Array.from({ length: 6 }, (_, index) =>
            purchase({ id: `a-${index}`, externalId: `a-${index}` })
        );
        const other = purchase({ id: "b-0", webhookId: 2, externalId: "b-0" });
        const s = setup({
            due: [...window, other],
            webhooks: [webhook, { ...webhook, id: 2, merchantId: "m-2" }],
        });

        await expect(
            s.orchestrator.resolveDue({ limit: 4 })
        ).resolves.toMatchObject({ resolved: 3 });

        expect(
            s.purchaseRepository.findDueSubscriptionResolutions
        ).toHaveBeenCalledWith(NOW, 16);
        const asked = s.resolve.mock.calls.map(
            (call) =>
                (call as unknown as [{ externalId: string }])[0].externalId
        );
        expect(asked).toEqual(["a-0", "a-1", "b-0"]);
    });

    it("keeps resolving the orders of other merchants", async () => {
        const other: MerchantWebhook = { ...webhook, id: 2, merchantId: "m-2" };
        const s = setup({
            due: [
                purchase({ id: "purchase-1" }),
                purchase({ id: "purchase-2", webhookId: 2 }),
            ],
            webhooks: [webhook, other],
        });
        s.resolve.mockRejectedValueOnce(new SubscriptionRateLimitError(2000));

        await expect(run(s)).resolves.toMatchObject({
            throttled: 1,
            resolved: 1,
        });
    });
});

describe("SubscriptionResolutionOrchestrator: failing providers", () => {
    const twoOrders = [
        purchase({ id: "purchase-1" }),
        purchase({ id: "purchase-2", externalId: "order-2" }),
    ];

    it("stops asking about a merchant's orders after its token is rejected", async () => {
        const s = setup({
            answer: new SubscriptionAuthError(),
            due: twoOrders,
        });

        await expect(run(s)).resolves.toMatchObject({ retry: 1, skipped: 1 });

        expect(s.resolve).toHaveBeenCalledTimes(1);
        expect(s.connectionService.recordAuthError).toHaveBeenCalledTimes(1);
        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-2",
            expect.objectContaining({ state: "pending", attempts: 1 })
        );
    });

    it("does not call a merchant whose stored token was already rejected", async () => {
        const s = setup({ authError: true, due: twoOrders });

        await expect(run(s)).resolves.toMatchObject({ retry: 1, skipped: 1 });

        expect(s.connectionService.resolveProvider).not.toHaveBeenCalled();
        expect(s.resolve).not.toHaveBeenCalled();
    });

    it("lets orders of a merchant with a rejected token age out", async () => {
        const s = setup({
            authError: true,
            due: [
                purchase({
                    createdAt: new Date(NOW.getTime() - 25 * 3_600_000),
                }),
            ],
        });

        await expect(run(s)).resolves.toMatchObject({ unresolved: 1 });
    });

    it("stops asking about a merchant's orders after the provider is unreachable", async () => {
        const s = setup({
            answer: new SubscriptionUnavailableError(),
            due: twoOrders,
        });

        await expect(run(s)).resolves.toMatchObject({ retry: 1, skipped: 1 });

        expect(s.resolve).toHaveBeenCalledTimes(1);
    });

    it("leaves the rest of the batch for the next run once the time budget is spent", async () => {
        const s = setup({ due: twoOrders });
        s.resolve.mockImplementationOnce(async () => {
            vi.setSystemTime(new Date(NOW.getTime() + 45_000));
            return answer();
        });

        await expect(run(s)).resolves.toMatchObject({ resolved: 1 });

        expect(s.resolve).toHaveBeenCalledTimes(1);
    });
});

describe("SubscriptionResolutionOrchestrator: unexpected failures", () => {
    it("backs a failing order off instead of leaving it at the head of the queue", async () => {
        const s = setup({ interaction: { id: "interaction-1" } });
        s.interactionLogRepository.setPurchaseSubscription.mockRejectedValue(
            new Error("db down")
        );

        await expect(run(s)).resolves.toMatchObject({ retry: 1 });

        expect(s.purchaseRepository.updateSubscription).toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({ state: "pending", attempts: 1 })
        );
    });

    it("gives up on a failing order once it is a day old", async () => {
        const s = setup({
            interaction: { id: "interaction-1" },
            due: [
                purchase({
                    createdAt: new Date(NOW.getTime() - 25 * 3_600_000),
                }),
            ],
        });
        s.interactionLogRepository.setPurchaseSubscription.mockRejectedValueOnce(
            new Error("db down")
        );

        await expect(run(s)).resolves.toMatchObject({ unresolved: 1 });
    });

    it("marks an order unresolved when its webhook is unknown and the first write fails", async () => {
        const s = setup({ webhooks: [] });
        s.purchaseRepository.updateSubscription.mockRejectedValueOnce(
            new Error("db down")
        );

        await expect(run(s)).resolves.toMatchObject({ unresolved: 1 });

        expect(
            s.purchaseRepository.updateSubscription
        ).toHaveBeenLastCalledWith("purchase-1", {
            state: "unresolved",
            attempts: 0,
            nextAttemptAt: null,
        });
    });

    it("keeps an order pending when the interaction write fails, so the reward is not lost", async () => {
        const s = setup({ answer: answer({ kind: "renewal" }) });
        s.interactionLogRepository.findPurchaseByExternalId.mockRejectedValue(
            new Error("db down")
        );

        await run(s);

        expect(
            s.purchaseRepository.updateSubscription
        ).not.toHaveBeenCalledWith(
            "purchase-1",
            expect.objectContaining({ state: "resolved" })
        );
    });

    it("writes the interaction before marking the order resolved", async () => {
        const s = setup({ interaction: { id: "interaction-1" } });

        await run(s);

        const interactionWrite =
            s.interactionLogRepository.setPurchaseSubscription.mock
                .invocationCallOrder[0] ?? 0;
        const orderWrite =
            s.purchaseRepository.updateSubscription.mock
                .invocationCallOrder[0] ?? 0;
        expect(interactionWrite).toBeLessThan(orderWrite);
    });

    it("keeps an order without a creation date for the full give-up window", async () => {
        const s = setup({
            answer: "retry",
            due: [purchase({ createdAt: null })],
        });

        await expect(run(s)).resolves.toMatchObject({ retry: 1 });
    });
});

describe("SubscriptionResolutionOrchestrator: lookups shared by a run", () => {
    it("looks up a customer's linked orders, plan and token once per run", async () => {
        const s = setup({
            due: [
                purchase({ id: "purchase-1", identityGroupId: null }),
                purchase({
                    id: "purchase-2",
                    externalId: "order-2",
                    identityGroupId: null,
                }),
            ],
            answer: answer({ kind: "renewal" }),
            linked: [
                purchase({
                    id: "checkout",
                    identityGroupId: "group-first",
                }),
            ],
        });

        await expect(run(s)).resolves.toMatchObject({ resolved: 2 });

        expect(
            s.purchaseRepository.findLinkedSubscriptionOrders
        ).toHaveBeenCalledOnce();
        expect(s.assetLogRepository.hasPlan).toHaveBeenCalledOnce();
        expect(s.connectionService.resolveProvider).toHaveBeenCalledOnce();
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
            skipped: 0,
            throttled: 0,
            dropped: 0,
        });
        expect(s.purchaseRepository.findWebhooksByIds).not.toHaveBeenCalled();
    });
});
