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
    const purchaseClaimRepository = {
        upsert: vi
            .fn()
            .mockImplementation(
                (params: { claimingIdentityGroupId: string }) => ({
                    claimingIdentityGroupId: params.claimingIdentityGroupId,
                })
            ),
    };
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

        it("claims first-wins: never rebinds an existing claim to a later caller", async () => {
            ctx.identityOrchestrator.resolveForAttribution.mockResolvedValue({
                groupId: CLAIMING_GROUP,
            });
            ctx.purchaseRepository.findByOrderAndToken.mockResolvedValue(null);
            // A claim already exists for this (merchant, order, token), so the
            // repository keeps the original attribution and returns it.
            ctx.purchaseClaimRepository.upsert.mockResolvedValue({
                claimingIdentityGroupId: EXISTING_PURCHASE_GROUP,
            });

            const result = await ctx.orchestrator.claimPurchase({
                identityNodes: nodes,
                merchantId: MERCHANT_ID,
                customerId: "cust-1",
                orderId: "order-1",
                token: "tok-1",
                merge: false,
            });

            // The claim row drives attribution once the webhook lands, so a
            // later unauthenticated caller must not be able to take it over.
            expect(ctx.purchaseClaimRepository.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ rebindExisting: false })
            );
            expect(result.identityGroupId).toBe(EXISTING_PURCHASE_GROUP);
        });

        it("neither merges nor repoints an already-attributed purchase", async () => {
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

            // The purchase keeps its stored attribution: merging is refused,
            // AND the row is not repointed at the claimer. Repointing would
            // let a forged `x-frak-client-id` steal an existing purchase —
            // the same class of hole as the merge itself.
            expect(result.identityGroupId).toBe(EXISTING_PURCHASE_GROUP);
            expect(result.merged).toBe(false);
            expect(ctx.identityOrchestrator.associate).not.toHaveBeenCalled();
            expect(
                ctx.purchaseRepository.updateIdentityGroup
            ).not.toHaveBeenCalled();
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
