import type {
    GameResult,
    GameSummary,
    PublicDraw,
} from "@frak-labs/backend-elysia/domain/game/schemas";

export function gameSummary(overrides: Partial<GameSummary> = {}): GameSummary {
    return {
        id: "g1",
        prizeAmount: 50,
        prizeDescription: null,
        startsAt: new Date("2026-10-01T10:00:00Z"),
        endsAt: new Date("2026-10-10T18:00:00Z"),
        sponsor: null,
        ...overrides,
    };
}

export function gameResult(
    overrides: Partial<Omit<GameResult, "game">> & {
        game?: Partial<GameSummary>;
    } = {}
): GameResult {
    const { game, ...rest } = overrides;
    return {
        game: gameSummary(game),
        outcome: "drawing",
        drawTickets: 7,
        ticketsBySource: {
            join: 1,
            instagramCertified: 0,
            purchase: 6,
            referredPurchase: 0,
            referredSignup: 0,
            brandShare: 0,
        },
        discarded: null,
        verifyBy: null,
        pid: null,
        totalTickets: 120,
        participants: 30,
        confirmedAt: null,
        ...rest,
    };
}

export function publicDraw(overrides: Partial<PublicDraw> = {}): PublicDraw {
    return {
        gameId: "5b0a6c1e-6a52-4b1c-9d3e-0f6f2d9a7c11",
        algorithm: "frak-draw-v2",
        status: "drawn",
        frozenAt: new Date("2026-10-10T19:00:00Z"),
        snapshotRoot: "ab".repeat(32),
        totalTickets: 80,
        participants: 3,
        discardedParticipants: 1,
        entries: [
            { pid: "a1".repeat(16), tickets: 20 },
            { pid: "b2".repeat(16), tickets: 10 },
            { pid: "c3".repeat(16), tickets: 50 },
        ],
        drand: {
            chainHash: "52db9ba7".repeat(8),
            round: 1234,
            roundTime: new Date("2026-10-10T19:10:00Z"),
            signature: "cd".repeat(48),
            randomness: "ef".repeat(32),
        },
        candidates: ["c3".repeat(16), "a1".repeat(16)],
        rejections: [],
        winnerPid: null,
        payoutTxHash: null,
        ...overrides,
    };
}
