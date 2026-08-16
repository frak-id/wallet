import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstallCredentialOrchestrator } from "./InstallCredentialOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
    infraMetrics: {
        installCredentialClaimArm: vi.fn(),
        installCredentialOutcome: vi.fn(),
    },
}));

const MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000";
const CHECKOUT_TOKEN = "shopify-checkout-token";

function makeOrchestrator() {
    const identityRepository = {
        findAnonymousFingerprint: vi.fn(),
        addNode: vi.fn(),
        latchServerMintedProof: vi.fn(),
    };
    const purchaseRepository = {
        getWebhookByMerchantId: vi.fn(),
        findByMerchantAndCheckoutToken: vi.fn(),
    };
    const purchaseClaimRepository = {
        findByMerchantAndToken: vi.fn(),
    };

    const orchestrator = new InstallCredentialOrchestrator(
        identityRepository as never,
        purchaseRepository as never,
        purchaseClaimRepository as never
    );

    return {
        orchestrator,
        identityRepository,
        purchaseRepository,
        purchaseClaimRepository,
    };
}

describe("InstallCredentialOrchestrator.resolveForGenerate", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.purchaseRepository.getWebhookByMerchantId.mockResolvedValue({
            id: 7,
        });
    });

    it("reports unresolved when the merchant has no webhook (S10)", async () => {
        ctx.purchaseRepository.getWebhookByMerchantId.mockResolvedValue(null);

        const result = await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(result).toEqual({ outcome: "unresolved" });
        expect(
            ctx.purchaseRepository.findByMerchantAndCheckoutToken
        ).not.toHaveBeenCalled();
    });

    it("counts the ladder outcome against the generate call site", async () => {
        const { infraMetrics } = await import("@backend-infrastructure");
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            { identityGroupId: "webhook-group" }
        );
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(
            "anon-1"
        );

        await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(infraMetrics.installCredentialOutcome).toHaveBeenCalledWith(
            "resolved",
            "generate"
        );
    });

    it("counts a deferred outcome so the checkout-token share is readable", async () => {
        const { infraMetrics } = await import("@backend-infrastructure");
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            null
        );
        ctx.purchaseClaimRepository.findByMerchantAndToken.mockResolvedValue(
            null
        );

        await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(infraMetrics.installCredentialOutcome).toHaveBeenCalledWith(
            "deferred",
            "generate"
        );
    });

    it("prefers a resolved purchase over a conflicting claim row", async () => {
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            { identityGroupId: "webhook-group" }
        );
        ctx.purchaseClaimRepository.findByMerchantAndToken.mockResolvedValue({
            claimingIdentityGroupId: "attacker-group",
            createdAt: new Date(),
        });
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(
            "anon-webhook"
        );

        const result = await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(result).toEqual({
            outcome: "resolved",
            anonymousId: "anon-webhook",
        });
        expect(
            ctx.purchaseClaimRepository.findByMerchantAndToken
        ).not.toHaveBeenCalled();
    });

    it("falls back to a pending claim row and counts it when the webhook is late", async () => {
        const { infraMetrics } = await import("@backend-infrastructure");
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            null
        );
        ctx.purchaseClaimRepository.findByMerchantAndToken.mockResolvedValue({
            claimingIdentityGroupId: "claim-group",
            createdAt: null,
        });
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(
            "anon-claim"
        );

        const result = await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(result).toEqual({
            outcome: "resolved",
            anonymousId: "anon-claim",
        });
        expect(infraMetrics.installCredentialClaimArm).toHaveBeenCalledWith(
            MERCHANT_ID,
            "generate"
        );
    });

    it("defers when neither a purchase nor a claim exists", async () => {
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            null
        );
        ctx.purchaseClaimRepository.findByMerchantAndToken.mockResolvedValue(
            null
        );

        const result = await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(result).toEqual({ outcome: "deferred" });
        expect(ctx.identityRepository.addNode).not.toHaveBeenCalled();
    });

    it("materialises a latched frakmint_ id when the resolved group has none", async () => {
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            { identityGroupId: "wallet-group" }
        );
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(null);

        const result = await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(result.outcome).toBe("resolved");
        const anonymousId =
            result.outcome === "resolved" ? result.anonymousId : "";
        expect(anonymousId).toMatch(/^frakmint_/);
        expect(ctx.identityRepository.addNode).toHaveBeenCalledWith(
            {
                groupId: "wallet-group",
                type: "anonymous_fingerprint",
                value: anonymousId,
                merchantId: MERCHANT_ID,
            },
            expect.anything()
        );
        expect(
            ctx.identityRepository.latchServerMintedProof
        ).toHaveBeenCalledWith(
            { value: anonymousId, merchantId: MERCHANT_ID },
            expect.anything()
        );
    });

    it("adopts the winner and never latches when it loses the materialisation race", async () => {
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            { identityGroupId: "wallet-group" }
        );
        ctx.identityRepository.findAnonymousFingerprint
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce("anon-winner");

        const result = await ctx.orchestrator.resolveForGenerate({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(result).toEqual({
            outcome: "resolved",
            anonymousId: "anon-winner",
        });
        expect(ctx.identityRepository.addNode).not.toHaveBeenCalled();
        expect(
            ctx.identityRepository.latchServerMintedProof
        ).not.toHaveBeenCalled();
    });
});

describe("InstallCredentialOrchestrator.resolveDeferred", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.purchaseRepository.getWebhookByMerchantId.mockResolvedValue({
            id: 7,
        });
    });

    it("returns the existing anonymous id", async () => {
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            { identityGroupId: "webhook-group" }
        );
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(
            "anon-1"
        );

        await expect(
            ctx.orchestrator.resolveDeferred({
                merchantId: MERCHANT_ID,
                checkoutToken: CHECKOUT_TOKEN,
            })
        ).resolves.toEqual({ anonymousId: "anon-1" });
    });

    it("labels the claim arm with the resolve call site, not generate", async () => {
        const { infraMetrics } = await import("@backend-infrastructure");
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            null
        );
        ctx.purchaseClaimRepository.findByMerchantAndToken.mockResolvedValue({
            claimingIdentityGroupId: "claim-group",
            createdAt: new Date(),
        });
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(
            "anon-claim"
        );

        await ctx.orchestrator.resolveDeferred({
            merchantId: MERCHANT_ID,
            checkoutToken: CHECKOUT_TOKEN,
        });

        expect(infraMetrics.installCredentialClaimArm).toHaveBeenCalledWith(
            MERCHANT_ID,
            "resolve"
        );
        expect(infraMetrics.installCredentialOutcome).toHaveBeenCalledWith(
            "resolved",
            "resolve"
        );
    });

    it("never writes a node on the unauthenticated path", async () => {
        ctx.purchaseRepository.findByMerchantAndCheckoutToken.mockResolvedValue(
            { identityGroupId: "wallet-group" }
        );
        ctx.identityRepository.findAnonymousFingerprint.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.resolveDeferred({
                merchantId: MERCHANT_ID,
                checkoutToken: CHECKOUT_TOKEN,
            })
        ).resolves.toBeNull();
        expect(ctx.identityRepository.addNode).not.toHaveBeenCalled();
        expect(
            ctx.identityRepository.latchServerMintedProof
        ).not.toHaveBeenCalled();
    });
});
