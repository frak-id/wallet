import type {
    DrawStatus,
    PublicDraw,
} from "@frak-labs/backend-elysia/domain/game/schemas";

/** What the public record says about the draw, in the order a reader cares. */
export type DrawPhase = "scheduled" | "checking" | "confirmed" | "noWinner";

/** Keyed by the backend's status, so a new status fails to compile until placed. */
const PHASE = {
    frozen: "scheduled",
    drawn: "checking",
    confirmed: "confirmed",
    void: "noWinner",
} as const satisfies Record<DrawStatus, DrawPhase>;

export type DrawPayout =
    | { state: "paid"; txHash: string }
    | { state: "pending" }
    | { state: "none" };

export type DrawMe =
    | { found: false }
    | {
          found: true;
          tickets: number;
          /** `tickets / totalTickets`, between 0 and 1. */
          share: number;
          /** 1-based place in the ranked candidates, null when not among them. */
          candidateRank: number | null;
          isWinner: boolean;
      };

export type DrawSummary = {
    phase: DrawPhase;
    participants: number;
    totalTickets: number;
    frozenAt: Date;
    drand: {
        chainHash: string;
        round: number;
        roundTime: Date;
        /** The round has been emitted, so its randomness can be fetched. */
        published: boolean;
    };
    winner: { pid: string; short: string } | null;
    payout: DrawPayout;
    /** Absent when no pid was asked about. */
    me?: DrawMe;
};

/** `a1b2c3…f9e8`: enough to recognise a pid, short enough for a phone. */
export function shortPid(pid: string): string {
    return pid.length <= 12 ? pid : `${pid.slice(0, 6)}…${pid.slice(-4)}`;
}

function payoutOf(draw: PublicDraw): DrawPayout {
    if (draw.status !== "confirmed") return { state: "none" };
    return draw.payoutTxHash
        ? { state: "paid", txHash: draw.payoutTxHash }
        : { state: "pending" };
}

function meOf(draw: PublicDraw, pid: string): DrawMe {
    const entry = draw.entries.find((e) => e.pid === pid);
    if (!entry) return { found: false };
    const rank = draw.candidates.indexOf(pid);
    return {
        found: true,
        tickets: entry.tickets,
        share: draw.totalTickets > 0 ? entry.tickets / draw.totalTickets : 0,
        candidateRank: rank === -1 ? null : rank + 1,
        isWinner: draw.winnerPid === pid,
    };
}

/**
 * The draw record as a page reads it. Dates are rebuilt with `new Date`: the
 * JSON body carries ISO strings whatever the generated type says.
 */
export function summarizeDraw(
    draw: PublicDraw,
    pid?: string,
    now: Date = new Date()
): DrawSummary {
    const roundTime = new Date(draw.drand.roundTime);
    return {
        phase: PHASE[draw.status],
        participants: draw.participants,
        totalTickets: draw.totalTickets,
        frozenAt: new Date(draw.frozenAt),
        drand: {
            chainHash: draw.drand.chainHash,
            round: draw.drand.round,
            roundTime,
            published: draw.drand.signature !== null || roundTime <= now,
        },
        winner: draw.winnerPid
            ? { pid: draw.winnerPid, short: shortPid(draw.winnerPid) }
            : null,
        payout: payoutOf(draw),
        ...(pid ? { me: meOf(draw, pid) } : {}),
    };
}
