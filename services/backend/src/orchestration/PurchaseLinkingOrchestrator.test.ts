import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityNode } from "./identity";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const CLAIMING_GROUP = "claiming-group";
const EXISTING_PURCHASE_GROUP = "existing-purchase-group";

const nodes: IdentityNode[] = [
    { type: "anonymous_fingerprint", value: "anon-1", merchantId: MERCHANT_ID },
];

function makeOrchestrator() {
    const purchaseRepository = {
        findByOrderAndToken: vi.fn(),
        updateIdentityGroup: vi.fn(),
        findItemsByPurchaseId: vi.fn().mockResolvedValue([]),
    };
    const purchaseClaimRepository = { upsert: vi.fn() };
    const identityOrchestrator = {
        resolveAndAssociate: vi.fn(),
        resolveForAttribution: vi.fn(),
        associate: vi.fn(),
    };
    const purchaseInteractionCreator = {
        create: vi.fn().mockResolvedValue("il-1"),
    };

    const orchestrator = new PurchaseLinkingOrchestrator(
        purchaseRepository as never,
        purchaseClaimRepository as never,
        identityOrchestrator as never,
        purchaseInteractionCreator as never
    );

    return {
        orchestrator,
        purchaseRepository,
        purchaseClaimRepository,
        identityOrchestrator,
        purchaseInteractionCreator,
    };
}

describe("PurchaseLinkingOrchestrator.claimPurchase", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    describe("merge: false (§3.9 — /track/purchase, unauthenticated x-frak-client-id)", () => {
        it("uses resolveForAttribution, never resolveAndAssociate, when no existing purchase row", async () => {
            ctx.identityOrchestrator.resolveForAttribution.mockResolvedValue({
                groupId: CLAIMING_GROUP,
            });
            ctx.purchaseRepository.findByOrderAndToken.mockResolvedValue(null);

            const result = await ctx.orchestrator.claimPurchase({
                identityNodes: nodes,
                merchantId: MERCHANT_ID,
                customerId: "cust-1",
                orderId: "order-1",
                token: "tok-1",
                merge: false,
            });

            expect(result).toEqual({
                success: true,
                identityGroupId: CLAIMING_GROUP,
                pendingWebhook: true,
            });
            expect(
                ctx.identityOrchestrator.resolveForAttribution
            ).toHaveBeenCalledWith(nodes);
            expect(
                ctx.identityOrchestrator.resolveAndAssociate
            ).not.toHaveBeenCalled();
        });

        it("never calls associate() to reconcile with an existing purchase's identity group", async () => {
            ctx.identityOrchestrator.resolveForAttribution.mockResolvedValue({
                groupId: CLAIMING_GROUP,
            });
            ctx.purchaseRepository.findByOrderAndToken.mockResolvedValue({
                id: "purchase-1",
                identityGroupId: EXISTING_PURCHASE_GROUP,
                status: "pending",
                externalId: "ext-1",
                externalCustomerId: "cust-1",
                totalPrice: "10",
                currencyCode: "USD",
            });

            const result = await ctx.orchestrator.claimPurchase({
                identityNodes: nodes,
                merchantId: MERCHANT_ID,
                customerId: "cust-1",
                orderId: "order-1",
                token: "tok-1",
                merge: false,
            });

            // Attribution stays on the claiming group — the purchase's
            // (potentially a stranger's) group is never merged in.
            expect(result.identityGroupId).toBe(CLAIMING_GROUP);
            expect(result.merged).toBe(false);
            expect(ctx.identityOrchestrator.associate).not.toHaveBeenCalled();
        });
    });

    describe("merge: true / default (webhook path, server-to-server)", () => {
        it("defaults to merging when `merge` is omitted", async () => {
            ctx.identityOrchestrator.resolveAndAssociate.mockResolvedValue({
                finalGroupId: CLAIMING_GROUP,
                merged: false,
            });
            ctx.purchaseRepository.findByOrderAndToken.mockResolvedValue(null);

            await ctx.orchestrator.claimPurchase({
                identityNodes: nodes,
                merchantId: MERCHANT_ID,
                customerId: "cust-1",
                orderId: "order-1",
                token: "tok-1",
            });

            expect(
                ctx.identityOrchestrator.resolveAndAssociate
            ).toHaveBeenCalledWith(nodes);
            expect(
                ctx.identityOrchestrator.resolveForAttribution
            ).not.toHaveBeenCalled();
        });

        it("still calls associate() to reconcile with an existing purchase's identity group", async () => {
            ctx.identityOrchestrator.resolveAndAssociate.mockResolvedValue({
                finalGroupId: CLAIMING_GROUP,
                merged: false,
            });
            ctx.identityOrchestrator.associate.mockResolvedValue({
                finalGroupId: "merged-group",
            });
            ctx.purchaseRepository.findByOrderAndToken.mockResolvedValue({
                id: "purchase-1",
                identityGroupId: EXISTING_PURCHASE_GROUP,
                status: "pending",
                externalId: "ext-1",
                externalCustomerId: "cust-1",
                totalPrice: "10",
                currencyCode: "USD",
            });

            const result = await ctx.orchestrator.claimPurchase({
                identityNodes: nodes,
                merchantId: MERCHANT_ID,
                customerId: "cust-1",
                orderId: "order-1",
                token: "tok-1",
                merge: true,
            });

            expect(ctx.identityOrchestrator.associate).toHaveBeenCalledWith(
                CLAIMING_GROUP,
                EXISTING_PURCHASE_GROUP
            );
            expect(result.identityGroupId).toBe("merged-group");
            expect(result.merged).toBe(true);
        });
    });
});
