import type {
    GameResult,
    GameSummary,
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
        tickets: 7,
        drawTickets: 7,
        ticketsBySource: {
            join: 1,
            purchase: 6,
            referredPurchase: 0,
            referredSignup: 0,
            brandShare: 0,
        },
        discarded: null,
        totalTickets: 120,
        participants: 30,
        confirmedAt: null,
        ...rest,
    };
}
