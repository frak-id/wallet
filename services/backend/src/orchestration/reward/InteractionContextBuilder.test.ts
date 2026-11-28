import { describe, expect, it, vi } from "vitest";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { InteractionLogSelect } from "../../domain/rewards/db/schema";
import type { PurchasePayload } from "../../domain/rewards/types";
import { InteractionContextBuilder } from "./InteractionContextBuilder";

const buildBuilder = () => {
    const referralLinkRepository = {
        findReferrerForReferee: vi.fn().mockResolvedValue(null),
    } as unknown as ReferralLinkRepository;

    return new InteractionContextBuilder(referralLinkRepository);
};

const purchasePayload: PurchasePayload = {
    orderId: "order-1",
    externalCustomerId: "customer-1",
    amount: 100,
    currency: "EUR",
    purchaseId: "purchase-1",
    items: [
        {
            productId: "product-1",
            name: "Eco bottle",
            quantity: 2,
            unitPrice: 10,
            totalPrice: 20,
            sku: "SKU_ABC",
        },
        {
            productId: "product-2",
            name: "Mug",
            quantity: 1,
            unitPrice: 5,
            totalPrice: 5,
        },
    ],
};

describe("InteractionContextBuilder", () => {
    it("maps sku into purchase.items[].sku when present", async () => {
        const builder = buildBuilder();
        const interaction = {
            type: "purchase",
            payload: purchasePayload,
        } as InteractionLogSelect;

        const result = await builder.build(
            interaction,
            "merchant-1",
            "identity-1",
            null
        );

        expect(result.context.purchase?.items).toEqual([
            expect.objectContaining({ productId: "product-1", sku: "SKU_ABC" }),
            expect.objectContaining({ productId: "product-2", sku: undefined }),
        ]);
    });

    it.each([
        {
            name: "true",
            payload: { gameId: "game-1", newcomer: true },
            expected: true,
        },
        {
            name: "false",
            payload: { gameId: "game-1", newcomer: false },
            expected: false,
        },
        { name: "missing", payload: { gameId: "game-1" }, expected: false },
    ])(
        "exposes the joined game with newcomer $name to the rule conditions",
        async ({ payload, expected }) => {
            const interaction = {
                type: "game_join",
                payload,
            } as InteractionLogSelect;

            const result = await buildBuilder().build(
                interaction,
                "merchant-1",
                "identity-1",
                null
            );

            expect(result.trigger).toBe("game_join");
            expect(result.context.game).toEqual({
                id: "game-1",
                newcomer: expected,
            });
        }
    );
});

describe("InteractionContextBuilder subscription orders", () => {
    const build = async (subscription?: PurchasePayload["subscription"]) => {
        const interaction = {
            type: "purchase",
            payload: { ...purchasePayload, subscription },
        } as InteractionLogSelect;
        const result = await buildBuilder().build(
            interaction,
            "merchant-1",
            "identity-1",
            null
        );
        return result.context.purchase;
    };

    const resolved = (
        over: Partial<
            Extract<
                NonNullable<PurchasePayload["subscription"]>,
                { state: "resolved" }
            >
        > = {}
    ): PurchasePayload["subscription"] => ({
        state: "resolved",
        kind: "checkout",
        cyclesCovered: 3,
        merchandiseAmount: 90,
        counted: true,
        providerSubscriptionIds: ["sub-1"],
        ...over,
    });

    it("prices a plan on one billing cycle of the checkout", async () => {
        const purchase = await build(resolved());

        expect(purchase?.isSubscription).toBe(true);
        expect(purchase?.subscription).toEqual({
            kind: "checkout",
            cyclesCovered: 3,
            cycleAmount: 30,
        });
    });

    it("marks an ordinary purchase as not a subscription", async () => {
        const purchase = await build(undefined);

        expect(purchase?.isSubscription).toBe(false);
        expect(purchase?.subscription).toBeUndefined();
    });

    it("hides a checkout that earned nothing from subscription campaigns", async () => {
        const purchase = await build(
            resolved({ counted: false, merchandiseAmount: 0 })
        );

        expect(purchase?.isSubscription).toBe(true);
        expect(purchase?.subscription).toBeUndefined();
    });

    it("keeps a renewal out of subscription campaigns", async () => {
        const purchase = await build(resolved({ kind: "renewal" }));

        expect(purchase?.subscription).toBeUndefined();
    });
});
