import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRAK_REFERRAL_IDENTITY_GROUP_ID } from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import { ReferralCodeRedemptionOrchestrator } from "./ReferralCodeRedemptionOrchestrator";

const { frakCodeRejected } = vi.hoisted(() => ({
    frakCodeRejected: vi.fn(),
}));

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    businessMetrics: { frakCodeRejected },
}));

const REFEREE = "referee-group";
const HOUR_MS = 60 * 60 * 1000;

const code = (over: Partial<ReferralCodeSelect> = {}): ReferralCodeSelect => ({
    id: "code-id",
    code: "FRAKPA",
    ownerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
    kind: "frak",
    createdAt: new Date(),
    revokedAt: null,
    ...over,
});

const userCode = code({
    code: "LOLA10",
    ownerIdentityGroupId: "owner-group",
    kind: "user",
});

function makeOrchestrator() {
    const referralCodeService = { findByCode: vi.fn() };
    const referralLinkRepository = {
        wouldCreateCycle: vi.fn().mockResolvedValue(false),
        create: vi.fn().mockResolvedValue({ id: "link-id" }),
    };
    const identityRepository = {
        findGroupById: vi
            .fn()
            .mockResolvedValue({ createdAt: new Date(Date.now() - HOUR_MS) }),
    };
    const interactionLogRepository = {
        hasPurchaseForGroup: vi.fn().mockResolvedValue(false),
    };

    const orchestrator = new ReferralCodeRedemptionOrchestrator(
        referralCodeService as never,
        referralLinkRepository as never,
        identityRepository as never,
        interactionLogRepository as never
    );

    return {
        orchestrator,
        referralCodeService,
        referralLinkRepository,
        identityRepository,
        interactionLogRepository,
    };
}

describe("ReferralCodeRedemptionOrchestrator.redeem", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.referralCodeService.findByCode.mockResolvedValue(code());
    });

    it("accepts a Frak code during onboarding and reports its kind", async () => {
        const result = await ctx.orchestrator.redeem({
            code: "FRAKPA",
            refereeIdentityGroupId: REFEREE,
            context: "onboarding",
        });

        expect(result).toEqual({
            referrerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
            kind: "frak",
        });
        expect(ctx.referralLinkRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: "cross_merchant",
                referrerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
                refereeIdentityGroupId: REFEREE,
                sourceData: { type: "code", codeId: "code-id" },
            })
        );
    });

    it.each([
        {
            name: "without the onboarding context",
            reason: "no_onboarding_context",
            context: undefined,
            groupAgeMs: HOUR_MS,
            hasPurchase: false,
        },
        {
            name: "from an account older than the onboarding window",
            reason: "outside_onboarding_window",
            context: "onboarding",
            groupAgeMs: 3 * 24 * HOUR_MS,
            hasPurchase: false,
        },
        {
            name: "from an account with a purchase",
            reason: "has_purchase",
            context: "onboarding",
            groupAgeMs: HOUR_MS,
            hasPurchase: true,
        },
    ] as const)("rejects a Frak code $name as NOT_FOUND", async (testCase) => {
        ctx.identityRepository.findGroupById.mockResolvedValue({
            createdAt: new Date(Date.now() - testCase.groupAgeMs),
        });
        ctx.interactionLogRepository.hasPurchaseForGroup.mockResolvedValue(
            testCase.hasPurchase
        );

        await expect(
            ctx.orchestrator.redeem({
                code: "FRAKPA",
                refereeIdentityGroupId: REFEREE,
                context: testCase.context,
            })
        ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
        expect(frakCodeRejected).toHaveBeenCalledWith(testCase.reason);
        expect(ctx.referralLinkRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a Frak code when the identity group is unknown", async () => {
        ctx.identityRepository.findGroupById.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.redeem({
                code: "FRAKPA",
                refereeIdentityGroupId: REFEREE,
                context: "onboarding",
            })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("redeems a user code without context and skips the onboarding checks", async () => {
        ctx.referralCodeService.findByCode.mockResolvedValue(userCode);

        const result = await ctx.orchestrator.redeem({
            code: "LOLA10",
            refereeIdentityGroupId: REFEREE,
        });

        expect(result.kind).toBe("user");
        expect(ctx.identityRepository.findGroupById).not.toHaveBeenCalled();
        expect(
            ctx.interactionLogRepository.hasPurchaseForGroup
        ).not.toHaveBeenCalled();
    });

    it("still reports ALREADY_REDEEMED for a Frak code when a referrer exists", async () => {
        ctx.referralLinkRepository.create.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.redeem({
                code: "FRAKPA",
                refereeIdentityGroupId: REFEREE,
                context: "onboarding",
            })
        ).rejects.toMatchObject({ status: 409, code: "ALREADY_REDEEMED" });
    });

    it("returns NOT_FOUND for an unknown code", async () => {
        ctx.referralCodeService.findByCode.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.redeem({
                code: "NOPE22",
                refereeIdentityGroupId: REFEREE,
                context: "onboarding",
            })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(frakCodeRejected).not.toHaveBeenCalled();
    });
});
