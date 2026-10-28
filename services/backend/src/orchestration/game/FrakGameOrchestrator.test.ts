import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type { GameSelect } from "../../domain/game/db/schema";
import { NO_TICKETS, type TicketBreakdown } from "../../domain/game/tickets";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { FrakGameOrchestrator } from "./FrakGameOrchestrator";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({
    eventEmitter: { emit: vi.fn() },
    productEvents: { track },
}));

const HOUR_MS = 60 * 60 * 1000;
const USER = "user-group";
const JOINED_AT = new Date("2026-10-02T10:00:00Z");

const game: GameSelect = {
    id: "game-1",
    referralCodeId: "code-id",
    campaignRuleId: "rule-1",
    sponsorMerchantId: null,
    prizeAmount: 100,
    prizeDescription: null,
    startsAt: new Date(Date.now() - HOUR_MS),
    endsAt: new Date(Date.now() + HOUR_MS),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
};

const gameRule = {
    id: "rule-1",
    status: "active",
    budgetUsed: {},
    rule: {
        trigger: "game_join",
        conditions: [],
        rewards: [{ recipient: "referee", amountType: "fixed", amount: 1 }],
    },
} as unknown as CampaignRuleSelect;

function makeOrchestrator(
    opts: {
        game?: GameSelect | null;
        joinedAt?: Date | null;
        tickets?: TicketBreakdown;
        created?: boolean;
        rule?: CampaignRuleSelect;
        instagramLink?: { follows: boolean } | null;
        declaration?: { username: string } | null;
    } = {}
) {
    const joinedAt = vi.fn().mockResolvedValue(opts.joinedAt ?? null);
    const ticketsOf = vi.fn().mockResolvedValue(opts.tickets ?? NO_TICKETS);
    const createIdempotent = vi
        .fn()
        .mockResolvedValue(opts.created === false ? null : { id: "i-1" });
    const findRule = vi.fn().mockResolvedValue(opts.rule ?? gameRule);
    const findLink = vi.fn().mockResolvedValue(opts.instagramLink ?? null);
    const findDeclaration = vi.fn().mockResolvedValue(opts.declaration ?? null);
    const orchestrator = new FrakGameOrchestrator(
        {
            findCurrent: vi
                .fn()
                .mockResolvedValue(opts.game === undefined ? game : opts.game),
        } as never,
        {
            findById: findRule,
            findActiveByMerchant: vi.fn().mockResolvedValue([]),
        } as never,
        { findById: vi.fn() } as never,
        { createIdempotent } as never,
        { joinedAt, ticketsOf } as never,
        { findByIdentityGroup: findLink } as never,
        { findDeclaration } as never
    );
    return {
        orchestrator,
        joinedAt,
        ticketsOf,
        createIdempotent,
        findRule,
        findLink,
        findDeclaration,
    };
}

describe("FrakGameOrchestrator.getCurrentGame", () => {
    it.each([
        {
            name: "no Instagram at all",
            link: null,
            declaration: null,
            eligible: false,
            instagram: "none",
        },
        {
            name: "a declared handle",
            link: null,
            declaration: { username: "someone" },
            eligible: true,
            instagram: "declared",
        },
        {
            name: "a certified account that does not follow",
            link: { follows: false },
            declaration: null,
            eligible: false,
            instagram: "certified",
        },
        {
            name: "a certified account that follows",
            link: { follows: true },
            declaration: null,
            eligible: true,
            instagram: "certified",
        },
    ])(
        "derives eligibility from $name",
        async ({ link, declaration, eligible, instagram }) => {
            const { orchestrator, findLink, findDeclaration } =
                makeOrchestrator({
                    instagramLink: link,
                    declaration,
                });

            const result = await orchestrator.getCurrentGame(USER);

            expect(findLink).toHaveBeenCalledWith(USER);
            expect(findDeclaration).toHaveBeenCalledWith(USER);
            expect(result.me.eligible).toBe(eligible);
            expect(result.me.instagram).toBe(instagram);
        }
    );

    it("does not look the Instagram link up when no game is open", async () => {
        const { orchestrator, findLink } = makeOrchestrator({ game: null });

        await orchestrator.getCurrentGame(USER);

        expect(findLink).not.toHaveBeenCalled();
    });

    it("returns the ticket count of a participant with its sources", async () => {
        const ticketsBySource = {
            join: 1,
            instagramCertified: 0,
            purchase: 3,
            referredPurchase: 0,
            referredSignup: 2,
            brandShare: 1,
        };
        const { orchestrator, ticketsOf } = makeOrchestrator({
            joinedAt: JOINED_AT,
            tickets: ticketsBySource,
        });

        const result = await orchestrator.getCurrentGame(USER);

        expect(ticketsOf).toHaveBeenCalledWith(game, USER, JOINED_AT);
        expect(result.me).toEqual({
            participating: true,
            tickets: 7,
            ticketsBySource,
            eligible: false,
            instagram: "none",
        });
    });

    it("returns 0 tickets without counting when not participating", async () => {
        const { orchestrator, ticketsOf } = makeOrchestrator();

        const result = await orchestrator.getCurrentGame(USER);

        expect(ticketsOf).not.toHaveBeenCalled();
        expect(result.me.tickets).toBe(0);
        expect(result.me.participating).toBe(false);
    });

    it("returns 0 tickets when there is no game", async () => {
        const { orchestrator } = makeOrchestrator({ game: null });

        const result = await orchestrator.getCurrentGame(USER);

        expect(result).toEqual({
            game: null,
            me: {
                participating: false,
                tickets: 0,
                ticketsBySource: NO_TICKETS,
                eligible: false,
                instagram: "none",
            },
        });
    });
});

describe("FrakGameOrchestrator.joinGame", () => {
    beforeEach(() => track.mockReset());

    it("tracks game_joined from the game code when the join is created", async () => {
        const { orchestrator } = makeOrchestrator();

        await orchestrator.joinGame(game, USER, false);

        expect(track).toHaveBeenCalledWith("game_joined", USER, {
            game_id: "game-1",
            source: "game_code",
            newcomer: false,
        });
    });

    it("tracks nothing when a concurrent join created the interaction", async () => {
        const { orchestrator } = makeOrchestrator({ created: false });

        await orchestrator.joinGame(game, USER, true);

        expect(track).not.toHaveBeenCalled();
    });

    it.each([
        { name: "paused", over: { status: "paused" as const } },
        { name: "ended", over: { endsAt: new Date(Date.now() - 1000) } },
    ])(
        "returns a $name game already joined without write or reward",
        async ({ over }) => {
            const { orchestrator, createIdempotent } = makeOrchestrator({
                joinedAt: JOINED_AT,
            });

            const result = await orchestrator.joinGame(
                { ...game, ...over },
                USER,
                true
            );

            expect(result.game.id).toBe("game-1");
            expect(result.gameReward).toBeUndefined();
            expect(createIdempotent).not.toHaveBeenCalled();
        }
    );

    it.each([
        { name: "paused", over: { status: "paused" as const } },
        { name: "ended", over: { endsAt: new Date(Date.now() - 1000) } },
        {
            name: "not started",
            over: { startsAt: new Date(Date.now() + HOUR_MS) },
        },
    ])("rejects a $name game not joined as GAME_CLOSED", async ({ over }) => {
        const { orchestrator, createIdempotent } = makeOrchestrator();

        await expect(
            orchestrator.joinGame({ ...game, ...over }, USER, true)
        ).rejects.toMatchObject({ status: 409, code: "GAME_CLOSED" });
        expect(createIdempotent).not.toHaveBeenCalled();
    });

    it("writes one game_join interaction and reports the gameReward", async () => {
        const { orchestrator, createIdempotent } = makeOrchestrator();

        const result = await orchestrator.joinGame(game, USER, true);

        expect(result.gameReward).toBe(1);
        expect(createIdempotent).toHaveBeenCalledTimes(1);
        expect(createIdempotent).toHaveBeenCalledWith({
            type: "game_join",
            identityGroupId: USER,
            merchantId: FRAK_MERCHANT_ID,
            externalEventId: `game_join:game-1:${USER}`,
            payload: { gameId: "game-1", newcomer: true },
        });
    });

    it("skips the rule lookup and writes newcomer false for a non-newcomer", async () => {
        const { orchestrator, createIdempotent, findRule } = makeOrchestrator();

        const result = await orchestrator.joinGame(game, USER, false);

        expect(result.gameReward).toBeUndefined();
        expect(findRule).not.toHaveBeenCalled();
        expect(createIdempotent).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: { gameId: "game-1", newcomer: false },
            })
        );
    });

    it("reports no gameReward when a concurrent join created the interaction", async () => {
        const { orchestrator } = makeOrchestrator({ created: false });

        const result = await orchestrator.joinGame(game, USER, true);

        expect(result.game.id).toBe("game-1");
        expect(result.gameReward).toBeUndefined();
    });
});

describe("FrakGameOrchestrator join without gameReward", () => {
    const withRule = (over: object) =>
        ({ ...gameRule, ...over }) as unknown as CampaignRuleSelect;

    it.each([
        {
            name: "the campaign rule is paused",
            opts: { rule: withRule({ status: "paused" }) },
            run: (o: FrakGameOrchestrator) => o.joinGame(game, USER, true),
        },
        {
            name: "the campaign rule has no remaining budget",
            opts: {
                rule: withRule({
                    budgetConfig: [
                        { label: "global", amount: 1, durationInSeconds: null },
                    ],
                    budgetUsed: { global: { used: 1 } },
                }),
            },
            run: (o: FrakGameOrchestrator) => o.joinGame(game, USER, true),
        },
        {
            name: "the referee payout is 0",
            opts: {
                rule: withRule({
                    rule: { ...gameRule.rule, rewards: [] },
                }),
            },
            run: (o: FrakGameOrchestrator) => o.joinGame(game, USER, true),
        },
    ])(
        "still writes the join but reports no gameReward when $name",
        async ({ opts, run }) => {
            const { orchestrator, createIdempotent } = makeOrchestrator(opts);

            const result = await run(orchestrator);

            expect(result.gameReward).toBeUndefined();
            expect(createIdempotent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "game_join",
                    externalEventId: `game_join:game-1:${USER}`,
                })
            );
        }
    );
});

describe("FrakGameOrchestrator.applySignup", () => {
    beforeEach(() => track.mockReset());

    it("tracks the referral signup and the friend_signup join", async () => {
        const { orchestrator } = makeOrchestrator();
        const plan = await orchestrator.planSignup();

        await orchestrator.applySignup(
            plan,
            { id: "code-1", ownerIdentityGroupId: "owner" } as never,
            USER
        );

        expect(track).toHaveBeenCalledWith("referral_signup_completed", USER, {
            referrer_identity_group_id: "owner",
        });
        expect(track).toHaveBeenCalledWith("game_joined", USER, {
            game_id: "game-1",
            source: "friend_signup",
            newcomer: false,
        });
    });

    it("writes the referee's game_join as non-newcomer and pays no gameReward", async () => {
        const { orchestrator, createIdempotent } = makeOrchestrator();
        const plan = await orchestrator.planSignup();

        const outcome = await orchestrator.applySignup(
            plan,
            { id: "code-1", ownerIdentityGroupId: "owner" } as never,
            USER
        );

        expect(outcome).not.toHaveProperty("gameReward");
        expect(createIdempotent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "game_join",
                externalEventId: `game_join:game-1:${USER}`,
                payload: { gameId: "game-1", newcomer: false },
            })
        );
    });
});
