import type { TicketSource } from "@frak-labs/backend-elysia/domain/game/schemas";
import { TICKET_AMOUNTS } from "@/module/game/utils/ticketAmounts";

type TicketBreakdown = Record<TicketSource, number>;

/** What a device last showed for a game. */
export type GameSeen = {
    ticketsBySource: TicketBreakdown;
    eligible: boolean;
};

export type GameGains = {
    gains: { source: TicketSource; tickets: number }[];
    total: number;
    /** The tickets were held back last time and count now. */
    unlocked: boolean;
};

const SOURCES = Object.keys(TICKET_AMOUNTS) as TicketSource[];

export const NO_GAINS: GameGains = { gains: [], total: 0, unlocked: false };

/** Tickets earned and the unlock reached since `baseline`; nothing without one. */
export function gainsSince(baseline: GameSeen | null, me: GameSeen): GameGains {
    if (!baseline) return NO_GAINS;
    const gains = SOURCES.map((source) => ({
        source,
        tickets:
            me.ticketsBySource[source] -
            (baseline.ticketsBySource[source] ?? 0),
    })).filter((gain) => gain.tickets > 0);
    return {
        gains,
        total: gains.reduce((sum, gain) => sum + gain.tickets, 0),
        unlocked: !baseline.eligible && me.eligible,
    };
}
