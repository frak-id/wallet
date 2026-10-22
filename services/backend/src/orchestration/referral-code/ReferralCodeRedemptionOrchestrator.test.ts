import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type { GameSelect } from "../../domain/game/db/schema";
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

const openGame: GameSelect = {
    id: "game-1",
    referralCodeId: "code-id",
    campaignRuleId: "rule-1",
    sponsorMerchantId: null,
    prizeAmount: 100,
    prizeDescription: "100 EUR",
    startsAt: new Date(Date.now() - HOUR_MS),
    endsAt: new Date(Date.now() + HOUR_MS),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
};

const gameRule = {
    id: "rule-1",
    merchantId: FRAK_MERCHANT_ID,
    status: "active",
    rule: {
        trigger: "game_join",
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

const signupRule = {
    ...gameRule,
    id: "signup-rule",
    rule: {
        trigger: "referral_signup",
        conditions: [],
        rewards: [
            { recipient: "referrer", amountType: "fixed", amount: 2 },
            { recipient: "referee", amountType: "fixed", amount: 1.5 },
        ],
    },
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
        existsByExternalEvent: vi.fn().mockResolvedValue(false),
    };
    const gameRepository = {
        findByReferralCodeId: vi.fn().mockResolvedValue(null),
        findCurrent: vi.fn().mockResolvedValue(null),
    };
    const gamePlayer = {
        joinedAt: vi.fn().mockResolvedValue(null),
        ticketsOf: vi.fn().mockResolvedValue(0),
    };
    const campaignRuleRepository = {
        findById: vi.fn().mockResolvedValue(gameRule),
        findActiveByMerchant: vi.fn().mockResolvedValue([signupRule]),
    };

    const frakGame = new FrakGameOrchestrator(
        gameRepository as never,
        campaignRuleRepository as never,
        { findById: vi.fn() } as never,
        interactionLogRepository as never,
        gamePlayer as never
    );
    const orchestrator = new ReferralCodeRedemptionOrchestrator(
        referralCodeService as never,
        referralLinkRepository as never,
        identityRepository as never,
        interactionLogRepository as never,
        gameRepository as never,
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
        gameRepository,
        gamePlayer,
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

    it("reports the referee's signup reward from the live signup rule", async () => {
        await expect(ctx.redeem("onboarding")).resolves.toMatchObject({
            signupReward: 1.5,
            game: undefined,
        });
    });

    it("joins the current game with the signup of a friend's code", async () => {
        ctx.gameRepository.findCurrent.mockResolvedValue(openGame);

        const result = await ctx.redeem("onboarding");

        expect(result.game).toMatchObject({ id: "game-1" });
        expect(result.signupReward).toBe(1.5);
        expect(result.gameReward).toBeUndefined();
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "game_join",
                identityGroupId: REFEREE,
                externalEventId: `game_join:game-1:${REFEREE}`,
                payload: { gameId: "game-1", newcomer: false },
            })
        );
    });

    it("returns no game when none is open", async () => {
        const result = await ctx.redeem("onboarding");

        expect(result.game).toBeUndefined();
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).toHaveBeenCalledTimes(1);
    });

    it("does not link the referrer when the current game cannot be read", async () => {
        ctx.gameRepository.findCurrent.mockRejectedValue(new Error("db down"));

        await expect(ctx.redeem("onboarding")).rejects.toThrow("db down");
        expect(ctx.referralLinkRepository.create).not.toHaveBeenCalled();
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

    it("does not join the current game for an existing user's friend code", async () => {
        ctx.gameRepository.findCurrent.mockResolvedValue(openGame);

        await ctx.redeem(undefined);

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

describe("ReferralCodeRedemptionOrchestrator game join", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        ctx.referralCodeService.findByCode.mockResolvedValue(code());
        ctx.gameRepository.findByReferralCodeId.mockResolvedValue(openGame);
    });

    it("joins the game and sets Frak as referrer for a new account in onboarding", async () => {
        const result = await ctx.redeem("onboarding");

        expect(result).toEqual({
            referrerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
            kind: "frak",
            game: {
                id: "game-1",
                prizeAmount: 100,
                prizeDescription: "100 EUR",
                startsAt: openGame.startsAt,
                endsAt: openGame.endsAt,
                sponsor: null,
            },
            gameReward: 1,
        });
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).toHaveBeenCalledWith({
            type: "game_join",
            identityGroupId: REFEREE,
            merchantId: FRAK_MERCHANT_ID,
            externalEventId: `game_join:game-1:${REFEREE}`,
            payload: { gameId: "game-1", newcomer: true },
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

            const result = await ctx.redeem(gate.context);

            expect(result.gameReward).toBeUndefined();
            expect(
                ctx.interactionLogRepository.createIdempotent
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "game_join",
                    payload: { gameId: "game-1", newcomer: false },
                })
            );
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

    it.each([
        { name: "open", game: {} },
        { name: "ended", game: { endsAt: new Date(Date.now() - 1000) } },
        { name: "paused", game: { status: "paused" as const } },
    ])(
        "returns a $name game already joined without reward",
        async (testCase) => {
            ctx.gameRepository.findByReferralCodeId.mockResolvedValue({
                ...openGame,
                ...testCase.game,
            });
            ctx.gamePlayer.joinedAt.mockResolvedValue(new Date());

            const result = await ctx.redeem("onboarding");

            expect(result.game).toMatchObject({ id: "game-1" });
            expect(result.gameReward).toBeUndefined();
            expect(
                ctx.interactionLogRepository.createIdempotent
            ).not.toHaveBeenCalled();
            expect(emit).not.toHaveBeenCalled();
        }
    );

    it.each([
        { name: "has ended", game: { endsAt: new Date(Date.now() - 1000) } },
        {
            name: "has not started",
            game: { startsAt: new Date(Date.now() + HOUR_MS) },
        },
        { name: "is paused", game: { status: "paused" as const } },
    ])("rejects a game that $name as GAME_CLOSED", async (testCase) => {
        ctx.gameRepository.findByReferralCodeId.mockResolvedValue({
            ...openGame,
            ...testCase.game,
        });

        await expect(ctx.redeem(undefined)).rejects.toMatchObject({
            status: 409,
            code: "GAME_CLOSED",
        });
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).not.toHaveBeenCalled();
    });

    it.each([
        { name: "paused", rule: { status: "paused" as const } },
        {
            name: "out of budget",
            rule: { budgetUsed: { total: { used: 9.5 } } },
        },
    ])("joins without gameReward when the rule is $name", async (testCase) => {
        ctx.campaignRuleRepository.findById.mockResolvedValue({
            ...gameRule,
            ...testCase.rule,
        });

        const result = await ctx.redeem("onboarding");

        expect(result.game).toMatchObject({ id: "game-1" });
        expect(result.gameReward).toBeUndefined();
        expect(
            ctx.interactionLogRepository.createIdempotent
        ).toHaveBeenCalledWith(expect.objectContaining({ type: "game_join" }));
    });
});
