import { describe, expect, it, vi } from "vitest";
import type { GameDrawSelect, GameSelect } from "../../domain/game/db/schema";
import { NO_TICKETS } from "../../domain/game/tickets";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { CreateGameInput } from "../schemas/internalSchemas";
import { FrakGameAdminOrchestrator } from "./FrakGameAdminOrchestrator";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-01T12:00:00Z");

const frakCode = { id: "code-1", code: "FRAK26", kind: "frak" };

const game = (overrides: Partial<GameSelect> = {}): GameSelect => ({
    id: "game-1",
    referralCodeId: "code-1",
    campaignRuleId: "rule-1",
    sponsorMerchantId: null,
    prizeAmount: 50,
    prizeDescription: null,
    startsAt: new Date(NOW.getTime() - DAY_MS),
    endsAt: new Date(NOW.getTime() + DAY_MS),
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
});

const input = (overrides: Partial<CreateGameInput> = {}): CreateGameInput => ({
    code: "frak26",
    reward: 2,
    budget: 500,
    startsAt: new Date(NOW.getTime() + DAY_MS),
    endsAt: new Date(NOW.getTime() + 8 * DAY_MS),
    prizeAmount: 50,
    ...overrides,
});

function makeOrchestrator(
    opts: {
        merchant?: object | null;
        code?: object | null;
        games?: GameSelect[];
        gameOnCode?: GameSelect | null;
        activeRules?: object[];
        draw?: Partial<GameDrawSelect> | null;
        payouts?: object[];
    } = {}
) {
    const merchant =
        opts.merchant === undefined ? { id: FRAK_MERCHANT_ID } : opts.merchant;
    const createRule = vi.fn().mockResolvedValue({ id: "draft-rule" });
    const publish = vi.fn().mockResolvedValue({ id: "rule-9" });
    const createGame = vi.fn(async (values: object) => ({
        ...game(),
        ...values,
    }));
    const createMerchant = vi.fn(async (values: object) => values);
    const ticketsOf = vi.fn(async (_game: unknown, groupId: string) => ({
        ...NO_TICKETS,
        join: 1,
        purchase: groupId === "g-buyer" ? 6 : 0,
    }));
    const orchestrator = new FrakGameAdminOrchestrator(
        {
            list: vi.fn().mockResolvedValue(opts.games ?? []),
            findById: vi.fn(async (id: string) => game({ id })),
            findByReferralCodeId: vi
                .fn()
                .mockResolvedValue(opts.gameOnCode ?? null),
            create: createGame,
            setStatus: vi.fn(),
        } as never,
        {
            findByGameId: vi.fn().mockResolvedValue(opts.draw ?? null),
            findSummaries: vi.fn().mockResolvedValue([]),
        },
        {
            findByCode: vi
                .fn()
                .mockResolvedValue(
                    opts.code === undefined ? frakCode : opts.code
                ),
            findById: vi.fn(),
        } as never,
        {
            findById: vi.fn(),
            findByMerchantAndStatus: vi.fn(),
            findActiveByMerchant: vi
                .fn()
                .mockResolvedValue(opts.activeRules ?? []),
        } as never,
        { create: createRule, publish } as never,
        {
            findById: vi.fn(async (id: string) =>
                id === FRAK_MERCHANT_ID ? merchant : null
            ),
            create: createMerchant,
        } as never,
        { getNormalizedDomain: (domain: string) => domain.replace("www.", "") },
        {
            participantsOf: vi.fn().mockResolvedValue([
                { identityGroupId: "g-joiner", joinedAt: NOW },
                { identityGroupId: "g-buyer", joinedAt: NOW },
            ]),
            participantCounts: vi.fn(),
            ticketsOf,
        },
        { review: vi.fn(), freeze: vi.fn(), publicDraw: vi.fn() } as never,
        {
            getWalletsForGroups: vi
                .fn()
                .mockResolvedValue(new Map([["g-buyer", "0xb0b"]])),
            getWalletForGroup: vi.fn(),
        },
        {
            findByIdentityGroups: vi.fn().mockResolvedValue([
                {
                    identityGroupId: "g-buyer",
                    username: "buyer",
                    follows: true,
                },
            ]),
        } as never,
        { findDeclarations: vi.fn().mockResolvedValue([]) } as never,
        { findPayoutStates: vi.fn().mockResolvedValue(opts.payouts ?? []) }
    );
    return {
        orchestrator,
        createRule,
        publish,
        createGame,
        createMerchant,
        ticketsOf,
    };
}

describe("FrakGameAdminOrchestrator.createGame", () => {
    it("publishes a join rule on the new game, paying newcomers once", async () => {
        const { orchestrator, createRule, publish, createGame } =
            makeOrchestrator();
        await orchestrator.createGame(input({ unlockDays: 14 }), NOW);

        const [{ rule, expiresAt, budgetConfig }] = createRule.mock.calls[0];
        const gameId = createGame.mock.calls[0]?.[0].id;
        expect(rule).toMatchObject({
            trigger: "game_join",
            conditions: [
                { field: "game.id", operator: "eq", value: gameId },
                { field: "game.newcomer", operator: "eq", value: true },
            ],
            rewards: [{ recipient: "referee", amountType: "fixed", amount: 2 }],
            maxRewardsPerUser: 1,
            pendingRewardExpirationDays: 14,
            holdUntilReleased: true,
        });
        expect(expiresAt).toEqual(new Date(input().endsAt.getTime() + DAY_MS));
        expect(budgetConfig).toEqual([
            { label: "total", durationInSeconds: null, amount: 500 },
        ]);
        expect(publish).toHaveBeenCalledWith("draft-rule");
        expect(createGame).toHaveBeenCalledWith(
            expect.objectContaining({
                referralCodeId: "code-1",
                campaignRuleId: "rule-9",
                prizeAmount: 50,
                prizeDescription: null,
            })
        );
    });

    it.each([
        {
            name: "the Frak merchant is missing",
            opts: { merchant: null },
            game: input(),
            error: { status: 409, code: "FRAK_MERCHANT_MISSING" },
        },
        {
            name: "the code is a user's",
            opts: { code: { ...frakCode, kind: "user" } },
            game: input(),
            error: { status: 404, code: "CODE_NOT_FOUND" },
        },
        {
            name: "the code already has a game",
            opts: { gameOnCode: game() },
            game: input(),
            error: { status: 409, code: "CODE_HAS_GAME" },
        },
        {
            name: "it ends before it starts",
            opts: {},
            game: input({ endsAt: input().startsAt }),
            error: { status: 400, code: "INVALID_WINDOW" },
        },
        {
            name: "it already ended",
            opts: {},
            game: input({
                startsAt: new Date(NOW.getTime() - 2 * DAY_MS),
                endsAt: new Date(NOW.getTime() - DAY_MS),
            }),
            error: { status: 400, code: "INVALID_WINDOW" },
        },
        {
            name: "it overlaps a game still on",
            opts: {
                games: [
                    game({ endsAt: new Date(input().startsAt.getTime() + 1) }),
                ],
            },
            game: input(),
            error: { status: 409, code: "GAME_WINDOW_OVERLAP" },
        },
        {
            name: "the sponsor does not exist",
            opts: {},
            game: input({
                sponsorMerchantId: "22222222-2222-4222-8222-222222222222",
            }),
            error: { status: 404, code: "SPONSOR_NOT_FOUND" },
        },
    ])("refuses when $name", async ({ opts, game: body, error }) => {
        const { orchestrator, createRule } = makeOrchestrator(opts);
        await expect(orchestrator.createGame(body, NOW)).rejects.toMatchObject(
            error
        );
        expect(createRule).not.toHaveBeenCalled();
    });

    it("lets a game start when the previous one ends", async () => {
        const { orchestrator } = makeOrchestrator({
            games: [game({ endsAt: input().startsAt })],
        });
        await expect(
            orchestrator.createGame(input(), NOW)
        ).resolves.toBeDefined();
    });
});

describe("FrakGameAdminOrchestrator.publishSignupRule", () => {
    it("409s while a signup rule is live, since both would pay", async () => {
        const { orchestrator, createRule } = makeOrchestrator({
            activeRules: [{ id: "live" }],
        });
        await expect(
            orchestrator.publishSignupRule({
                referrer: 2,
                referee: 1,
                budget: 100,
            })
        ).rejects.toMatchObject({ status: 409, code: "SIGNUP_RULE_ACTIVE" });
        expect(createRule).not.toHaveBeenCalled();
    });

    it("pays both sides of a signup, held 30 days by default", async () => {
        const { orchestrator, createRule } = makeOrchestrator();
        await orchestrator.publishSignupRule({
            referrer: 2,
            referee: 1,
            budget: 100,
        });
        expect(createRule.mock.calls[0]?.[0].rule).toMatchObject({
            trigger: "referral_signup",
            rewards: [
                { recipient: "referrer", amount: 2 },
                { recipient: "referee", amount: 1 },
            ],
            pendingRewardExpirationDays: 30,
        });
    });
});

describe("FrakGameAdminOrchestrator.seedMerchant", () => {
    it("is a no-op once the merchant exists", async () => {
        const { orchestrator, createMerchant } = makeOrchestrator();
        const { created } = await orchestrator.seedMerchant({
            domain: "frak.id",
            owner: { accountId: "acc" },
        });
        expect(created).toBe(false);
        expect(createMerchant).not.toHaveBeenCalled();
    });

    it("seeds it on the normalized domain", async () => {
        const { orchestrator, createMerchant } = makeOrchestrator({
            merchant: null,
        });
        await orchestrator.seedMerchant({
            domain: "www.frak.id",
            owner: { accountId: "acc" },
        });
        expect(createMerchant).toHaveBeenCalledWith(
            expect.objectContaining({
                id: FRAK_MERCHANT_ID,
                domain: "frak.id",
                ownerAccountId: "acc",
            })
        );
    });
});

describe("FrakGameAdminOrchestrator.drawOf", () => {
    const confirmed: Partial<GameDrawSelect> = {
        status: "confirmed",
        algorithm: "frak-draw-v2",
        frozenAt: NOW,
        snapshotRoot: "root",
        totalTickets: 3,
        entries: [],
        drandRound: 1,
        drandSignature: "sig",
        candidates: ["p1"],
        rejections: [],
        winnerIdentityGroupId: "g-buyer",
        confirmedBy: "admin@frak.id",
        confirmedAt: NOW,
        assetLogId: "asset-1",
    };

    it("shows where the winner's payout stands", async () => {
        const { orchestrator } = makeOrchestrator({
            draw: confirmed,
            payouts: [
                {
                    id: "asset-1",
                    status: "bank_depleted",
                    amount: "50",
                    tokenAddress: "0xe",
                    txHash: null,
                    statusChangedAt: NOW,
                    settledAt: null,
                    expiresAt: null,
                    lastError: null,
                },
            ],
        });
        const draw = await orchestrator.drawOf("game-1");
        expect(draw?.winner?.payout).toEqual({
            status: "bank_depleted",
            amount: "50",
            txHash: null,
            statusChangedAt: NOW,
            settledAt: null,
            expiresAt: null,
            lastError: null,
        });
    });

    it("has no payout when the reward row is gone", async () => {
        const { orchestrator } = makeOrchestrator({ draw: confirmed });
        const draw = await orchestrator.drawOf("game-1");
        expect(draw?.winner).toMatchObject({
            assetLogId: "asset-1",
            payout: null,
        });
    });
});

describe("FrakGameAdminOrchestrator.playersOf", () => {
    it("counts live tickets until the freeze, best first", async () => {
        const { orchestrator } = makeOrchestrator();
        const { source, players } = await orchestrator.playersOf("game-1");
        expect(source).toBe("live");
        expect(players).toEqual([
            expect.objectContaining({
                identityGroupId: "g-buyer",
                totalTickets: 7,
                wallet: "0xb0b",
                eligible: true,
                instagram: {
                    level: "certified",
                    username: "buyer",
                    follows: true,
                },
                drawTickets: null,
            }),
            expect.objectContaining({
                identityGroupId: "g-joiner",
                totalTickets: 1,
                wallet: null,
                eligible: false,
                instagram: { level: "none", username: null, follows: null },
            }),
        ]);
    });

    it("reads the frozen list once there is one", async () => {
        const { orchestrator, ticketsOf } = makeOrchestrator({
            draw: {
                entries: [
                    {
                        pid: "p1",
                        identityGroupId: "g-joiner",
                        tickets: { ...NO_TICKETS, join: 1 },
                        drawTickets: 0,
                        discarded: "not_linked",
                    },
                ],
            },
        });
        const { source, players } = await orchestrator.playersOf("game-1");
        expect(source).toBe("frozen");
        expect(ticketsOf).not.toHaveBeenCalled();
        expect(players).toEqual([
            expect.objectContaining({
                pid: "p1",
                totalTickets: 1,
                drawTickets: 0,
                discarded: "not_linked",
                eligible: false,
            }),
        ]);
    });

    it("serves every viewer from one count until asked for a fresh one", async () => {
        const { orchestrator, ticketsOf } = makeOrchestrator();
        await orchestrator.playersOf("game-1");
        await orchestrator.playersOf("game-1");
        expect(ticketsOf).toHaveBeenCalledTimes(2);
        await orchestrator.playersOf("game-1", true);
        expect(ticketsOf).toHaveBeenCalledTimes(4);
    });
});
