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

export const REJECTED_DRAW_WINNER = "000f4f5b1886d23782def38673b0a7ca";
export const REJECTED_DRAW_FRAUD = "54b3f30c3ef7e989e4aa7fc2c43b3e50";

/** A confirmed draw whose first three candidates were passed over (prod game 482397c3). */
export function rejectedPublicDraw(): PublicDraw {
    const [fraud, unreachable, ineligible] = [
        REJECTED_DRAW_FRAUD,
        "aded22cf6440a7fc2ac928c2e0c3e0ae",
        "f10a5da60119a4c56d13371f5bffcce9",
    ];
    return publicDraw({
        gameId: "482397c3-c3ee-476d-a32c-3da19135741b",
        status: "confirmed",
        frozenAt: new Date("2026-11-10T17:00:00.493Z"),
        totalTickets: 23,
        participants: 10,
        discardedParticipants: 3,
        entries: [
            { pid: REJECTED_DRAW_WINNER, tickets: 4 },
            { pid: fraud, tickets: 3 },
            { pid: "7851a78dbfdd6970dddc4d56f82dc1cf", tickets: 4 },
            { pid: "7a0cc8781b0bd0078be14d951b06029b", tickets: 3 },
            { pid: unreachable, tickets: 3 },
            { pid: "ef999b79c123f67de9e57c57793ce73d", tickets: 3 },
            { pid: ineligible, tickets: 3 },
        ],
        drand: {
            chainHash:
                "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
            round: 33842413,
            roundTime: new Date("2026-11-10T17:10:03.000Z"),
            signature: "cd".repeat(48),
            randomness: "ef".repeat(32),
        },
        candidates: [
            fraud,
            unreachable,
            ineligible,
            REJECTED_DRAW_WINNER,
            "7a0cc8781b0bd0078be14d951b06029b",
            "ef999b79c123f67de9e57c57793ce73d",
            "7851a78dbfdd6970dddc4d56f82dc1cf",
        ],
        rejections: [
            {
                pid: fraud,
                reason: "fraud",
                at: "2026-11-12T08:37:12.162Z",
            },
            {
                pid: unreachable,
                reason: "unreachable",
                at: "2026-11-12T08:37:32.448Z",
            },
            {
                pid: ineligible,
                reason: "ineligible",
                at: "2026-11-12T08:40:17.862Z",
            },
        ],
        winnerPid: REJECTED_DRAW_WINNER,
        payoutTxHash:
            "0x21f76c8b8a784cc8f122a17bafefd0d91b62077d00acf2260370dd85cece782e",
    });
}
