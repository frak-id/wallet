import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameDrawSelect, GameSelect } from "../../domain/game/db/schema";
import {
    drandRandomness,
    drandRoundAt,
    drandRoundTime,
    rankCandidates,
    snapshotRoot,
} from "../../domain/game/draw";
import type { DrawEntry } from "../../domain/game/schemas";
import { NO_TICKETS } from "../../domain/game/tickets";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { GameDrawOrchestrator } from "./GameDrawOrchestrator";

const { track, emit } = vi.hoisted(() => ({
    track: vi.fn(),
    emit: vi.fn(),
}));

vi.mock("@backend-infrastructure", () => ({
    db: { transaction: (run: (tx: string) => unknown) => run("tx") },
    eventEmitter: { emit },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    productEvents: { track },
}));

// Quicknet round 33416581, as served by api.drand.sh on 2026-10-26.
const ROUND = 33416581;
const SIGNATURE =
    "8592d3ce0c351457c9e974c046c6c72f597b125a1ac60ab1003419b7246a9bad80704d40cb67b046cfd77be4f5bf619e";
const NOW = new Date("2026-10-31T19:00:00Z");

const game = {
    id: "11111111-1111-4111-8111-111111111111",
    prizeAmount: 50,
    startsAt: new Date("2026-10-20T10:00:00Z"),
    endsAt: new Date("2026-10-31T18:00:00Z"),
} as GameSelect;

const entry = (pid: string, drawTickets: number, groupId = `group-${pid}`) =>
    ({
        pid,
        identityGroupId: groupId,
        tickets: { ...NO_TICKETS, join: 1, purchase: drawTickets - 1 },
        drawTickets,
        discarded: drawTickets > 0 ? null : "not_following",
    }) satisfies DrawEntry;

const drawRow = (overrides: Partial<GameDrawSelect> = {}): GameDrawSelect => ({
    id: "draw-1",
    gameId: game.id,
    algorithm: "frak-draw-v1",
    status: "drawn",
    frozenAt: NOW,
    pidKey: "key",
    snapshotRoot: "root",
    totalTickets: 5,
    entries: [entry("aa", 4), entry("bb", 1), entry("cc", 0)],
    drandChainHash: "chain",
    drandRound: ROUND,
    drandSignature: SIGNATURE,
    candidates: ["aa", "bb"],
    rejections: [],
    winnerIdentityGroupId: null,
    confirmedBy: null,
    confirmedAt: null,
    assetLogId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
});

function setup() {
    const games = {
        findById: vi.fn().mockResolvedValue(game),
        findEndedBetween: vi.fn().mockResolvedValue([]),
    };
    const draws = {
        create: vi.fn(async (insert) => ({ ...drawRow(), ...insert })),
        findByGameId: vi.fn().mockResolvedValue(null),
        findByStatus: vi.fn().mockResolvedValue([]),
        recordBeacon: vi.fn(async (params) => drawRow(params)),
        addRejection: vi.fn(async () => drawRow()),
        confirm: vi.fn(async () => drawRow({ status: "confirmed" })),
    };
    const players = {
        participantsOf: vi.fn().mockResolvedValue([]),
        ticketsOf: vi.fn().mockResolvedValue(NO_TICKETS),
    };
    const instagramLinks = {
        findByIdentityGroups: vi.fn().mockResolvedValue([]),
    };
    const identities = {
        findSurvivingGroupId: vi.fn(async (id: string) => id),
        findGroupById: vi.fn().mockResolvedValue(null),
        getWalletForGroup: vi.fn().mockResolvedValue(null),
    };
    const merchants = {
        getDefaultRewardToken: vi
            .fn()
            .mockResolvedValue(currentStablecoins.eure),
    };
    const assetLogs = {
        createWinnerPayout: vi.fn().mockResolvedValue("asset-1"),
        findOnchainTxHash: vi.fn().mockResolvedValue(null),
    };
    const drand = {
        fetchBeacon: vi.fn(async (_chain: string, _round: number, accept) =>
            accept(SIGNATURE)
                ? { kind: "found", signature: SIGNATURE }
                : { kind: "unavailable" }
        ),
    };
    const orchestrator = new GameDrawOrchestrator(
        games as never,
        draws as never,
        players as never,
        instagramLinks as never,
        identities as never,
        merchants as never,
        assetLogs as never,
        drand as never
    );
    return {
        orchestrator,
        games,
        draws,
        players,
        instagramLinks,
        identities,
        merchants,
        assetLogs,
        drand,
    };
}

beforeEach(() => {
    track.mockReset();
    emit.mockReset();
});

describe("GameDrawOrchestrator.freeze", () => {
    it("keeps only followers' tickets and commits a round 10 minutes out", async () => {
        const { orchestrator, draws, players, instagramLinks } = setup();
        const joinedAt = new Date("2026-10-21T00:00:00Z");
        players.participantsOf.mockResolvedValue([
            { identityGroupId: "follower", joinedAt },
            { identityGroupId: "lurker", joinedAt },
        ]);
        players.ticketsOf.mockImplementation(async (_game, groupId) =>
            groupId === "follower"
                ? { ...NO_TICKETS, join: 1, purchase: 3 }
                : { ...NO_TICKETS, join: 1, brandShare: 9 }
        );
        instagramLinks.findByIdentityGroups.mockResolvedValue([
            { identityGroupId: "follower", follows: true },
            { identityGroupId: "lurker", follows: false },
        ]);

        await orchestrator.freeze(game, NOW);

        const insert = draws.create.mock.calls[0]?.[0];
        const byGroup = new Map<string, DrawEntry>(
            insert.entries.map((e: DrawEntry) => [e.identityGroupId, e])
        );
        expect(byGroup.get("follower")).toMatchObject({
            drawTickets: 4,
            discarded: null,
        });
        expect(byGroup.get("lurker")).toMatchObject({
            drawTickets: 0,
            discarded: "not_following",
            tickets: { join: 1, brandShare: 9 },
        });
        expect(insert).toMatchObject({
            status: "frozen",
            totalTickets: 4,
            drandRound: drandRoundAt(new Date(NOW.getTime() + 10 * 60_000)),
            snapshotRoot: snapshotRoot([
                { pid: byGroup.get("follower")?.pid ?? "", tickets: 4 },
            ]),
        });
        expect(insert.entries.map((e: DrawEntry) => e.pid)).toEqual(
            insert.entries.map((e: DrawEntry) => e.pid).sort()
        );
        expect(track).toHaveBeenCalledWith(
            "game_draw_frozen",
            null,
            expect.objectContaining({
                participants: 2,
                eligible_participants: 1,
                total_tickets: 4,
            })
        );
    });

    it("voids a draw nobody can win", async () => {
        const { orchestrator, draws, players } = setup();
        players.participantsOf.mockResolvedValue([
            { identityGroupId: "lurker", joinedAt: game.startsAt },
        ]);

        await orchestrator.freeze(game, NOW);

        expect(draws.create).toHaveBeenCalledWith(
            expect.objectContaining({ status: "void", totalTickets: 0 })
        );
    });

    it("refuses a game that is still on", async () => {
        const { orchestrator, draws } = setup();

        await expect(
            orchestrator.freeze(game, new Date("2026-10-31T17:00:00Z"))
        ).rejects.toMatchObject({ code: "GAME_NOT_ENDED" });
        expect(draws.create).not.toHaveBeenCalled();
    });

    it("returns the existing draw instead of freezing twice", async () => {
        const { orchestrator, draws } = setup();
        const existing = drawRow({ status: "frozen" });
        draws.findByGameId.mockResolvedValue(existing);

        await expect(orchestrator.freeze(game, NOW)).resolves.toBe(existing);
        expect(draws.create).not.toHaveBeenCalled();
    });
});

describe("GameDrawOrchestrator.runDue", () => {
    it("looks for games that ended within the last 7 days, past the 1 hour grace", async () => {
        const { orchestrator, games } = setup();

        await orchestrator.runDue(NOW);

        expect(games.findEndedBetween).toHaveBeenCalledWith(
            new Date(NOW.getTime() - 7 * 24 * 3600_000),
            new Date(NOW.getTime() - 3600_000)
        );
    });

    it("ranks the candidates from the verified beacon once the round is out", async () => {
        const { orchestrator, draws, drand } = setup();
        const frozen = drawRow({
            status: "frozen",
            drandSignature: null,
            candidates: null,
        });
        draws.findByStatus.mockResolvedValue([frozen]);

        const result = await orchestrator.runDue(drandRoundTime(ROUND));

        expect(drand.fetchBeacon).toHaveBeenCalledWith(
            "chain",
            ROUND,
            expect.any(Function)
        );
        expect(draws.recordBeacon).toHaveBeenCalledWith({
            id: "draw-1",
            signature: SIGNATURE,
            candidates: rankCandidates({
                randomness: drandRandomness(SIGNATURE),
                gameId: game.id,
                entries: [
                    { pid: "aa", tickets: 4 },
                    { pid: "bb", tickets: 1 },
                ],
                count: 10,
            }),
        });
        expect(result.drawn).toBe(1);
        expect(track).toHaveBeenCalledWith("game_draw_run", null, {
            game_id: game.id,
            candidates: 2,
        });
    });

    it("leaves a draw frozen while its round is not out", async () => {
        const { orchestrator, draws, drand } = setup();
        draws.findByStatus.mockResolvedValue([drawRow({ status: "frozen" })]);

        await orchestrator.runDue(
            new Date(drandRoundTime(ROUND).getTime() - 1)
        );

        expect(drand.fetchBeacon).not.toHaveBeenCalled();
        expect(draws.recordBeacon).not.toHaveBeenCalled();
    });

    it("leaves a draw frozen when no relay serves a valid beacon", async () => {
        const { orchestrator, draws, drand } = setup();
        draws.findByStatus.mockResolvedValue([drawRow({ status: "frozen" })]);
        drand.fetchBeacon.mockResolvedValue({ kind: "unavailable" });

        await orchestrator.runDue(drandRoundTime(ROUND));

        expect(draws.recordBeacon).not.toHaveBeenCalled();
    });
});

describe("GameDrawOrchestrator.reject", () => {
    it("passes over the candidate under review for the given reason", async () => {
        const { orchestrator, draws } = setup();
        draws.findByGameId.mockResolvedValue(drawRow());

        await orchestrator.reject(game.id, "fraud", "quentin");

        expect(draws.addRejection).toHaveBeenCalledWith({
            id: "draw-1",
            reviewed: 0,
            rejection: expect.objectContaining({
                pid: "aa",
                reason: "fraud",
                actor: "quentin",
            }),
            exhausted: false,
        });
        expect(track).toHaveBeenCalledWith("game_winner_rejected", null, {
            game_id: game.id,
            rank: 1,
            reason: "fraud",
        });
    });

    it("voids the draw when the last candidate is rejected", async () => {
        const { orchestrator, draws } = setup();
        draws.findByGameId.mockResolvedValue(
            drawRow({
                rejections: [
                    { pid: "aa", reason: "fraud", actor: "q", at: "t" },
                ],
            })
        );

        await orchestrator.reject(game.id, "unreachable", "quentin");

        expect(draws.addRejection).toHaveBeenCalledWith(
            expect.objectContaining({
                reviewed: 1,
                rejection: expect.objectContaining({ pid: "bb" }),
                exhausted: true,
            })
        );
    });

    it.each([
        { name: "frozen", status: "frozen" },
        { name: "confirmed", status: "confirmed" },
    ] as const)("refuses a $name draw", async ({ status }) => {
        const { orchestrator, draws } = setup();
        draws.findByGameId.mockResolvedValue(drawRow({ status }));

        await expect(
            orchestrator.reject(game.id, "fraud", "quentin")
        ).rejects.toMatchObject({ code: "DRAW_NOT_UNDER_REVIEW" });
    });

    it("reports a review made meanwhile", async () => {
        const { orchestrator, draws } = setup();
        draws.findByGameId.mockResolvedValue(drawRow());
        draws.addRejection.mockResolvedValue(null as never);

        await expect(
            orchestrator.reject(game.id, "fraud", "quentin")
        ).rejects.toMatchObject({ code: "DRAW_REVIEWED_MEANWHILE" });
    });
});

describe("GameDrawOrchestrator.confirm", () => {
    const reviewedOnce = () =>
        drawRow({
            rejections: [{ pid: "aa", reason: "fraud", actor: "q", at: "t" }],
        });

    it("pays the candidate's current identity the prize in EURe and closes the draw", async () => {
        const { orchestrator, draws, identities, assetLogs } = setup();
        draws.findByGameId.mockResolvedValue(reviewedOnce());
        identities.findSurvivingGroupId.mockResolvedValue("merged-into");

        await orchestrator.confirm(game.id, "quentin");

        expect(identities.findSurvivingGroupId).toHaveBeenCalledWith(
            "group-bb"
        );
        expect(assetLogs.createWinnerPayout).toHaveBeenCalledWith(
            {
                identityGroupId: "merged-into",
                merchantId: FRAK_MERCHANT_ID,
                amount: 50,
                tokenAddress: currentStablecoins.eure,
            },
            "tx"
        );
        expect(draws.confirm).toHaveBeenCalledWith(
            {
                id: "draw-1",
                reviewed: 1,
                winnerIdentityGroupId: "merged-into",
                confirmedBy: "quentin",
                assetLogId: "asset-1",
            },
            "tx"
        );
        expect(emit).toHaveBeenCalledWith("newPendingRewards", { count: 1 });
        expect(track).toHaveBeenCalledWith(
            "game_winner_confirmed",
            "merged-into",
            { game_id: game.id, rank: 2, prize_amount: 50 }
        );
    });

    it("fails the transaction when someone reviewed the draw meanwhile", async () => {
        const { orchestrator, draws } = setup();
        draws.findByGameId.mockResolvedValue(reviewedOnce());
        draws.confirm.mockResolvedValue(null as never);

        await expect(
            orchestrator.confirm(game.id, "quentin")
        ).rejects.toMatchObject({ code: "DRAW_REVIEWED_MEANWHILE" });
        expect(emit).not.toHaveBeenCalled();
    });

    it("refuses to pay a EUR prize in another token", async () => {
        const { orchestrator, draws, merchants, assetLogs } = setup();
        draws.findByGameId.mockResolvedValue(reviewedOnce());
        merchants.getDefaultRewardToken.mockResolvedValue(
            "0x0000000000000000000000000000000000000001"
        );

        await expect(
            orchestrator.confirm(game.id, "quentin")
        ).rejects.toMatchObject({ code: "PRIZE_TOKEN_NOT_EURE" });
        expect(assetLogs.createWinnerPayout).not.toHaveBeenCalled();
    });
});

describe("GameDrawOrchestrator.publicDraw", () => {
    it("publishes the eligible list, the beacon and the winner by pid only", async () => {
        const { orchestrator, draws, assetLogs } = setup();
        draws.findByGameId.mockResolvedValue(
            drawRow({
                status: "confirmed",
                rejections: [
                    { pid: "aa", reason: "fraud", actor: "q", at: "t" },
                ],
                assetLogId: "asset-1",
            })
        );
        assetLogs.findOnchainTxHash.mockResolvedValue("0xabc");

        const record = await orchestrator.publicDraw(game.id);

        expect(record).toMatchObject({
            entries: [
                { pid: "aa", tickets: 4 },
                { pid: "bb", tickets: 1 },
            ],
            participants: 3,
            discardedParticipants: 1,
            drand: {
                round: ROUND,
                signature: SIGNATURE,
                randomness: drandRandomness(SIGNATURE),
            },
            rejections: [{ pid: "aa", reason: "fraud", at: "t" }],
            winnerPid: "bb",
            payoutTxHash: "0xabc",
        });
        expect(JSON.stringify(record)).not.toMatch(/group-|"q"|pidKey|key/);
    });
});

describe("GameDrawOrchestrator.myEntry", () => {
    it("finds the caller through a group merged into theirs after the freeze", async () => {
        const { orchestrator, draws, identities } = setup();
        draws.findByGameId.mockResolvedValue(drawRow());
        identities.findGroupById.mockResolvedValue({
            id: "now",
            mergedGroups: [{ groupId: "group-bb", mergedAt: "t" }],
        });

        await expect(orchestrator.myEntry(game.id, "now")).resolves.toEqual({
            pid: "bb",
            drawTickets: 1,
            discarded: null,
        });
    });
});
