import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const CLAIMING_GROUP = "claiming-group";

const purchase = {
    webhookId: 1,
    externalId: "order-1",
    externalCustomerId: "cust-1",
    purchaseToken: "token-1",
    status: "confirmed" as const,
    totalPrice: "180.00",
    currencyCode: "EUR",
};

// Two lines of one variant: what the repository merges before it stores them.
const duplicatedVariant = [
    {
        externalId: "product-1",
        price: "60",
        name: "Shoe",
        title: "Shoe",
        quantity: 2,
        totalPrice: "120",
        sku: "A-S",
        imageUrl: null,
    },
    {
        externalId: "product-1",
        price: "60",
        name: "Shoe",
        title: "Shoe",
        quantity: 3,
        totalPrice: "180",
        sku: "A-S",
        imageUrl: null,
    },
];

const mergedVariant = [
    {
        externalId: "product-1",
        price: "60",
        name: "Shoe",
        title: "Shoe",
        quantity: 5,
        totalPrice: "300",
        sku: "A-S",
        imageUrl: null,
    },
];

function makeOrchestrator() {
    const purchaseRepository = {
        upsertWithItems: vi.fn().mockResolvedValue({
            purchaseId: "purchase-1",
            items: mergedVariant,
        }),
    };
    const purchaseClaimRepository = {
        findByPurchaseKey: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
    };
    const purchaseInteractionCreator = { create: vi.fn() };
    const identityOrchestrator = {
        resolveAndAssociate: vi
            .fn()
            .mockResolvedValue({ finalGroupId: CLAIMING_GROUP }),
    };
    const rewardLifecycleOrchestrator = { cancelForRefund: vi.fn() };

    const orchestrator = new PurchaseWebhookOrchestrator(
        purchaseRepository as never,
        purchaseClaimRepository as never,
        purchaseInteractionCreator as never,
        identityOrchestrator as never,
        rewardLifecycleOrchestrator as never
    );

    return {
        orchestrator,
        purchaseRepository,
        purchaseClaimRepository,
        purchaseInteractionCreator,
    };
}

describe("PurchaseWebhookOrchestrator", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates the interaction from the merged items, not the raw webhook lines", async () => {
        const {
            orchestrator,
            purchaseClaimRepository,
            purchaseInteractionCreator,
        } = makeOrchestrator();
        purchaseClaimRepository.findByPurchaseKey.mockResolvedValue({
            id: "claim-1",
            claimingIdentityGroupId: CLAIMING_GROUP,
        });

        await orchestrator.upsertPurchase({
            purchase,
            purchaseItems: duplicatedVariant as never,
            merchantId: MERCHANT_ID,
        });

        expect(purchaseInteractionCreator.create).toHaveBeenCalledWith(
            expect.objectContaining({ items: mergedVariant })
        );
    });

    it("creates the interaction from the merged items on the cart-attribute path", async () => {
        const { orchestrator, purchaseInteractionCreator } = makeOrchestrator();

        await orchestrator.upsertPurchase({
            purchase,
            purchaseItems: duplicatedVariant as never,
            merchantId: MERCHANT_ID,
            clientId: "anon-1",
        });

        expect(purchaseInteractionCreator.create).toHaveBeenCalledWith(
            expect.objectContaining({ items: mergedVariant })
        );
    });

    it("does not pass the raw webhook lines to the interaction creator", async () => {
        const {
            orchestrator,
            purchaseClaimRepository,
            purchaseInteractionCreator,
            purchaseRepository,
        } = makeOrchestrator();
        purchaseClaimRepository.findByPurchaseKey.mockResolvedValue({
            id: "claim-1",
            claimingIdentityGroupId: CLAIMING_GROUP,
        });

        await orchestrator.upsertPurchase({
            purchase,
            purchaseItems: duplicatedVariant as never,
            merchantId: MERCHANT_ID,
        });

        const passed =
            purchaseInteractionCreator.create.mock.calls[0]?.[0].items;
        expect(passed).not.toBe(duplicatedVariant);
        expect(passed).toBe(
            await purchaseRepository.upsertWithItems.mock.results[0]?.value.then(
                (r: { items: unknown }) => r.items
            )
        );
    });
});
