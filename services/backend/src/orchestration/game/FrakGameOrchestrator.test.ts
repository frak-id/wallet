import { describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type { GameSelect } from "../../domain/game/db/schema";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { FrakGameOrchestrator } from "./FrakGameOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    eventEmitter: { emit: vi.fn() },
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
        tickets?: number;
        created?: boolean;
        rule?: CampaignRuleSelect;
        instagramLink?: { follows: boolean } | null;
    } = {}
) {
    const joinedAt = vi.fn().mockResolvedValue(opts.joinedAt ?? null);
    const ticketsOf = vi.fn().mockResolvedValue(opts.tickets ?? 0);
    const createIdempotent = vi
        .fn()
        .mockResolvedValue(opts.created === false ? null : { id: "i-1" });
    const findRule = vi.fn().mockResolvedValue(opts.rule ?? gameRule);
    const findLink = vi.fn().mockResolvedValue(opts.instagramLink ?? null);
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
        { findByIdentityGroup: findLink } as never
    );
    return {
        orchestrator,
        joinedAt,
        ticketsOf,
        createIdempotent,
        findRule,
        findLink,
    };
}

describe("FrakGameOrchestrator.getCurrentGame", () => {
    it.each([
        { name: "no Instagram link", link: null, eligible: false },
        {
            name: "a linked account that does not follow",
            link: { follows: false },
            eligible: false,
        },
        {
            name: "a linked account that follows",
            link: { follows: true },
            eligible: true,
        },
    ])("derives eligibility from $name", async ({ link, eligible }) => {
        const { orchestrator, findLink } = makeOrchestrator({
            instagramLink: link,
        });

        const result = await orchestrator.getCurrentGame(USER);

        expect(findLink).toHaveBeenCalledWith(USER);
        expect(result.me.eligible).toBe(eligible);
    });

    it("does not look the Instagram link up when no game is open", async () => {
        const { orchestrator, findLink } = makeOrchestrator({ game: null });

        await orchestrator.getCurrentGame(USER);

        expect(findLink).not.toHaveBeenCalled();
    });

    it("returns the ticket count of a participant", async () => {
        const { orchestrator, ticketsOf } = makeOrchestrator({
            joinedAt: JOINED_AT,
            tickets: 7,
        });

        const result = await orchestrator.getCurrentGame(USER);

        expect(ticketsOf).toHaveBeenCalledWith(game, USER, JOINED_AT);
        expect(result.me).toEqual({
            participating: true,
            tickets: 7,
            eligible: false,
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
            me: { participating: false, tickets: 0, eligible: false },
        });
    });
});

describe("FrakGameOrchestrator.joinGame", () => {
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
