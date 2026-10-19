import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type { DropSelect } from "../../domain/game/db/schema";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { FRAK_REFERRAL_IDENTITY_GROUP_ID } from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type { RedeemContext } from "../../domain/referral-code/schemas";
import { FrakGameOrchestrator } from "../game";
import { ReferralCodeRedemptionOrchestrator } from "./ReferralCodeRedemptionOrchestrator";

const { frakCodeRejected, emit } = vi.hoisted(() => ({
    frakCodeRejected: vi.fn(),
    emit: vi.fn(),
}));

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    businessMetrics: { frakCodeRejected },
    eventEmitter: { emit },
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

const openDrop: DropSelect = {
    id: "drop-1",
    referralCodeId: "code-id",
    campaignRuleId: "rule-1",
    sponsorMerchantId: null,
    prizeDescription: "100 EUR",
    startsAt: new Date(Date.now() - HOUR_MS),
    endsAt: new Date(Date.now() + HOUR_MS),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
};

const dropRule = {
    id: "rule-1",
    merchantId: FRAK_MERCHANT_ID,
    status: "active",
    rule: {
        trigger: "drop_join",
        conditions: [],
        rewards: [
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 1,
            },
        ],
    },
    budgetConfig: [{ label: "total", durationInSeconds: null, amount: 10 }],
    budgetUsed: { total: { used: 3 } },
} as unknown as CampaignRuleSelect;

const GATE_CASES = [
    {
        name: "without the onboarding context",
        reason: "no_onboarding_context",
        context: undefined,
        ageMs: HOUR_MS,
        hasPurchase: false,
    },
    {
        name: "from an account older than the onboarding window",
        reason: "outside_onboarding_window",
        context: "onboarding",
        ageMs: 3 * 24 * HOUR_MS,
        hasPurchase: false,
    },
    {
        name: "from an unknown identity group",
        reason: "outside_onboarding_window",
        context: "onboarding",
        ageMs: null,
        hasPurchase: false,
    },
    {
        name: "from an account with a purchase",
        reason: "has_purchase",
        context: "onboarding",
        ageMs: HOUR_MS,
        hasPurchase: true,
    },
] as const;

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
        createIdempotent: vi.fn().mockResolvedValue({ id: "interaction" }),
    };
    const dropRepository = {
        findByReferralCodeId: vi.fn().mockResolvedValue(null),
    };
    const campaignRuleRepository = {
        findById: vi.fn().mockResolvedValue(dropRule),
    };

    const frakGame = new FrakGameOrchestrator(
        dropRepository as never,
        campaignRuleRepository as never,
        { findById: vi.fn() } as never,
        interactionLogRepository as never
    );
    const orchestrator = new ReferralCodeRedemptionOrchestrator(
        referralCodeService as never,
        referralLinkRepository as never,
        identityRepository as never,
        interactionLogRepository as never,
        dropRepository as never,
        frakGame
    );

    return {
        redeem: (context: RedeemContext | undefined) =>
            orchestrator.redeem({
                code: "CODE42",
                refereeIdentityGroupId: REFEREE,
                context,
            }),
        applyGate: (gate: (typeof GATE_CASES)[number]) => {
            identityRepository.findGroupById.mockResolvedValue(
                gate.ageMs === null
                    ? null
                    : { createdAt: new Date(Date.now() - gate.ageMs) }
            );
            interactionLogRepository.hasPurchaseForGroup.mockResolvedValue(
                gate.hasPurchase
            );
        },
        referralCodeService,
        referralLinkRepository,
        identityRepository,
        interactionLogRepository,
        dropRepository,
        campaignRuleRepository,
    };
}

describe("ReferralCodeRedemptionOrchestrator.redeem", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.referralCodeService.findByCode.mockResolvedValue(code());
    });

    it("accepts a Frak code during onboarding and reports its kind", async () => {
        const result = await ctx.redeem("onboarding");

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

    it.each(GATE_CASES)(
        "rejects a Frak code $name as NOT_FOUND",
        async (gate) => {
            ctx.applyGate(gate);

            await expect(ctx.redeem(gate.context)).rejects.toMatchObject({
                status: 404,
                code: "NOT_FOUND",
            });
            expect(frakCodeRejected).toHaveBeenCalledWith(gate.reason);
            expect(ctx.referralLinkRepository.create).not.toHaveBeenCalled();
        }
    );

    it("still reports ALREADY_REDEEMED for a Frak code when a referrer exists", async () => {
        ctx.referralLinkRepository.create.mockResolvedValue(null);

        await expect(ctx.redeem("onboarding")).rejects.toMatchObject({
            status: 409,
            code: "ALREADY_REDEEMED",
        });
    });

    it("returns NOT_FOUND for an unknown code", async () => {
        ctx.referralCodeService.findByCode.mockResolvedValue(null);

        await expect(ctx.redeem("onboarding")).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
        expect(frakCodeRejected).not.toHaveBeenCalled();
    });
});

describe("ReferralCodeRedemptionOrchestrator referral signup", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.referralCodeService.findByCode.mockResolvedValue(userCode);
    });

    it("emits one referral_signup on the Frak merchant for a new account in onboarding", async () => {
        await ctx.redeem("onboarding");

        expect(
            ctx.interactionLogRepository.createIdempotent
        ).toHaveBeenCalledWith({
            type: "referral_signup",
            identityGroupId: REFEREE,
            merchantId: FRAK_MERCHANT_ID,
            externalEventId: `signup:${REFEREE}`,
            payload: {
                referralCodeId: "code-id",
                referrerIdentityGroupId: "owner-group",
            },
        });
        expect(emit).toHaveBeenCalledWith("newInteraction");
    });

    it.each([
        {
            name: "a user code without the onboarding context",
            referralCode: userCode,
            context: undefined,
            ageMs: HOUR_MS,
        },
        {
            name: "an account older than the onboarding window",
            referralCode: userCode,
            context: "onboarding",
            ageMs: 3 * 24 * HOUR_MS,
        },
        {
            name: "a Frak code",
            referralCode: code(),
            context: "onboarding",
            ageMs: HOUR_MS,
        },
    ] as const)("does not emit for $name", async (testCase) => {
        ctx.referralCodeService.findByCode.mockResolvedValue(
            testCase.referralCode
        );
        ctx.identityRepository.findGroupById.mockResolvedValue({
            createdAt: new Date(Date.now() - testCase.ageMs),
        });

        await expect(ctx.redeem(testCase.context)).resolves.toMatchObject({
            kind: testCase.referralCode.kind,
        });
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).not.toHaveBeenCalled();
    });

    it("does not link the referrer when the account check fails", async () => {
        ctx.identityRepository.findGroupById.mockRejectedValue(
            new Error("db down")
        );

        await expect(ctx.redeem("onboarding")).rejects.toThrow("db down");
        expect(ctx.referralLinkRepository.create).not.toHaveBeenCalled();
    });
});

describe("ReferralCodeRedemptionOrchestrator drop join", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.referralCodeService.findByCode.mockResolvedValue(code());
        ctx.dropRepository.findByReferralCodeId.mockResolvedValue(openDrop);
    });

    it("joins the drop and sets Frak as referrer for a new account in onboarding", async () => {
        const result = await ctx.redeem("onboarding");

        expect(result).toEqual({
            referrerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
            kind: "frak",
            drop: {
                id: "drop-1",
                prizeDescription: "100 EUR",
                startsAt: openDrop.startsAt,
                endsAt: openDrop.endsAt,
                sponsor: null,
            },
        });
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).toHaveBeenCalledWith({
            type: "drop_join",
            identityGroupId: REFEREE,
            merchantId: FRAK_MERCHANT_ID,
            externalEventId: `drop:drop-1:${REFEREE}`,
            payload: { dropId: "drop-1", campaignRuleId: "rule-1" },
        });
        expect(ctx.referralLinkRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                referrerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
            })
        );
    });

    it.each(GATE_CASES)(
        "lets a user join $name without touching their referrer",
        async (gate) => {
            ctx.applyGate(gate);

            await ctx.redeem(gate.context);

            expect(
                ctx.interactionLogRepository.createIdempotent
            ).toHaveBeenCalled();
            expect(ctx.referralLinkRepository.create).not.toHaveBeenCalled();
            expect(frakCodeRejected).not.toHaveBeenCalled();
        }
    );

    it("still joins when the referrer slot is already taken", async () => {
        ctx.referralLinkRepository.create.mockResolvedValue(null);

        await expect(ctx.redeem("onboarding")).resolves.toMatchObject({
            kind: "frak",
        });
        expect(ctx.referralLinkRepository.create).toHaveBeenCalled();
    });

    it("does not join when the eligibility check fails", async () => {
        ctx.interactionLogRepository.hasPurchaseForGroup.mockRejectedValue(
            new Error("db down")
        );

        await expect(ctx.redeem("onboarding")).rejects.toThrow("db down");
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).not.toHaveBeenCalled();
    });

    it("rejects a second join as ALREADY_JOINED", async () => {
        ctx.interactionLogRepository.createIdempotent.mockResolvedValue(null);

        await expect(ctx.redeem("onboarding")).rejects.toMatchObject({
            status: 409,
            code: "ALREADY_JOINED",
        });
        expect(ctx.referralLinkRepository.create).not.toHaveBeenCalled();
        expect(emit).not.toHaveBeenCalled();
    });

    it.each([
        { name: "has ended", drop: { endsAt: new Date(Date.now() - 1000) } },
        {
            name: "has not started",
            drop: { startsAt: new Date(Date.now() + HOUR_MS) },
        },
        { name: "is paused", drop: { status: "paused" as const } },
        { name: "has a paused rule", rule: { status: "paused" as const } },
    ])("rejects a drop that $name as DROP_CLOSED", async (testCase) => {
        ctx.dropRepository.findByReferralCodeId.mockResolvedValue({
            ...openDrop,
            ...testCase.drop,
        });
        ctx.campaignRuleRepository.findById.mockResolvedValue({
            ...dropRule,
            ...testCase.rule,
        });

        await expect(ctx.redeem(undefined)).rejects.toMatchObject({
            status: 409,
            code: "DROP_CLOSED",
        });
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).not.toHaveBeenCalled();
    });

    it("rejects a drop whose budget cannot pay one more join as DROP_FULL", async () => {
        ctx.campaignRuleRepository.findById.mockResolvedValue({
            ...dropRule,
            budgetUsed: { total: { used: 9.5 } },
        });

        await expect(ctx.redeem(undefined)).rejects.toMatchObject({
            status: 409,
            code: "DROP_FULL",
        });
    });
});
